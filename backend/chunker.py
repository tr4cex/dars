import re

from . import config

SPLIT = re.compile(r"(?<=[\.\!\?\؟\n])\s+")


def split_text(text, size=None, overlap=None):
    size = size or config.CHUNK_CHARS
    overlap = overlap or config.CHUNK_OVERLAP
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    pieces = [p for p in SPLIT.split(text) if p.strip()]
    chunks, buf = [], ""
    for p in pieces:
        if len(p) > size:
            if buf:
                chunks.append(buf.strip())
                buf = ""
            for i in range(0, len(p), size - overlap):
                chunks.append(p[i:i + size].strip())
            continue
        if buf and len(buf) + len(p) + 1 > size:
            chunks.append(buf.strip())
            tail = buf[-overlap:]
            cut = tail.find(" ")
            buf = tail[cut + 1:] if cut != -1 else tail
        buf += (" " if buf and not buf.endswith("\n") else "") + p
    if buf.strip():
        chunks.append(buf.strip())
    return [c for c in chunks if len(c.strip()) > 1]


def make_chunks(segments):
    out = []
    for loc, text in segments:
        for c in split_text(text):
            out.append((loc, c))
    return out
