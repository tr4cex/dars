import json
import re
import threading
from pathlib import Path

import numpy as np

from . import chunker, config, db, extractors, llm

_cache = {}
_cache_lock = threading.Lock()


def invalidate(collection_id):
    with _cache_lock:
        _cache.pop(collection_id, None)


def load_matrix(collection_id):
    with _cache_lock:
        hit = _cache.get(collection_id)
    if hit is not None:
        return hit
    rows = db.query(
        "SELECT c.id, c.doc_id, c.loc, c.text, c.embedding, d.name FROM chunks c "
        "JOIN documents d ON d.id=c.doc_id WHERE c.collection_id=? AND d.status='ready' ORDER BY c.doc_id, c.idx",
        (collection_id,),
    )
    if not rows:
        data = {"meta": [], "matrix": np.zeros((0, config.EMBED_DIM), dtype=np.float32)}
    else:
        matrix = np.vstack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
        meta = [{"id": r["id"], "doc_id": r["doc_id"], "loc": r["loc"], "text": r["text"], "doc": r["name"]} for r in rows]
        data = {"meta": meta, "matrix": matrix}
    with _cache_lock:
        _cache[collection_id] = data
    return data


def set_state(doc_id, **fields):
    keys = ", ".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE documents SET {keys} WHERE id=?", (*fields.values(), doc_id))


def ingest(doc_id):
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        return
    try:
        set_state(doc_id, status="reading", stage="Reading file", progress=2, error=None)
        path = Path(doc["path"])

        def progress(done, total):
            pct = 2 + int(55 * done / max(total, 1))
            set_state(doc_id, progress=pct, stage=f"Reading {done}/{total}", parts=total)

        _, segments = extractors.extract(path, progress)
        pairs = chunker.make_chunks(segments)
        if not pairs:
            raise ValueError("No readable text was found in this file")
        set_state(doc_id, status="embedding", stage="Building index", progress=60, chunk_count=len(pairs))
        headed = [f"{doc['name']} | {loc}\n{text}" for loc, text in pairs]
        vectors = []
        step = 48
        for s in range(0, len(headed), step):
            vectors.append(llm.embed(headed[s:s + step]))
            set_state(doc_id, progress=60 + int(38 * min(s + step, len(headed)) / len(headed)))
        matrix = np.vstack(vectors)
        db.delete_document_chunks(doc_id)
        db.insert_chunks(doc_id, doc["collection_id"], pairs, matrix)
        set_state(doc_id, status="ready", stage="Ready", progress=100)
    except Exception as e:
        set_state(doc_id, status="error", stage="Failed", error=str(e)[:300])
    finally:
        invalidate(doc["collection_id"])


ARABIC_PREFIX = re.compile(r"^(وال|بال|كال|فال|لل|ال)")


def fts_query(text):
    words = re.findall(r"[\w؀-ۿ]+", text.lower())
    terms = []
    for w in words:
        if len(w) < 2:
            continue
        stem = ARABIC_PREFIX.sub("", w) if re.search(r"[؀-ۿ]", w) else w
        stem = stem if len(stem) >= 2 else w
        terms.append(f'"{stem}"*')
    return " OR ".join(dict.fromkeys(terms))


def retrieve(collection_id, query, doc_ids=None, k=None):
    k = k or config.TOP_K
    data = load_matrix(collection_id)
    meta, matrix = data["meta"], data["matrix"]
    if not meta:
        return []
    allowed = None
    if doc_ids:
        allowed = {i for i, m in enumerate(meta) if m["doc_id"] in set(doc_ids)}
        if not allowed:
            return []
    qv = llm.embed_query(query)
    scores = matrix @ qv
    if allowed is not None:
        mask = np.full(len(meta), -1.0, dtype=np.float32)
        idx = np.fromiter(allowed, dtype=np.int64)
        mask[idx] = scores[idx]
        scores = mask
    order = np.argsort(-scores)[:30]
    vec_rank = {int(i): r for r, i in enumerate(order) if scores[i] > 0}

    by_id = {m["id"]: i for i, m in enumerate(meta)}
    kw_rank = {}
    fq = fts_query(query)
    if fq:
        try:
            rows = db.query(
                "SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT 30", (fq,)
            )
            for r, row in enumerate(rows):
                i = by_id.get(row["rowid"])
                if i is not None and (allowed is None or i in allowed):
                    kw_rank[i] = r
        except Exception:
            pass

    fused = {}
    for i, r in vec_rank.items():
        fused[i] = fused.get(i, 0) + 1.0 / (60 + r)
    for i, r in kw_rank.items():
        fused[i] = fused.get(i, 0) + 0.8 / (60 + r)
    ranked = sorted(fused.items(), key=lambda x: -x[1])[:k]
    out = []
    for n, (i, s) in enumerate(ranked, 1):
        m = meta[i]
        out.append({
            "n": n, "doc_id": m["doc_id"], "doc": m["doc"], "loc": m["loc"],
            "text": m["text"], "score": round(float(scores[i]), 4),
        })
    return out


SYSTEM = """You are Dars, a careful study assistant that answers strictly from the numbered sources provided.

Rules:
- Use only the sources. If they do not contain the answer, say so briefly and suggest what to ask or upload; never invent facts.
- Cite every claim with its source number in square brackets, like [1] or [2][3].
- Reply in the same language as the user's question. 
- Write clean Markdown: short paragraphs, lists where useful, **bold** for key terms, tables only when comparing.
- Write math in LaTeX between $ signs.
- Be precise and concise. Explain like a good tutor, not like a search engine."""


def question_language(text):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "English"
    arabic = sum(1 for c in letters if "\u0600" <= c <= "\u06ff")
    return "Arabic" if arabic / len(letters) > 0.3 else "English"


def build_context(sources):
    return "\n\n".join(f"[{s['n']}] ({s['doc']} - {s['loc']})\n{s['text']}" for s in sources)


def history_messages(collection_id, limit=6):
    rows = db.query(
        "SELECT role, content FROM messages WHERE collection_id=? ORDER BY id DESC LIMIT ?", (collection_id, limit)
    )
    return [{"role": r["role"], "content": r["content"][:2500]} for r in reversed(rows)]


def retrieval_text(collection_id, question):
    if len(question) < 70:
        prev = db.one("SELECT content FROM messages WHERE collection_id=? AND role='user' ORDER BY id DESC LIMIT 1", (collection_id,))
        if prev:
            return prev["content"][:300] + "\n" + question
    return question


def answer_stream(collection_id, question, doc_ids=None):
    sources = retrieve(collection_id, retrieval_text(collection_id, question), doc_ids)
    history = history_messages(collection_id)
    db.add_message(collection_id, "user", question)
    yield {"t": "sources", "data": sources}
    if not sources:
        text = "There are no ready files in this subject yet. Upload a file and I will read it right away."
        db.add_message(collection_id, "assistant", text)
        yield {"t": "tok", "d": text}
        yield {"t": "end"}
        return
    messages = [{"role": "system", "content": SYSTEM}]
    messages += history
    messages.append({"role": "user", "content": f"Sources:\n{build_context(sources)}\n\nWrite the answer in {question_language(question)}. Cite sources like [1].\nQuestion:\n{question}"})
    parts = []
    try:
        for piece in llm.chat_stream(messages):
            parts.append(piece)
            yield {"t": "tok", "d": piece}
    except Exception as e:
        parts.append("\n\nI could not finish the answer just now. Please try again.")
        yield {"t": "tok", "d": parts[-1]}
    db.add_message(collection_id, "assistant", "".join(parts), sources)
    yield {"t": "end"}


def sample_context(collection_id, doc_id=None, topic=None, limit_chars=22000):
    if topic:
        srcs = retrieve(collection_id, topic, [doc_id] if doc_id else None, k=14)
        return srcs
    data = load_matrix(collection_id)
    meta = [m for m in data["meta"] if not doc_id or m["doc_id"] == doc_id]
    if not meta:
        return []
    avg = max(len(m["text"]) for m in meta)
    take = max(6, min(len(meta), limit_chars // max(avg, 1)))
    idx = np.linspace(0, len(meta) - 1, take).astype(int)
    picked = [meta[i] for i in dict.fromkeys(idx.tolist())]
    return [{"n": n, "doc_id": m["doc_id"], "doc": m["doc"], "loc": m["loc"], "text": m["text"]} for n, m in enumerate(picked, 1)]


def parse_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start = min([i for i in (text.find("["), text.find("{")) if i != -1], default=-1)
    if start > 0:
        text = text[start:]
    end = max(text.rfind("]"), text.rfind("}"))
    return json.loads(text[: end + 1])


def study(collection_id, kind, doc_id=None, topic=None, count=8):
    sources = sample_context(collection_id, doc_id, topic)
    if not sources:
        raise ValueError("no ready documents")
    ctx = build_context(sources)
    lang_rule = "Write in English unless the sources are clearly in Arabic, in which case write in Arabic."
    if kind == "summary":
        prompt = (
            f"{lang_rule}\nWrite a structured study summary in Markdown: a one-paragraph overview, then headed sections "
            "with the key ideas, definitions, formulas and examples. Cite sources as [n]. Math in LaTeX between $ signs.\n\n"
            f"Sources:\n{ctx}"
        )
        text = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}], 0.2, "low")
        return {"kind": "summary", "markdown": text, "sources": sources}
    if kind == "quiz":
        prompt = (
            f"{lang_rule}\nCreate {count} multiple-choice questions that test real understanding of the sources. "
            'Return ONLY a JSON array of objects: {"q": str, "options": [4 strings], "answer": index 0-3, '
            '"explanation": str, "source": source number}. Make distractors plausible and vary the answer position.\n\n'
            f"Sources:\n{ctx}"
        )
        items = parse_json(llm.chat([{"role": "user", "content": prompt}], 0.5, "low"))
        items = [i for i in items if isinstance(i, dict) and len(i.get("options", [])) >= 2 and isinstance(i.get("answer"), int)]
        return {"kind": "quiz", "items": items, "sources": sources}
    if kind == "flashcards":
        prompt = (
            f"{lang_rule}\nCreate {count} flashcards covering the most important concepts, definitions and formulas. "
            'Return ONLY a JSON array of {"front": short question or term, "back": clear concise answer, "source": source number}.\n\n'
            f"Sources:\n{ctx}"
        )
        items = parse_json(llm.chat([{"role": "user", "content": prompt}], 0.4, "low"))
        items = [i for i in items if isinstance(i, dict) and i.get("front") and i.get("back")]
        return {"kind": "flashcards", "items": items, "sources": sources}
    raise ValueError("unknown study kind")
