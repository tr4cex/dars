import json
import sqlite3
import threading
import time

from . import config

_local = threading.local()
write_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hue INTEGER NOT NULL DEFAULT 28,
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    path TEXT,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    parts INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    loc TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB
);
CREATE INDEX IF NOT EXISTS idx_chunks_collection ON chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text, tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT,
    created REAL NOT NULL
);
"""


def conn():
    c = getattr(_local, "conn", None)
    if c is None:
        c = sqlite3.connect(config.DB_PATH, timeout=30)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        _local.conn = c
    return c


def init():
    c = conn()
    c.executescript(SCHEMA)
    c.execute("UPDATE documents SET status='error', error='interrupted' WHERE status IN ('queued','reading','embedding')")
    c.commit()


def query(sql, args=()):
    return [dict(r) for r in conn().execute(sql, args).fetchall()]


def one(sql, args=()):
    r = conn().execute(sql, args).fetchone()
    return dict(r) if r else None


def execute(sql, args=()):
    with write_lock:
        c = conn()
        cur = c.execute(sql, args)
        c.commit()
        return cur.lastrowid


def now():
    return time.time()


def add_message(collection_id, role, content, sources=None):
    return execute(
        "INSERT INTO messages(collection_id, role, content, sources, created) VALUES (?,?,?,?,?)",
        (collection_id, role, content, json.dumps(sources, ensure_ascii=False) if sources else None, now()),
    )


def delete_document_chunks(doc_id):
    with write_lock:
        c = conn()
        ids = [r[0] for r in c.execute("SELECT id FROM chunks WHERE doc_id=?", (doc_id,)).fetchall()]
        c.executemany("DELETE FROM chunks_fts WHERE rowid=?", [(i,) for i in ids])
        c.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))
        c.commit()


def insert_chunks(doc_id, collection_id, rows, embeddings):
    with write_lock:
        c = conn()
        for i, ((loc, text), emb) in enumerate(zip(rows, embeddings)):
            cur = c.execute(
                "INSERT INTO chunks(doc_id, collection_id, idx, loc, text, embedding) VALUES (?,?,?,?,?,?)",
                (doc_id, collection_id, i, loc, text, emb.astype("float32").tobytes()),
            )
            c.execute("INSERT INTO chunks_fts(rowid, text) VALUES (?,?)", (cur.lastrowid, text))
        c.commit()


def get_setting(key, default):
    r = one("SELECT value FROM settings WHERE key=?", (key,))
    if r is None:
        return default
    try:
        return type(default)(r["value"])
    except Exception:
        return default


def set_setting(key, value):
    execute("INSERT INTO settings(key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
