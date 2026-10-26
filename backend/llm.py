import base64
import io
import re
import itertools
import threading
import time

import numpy as np
from PIL import Image, ImageDraw
from openai import OpenAI

from . import config

OCR_PROMPT = """You are a precise text extraction tool for page images.

Extract the text from the image following these rules exactly:
1. Join words that are split across two lines into one word.
2. Put every heading on its own line and merge the lines of one paragraph into a single paragraph.
3. Keep lists and bullet points, and format tables using | between columns.
4. Keep numbers and symbols exactly as they are, and write math as LaTeX between $ signs.
5. If the page contains pictures or diagrams, describe them in a separate paragraph after the text.
6. Never drop useful text, never add or rephrase anything of your own. Keep the original language, including Arabic.
7. If the image contains no text, answer only: [NO TEXT]

Reply with the formatted text only, without any introduction."""


class KeyPool:
    def __init__(self, keys):
        if not keys:
            raise RuntimeError("no API keys configured")
        self.clients = [OpenAI(api_key=k, base_url=config.BASE_URL, timeout=90, max_retries=0) for k in keys]
        self.cooldown = [0.0] * len(keys)
        self.cycle = itertools.cycle(range(len(keys)))
        self.lock = threading.Lock()

    def acquire(self):
        with self.lock:
            now = time.time()
            for _ in range(len(self.clients)):
                i = next(self.cycle)
                if self.cooldown[i] <= now:
                    return i, self.clients[i]
            i = min(range(len(self.clients)), key=lambda j: self.cooldown[j])
            return i, self.clients[i]

    def penalize(self, i, seconds=30):
        with self.lock:
            self.cooldown[i] = time.time() + seconds

    def call(self, fn, tries=6):
        last = None
        for attempt in range(tries):
            i, client = self.acquire()
            wait = self.cooldown[i] - time.time()
            if wait > 0:
                time.sleep(min(wait, 5))
            try:
                return fn(client)
            except Exception as e:
                last = e
                text = str(e).lower()
                if "429" in text or "quota" in text or "rate" in text:
                    self.penalize(i, 45)
                elif "503" in text or "overloaded" in text or "timeout" in text or "unavailable" in text:
                    self.penalize(i, 8)
                elif "401" in text or "403" in text or "api key" in text:
                    self.penalize(i, 3600)
                else:
                    self.penalize(i, 3)
                time.sleep(min(1.5 * (attempt + 1), 6))
        raise last


_pool = None


def pool():
    global _pool
    if _pool is None:
        _pool = KeyPool(config.API_KEYS)
    return _pool


def embed(texts, batch=64):
    out = []
    for s in range(0, len(texts), batch):
        part = [t[:6000] for t in texts[s:s + batch]]
        res = pool().call(lambda c: c.embeddings.create(model=config.EMBED_MODEL, input=part, dimensions=config.EMBED_DIM))
        out.extend([d.embedding for d in res.data])
    arr = np.asarray(out, dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return arr / norms


def embed_query(text):
    return embed([text])[0]


def ocr_image(png_bytes, mime="image/png"):
    b64 = base64.b64encode(png_bytes).decode()

    def run(c):
        r = c.chat.completions.create(
            model=config.VISION_MODEL,
            reasoning_effort="none",
            messages=[
                {"role": "system", "content": OCR_PROMPT},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    {"type": "text", "text": "Extract the text from this page."},
                ]},
            ],
        )
        return (r.choices[0].message.content or "").strip()

    text = pool().call(run)
    return "" if text.startswith("[NO TEXT]") else text


def chat(messages, temperature=0.3, effort="none"):
    def run(c):
        r = c.chat.completions.create(model=config.CHAT_MODEL, messages=messages, temperature=temperature, reasoning_effort=effort)
        return r.choices[0].message.content or ""

    return pool().call(run)


def chat_stream(messages, temperature=0.3):
    last = None
    for attempt in range(4):
        i, client = pool().acquire()
        started = False
        try:
            stream = client.chat.completions.create(
                model=config.CHAT_MODEL, messages=messages, temperature=temperature, stream=True, reasoning_effort="none"
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
                piece = chunk.choices[0].delta.content
                if piece:
                    started = True
                    yield piece
            return
        except Exception as e:
            last = e
            if started:
                raise
            pool().penalize(i, 30 if "429" in str(e) else 5)
            time.sleep(1 + attempt)
    raise last


BATCH_NOTE = """

The image contains {n} separate pages stacked from top to bottom, divided by thick black bars. Treat each page independently.
Start the text of every page with a line exactly like `=== PAGE k ===` where k runs from 1 to {n}, then the page text. Output all {n} pages in order."""


def stitch(pngs, max_height=7600):
    images = [Image.open(io.BytesIO(b)).convert("RGB") for b in pngs]
    width = max(i.width for i in images)
    bar = 18
    total = sum(i.height for i in images) + bar * (len(images) - 1)
    canvas = Image.new("RGB", (width, total), "white")
    draw = ImageDraw.Draw(canvas)
    y = 0
    for n, img in enumerate(images):
        canvas.paste(img, ((width - img.width) // 2, y))
        y += img.height
        if n < len(images) - 1:
            draw.rectangle([0, y, width, y + bar], fill="black")
            y += bar
    if canvas.height > max_height:
        ratio = max_height / canvas.height
        canvas = canvas.resize((int(canvas.width * ratio), max_height), Image.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def ocr_pages(pngs):
    if len(pngs) == 1:
        return [ocr_image(pngs[0])]
    b64 = base64.b64encode(stitch(pngs)).decode()
    n = len(pngs)

    def run(c):
        r = c.chat.completions.create(
            model=config.VISION_MODEL,
            reasoning_effort="none",
            messages=[
                {"role": "system", "content": OCR_PROMPT + BATCH_NOTE.format(n=n)},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": f"Extract the text of all {n} pages."},
                ]},
            ],
        )
        return (r.choices[0].message.content or "").strip()

    raw = pool().call(run)
    parts = re.split(r"^\s*=== PAGE (\d+) ===\s*$", raw, flags=re.M)
    found = {}
    for i in range(1, len(parts) - 1, 2):
        found[int(parts[i])] = parts[i + 1].strip()
    if sorted(found) != list(range(1, n + 1)):
        return [ocr_image(b) for b in pngs]
    return ["" if found[k].startswith("[NO TEXT]") else found[k] for k in range(1, n + 1)]
