import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, db, extractors, rag

app = FastAPI(title="Dars")
pool = ThreadPoolExecutor(max_workers=2)

HUES = [28, 160, 340, 48, 205, 268, 12, 120]


@app.on_event("startup")
def startup():
    db.init()


class CollectionIn(BaseModel):
    name: str


class UrlIn(BaseModel):
    url: str


class ChatIn(BaseModel):
    question: str
    doc_ids: list[int] | None = None


class StudyIn(BaseModel):
    kind: str
    doc_id: int | None = None
    topic: str | None = None
    count: int = 8


def collection_or_404(cid):
    c = db.one("SELECT * FROM collections WHERE id=?", (cid,))
    if not c:
        raise HTTPException(404, "Subject not found")
    return c


def public_doc(d):
    return {k: d[k] for k in ("id", "collection_id", "name", "kind", "size", "source_url", "status", "stage", "progress", "error", "parts", "chunk_count", "created")}


class SettingsIn(BaseModel):
    ocr_batch: int | None = None
    ocr_scale: float | None = None


def current_settings():
    return {k: db.get_setting(k, v) for k, v in config.DEFAULT_SETTINGS.items()}


@app.get("/api/settings")
def get_settings():
    return {"values": current_settings(), "limits": config.SETTING_LIMITS}


@app.put("/api/settings")
def put_settings(body: SettingsIn):
    for k, v in body.model_dump(exclude_none=True).items():
        lo, hi = config.SETTING_LIMITS[k]
        db.set_setting(k, max(lo, min(hi, v)))
    return {"values": current_settings(), "limits": config.SETTING_LIMITS}


@app.get("/api/formats")
def formats():
    return extractors.FORMATS


@app.get("/api/health")
def health():
    return {"ok": True, "keys": len(config.API_KEYS), "chat_model": config.CHAT_MODEL, "embed_model": config.EMBED_MODEL}


@app.get("/api/collections")
def list_collections():
    rows = db.query(
        "SELECT c.*, "
        "(SELECT COUNT(*) FROM documents d WHERE d.collection_id=c.id) AS docs, "
        "(SELECT COUNT(*) FROM documents d WHERE d.collection_id=c.id AND d.status='ready') AS ready "
        "FROM collections c ORDER BY c.created DESC"
    )
    return rows


@app.post("/api/collections")
def create_collection(body: CollectionIn):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(400, "Name is required")
    n = db.one("SELECT COUNT(*) AS n FROM collections")["n"]
    cid = db.execute("INSERT INTO collections(name, hue, created) VALUES (?,?,?)", (name, HUES[n % len(HUES)], db.now()))
    return db.one("SELECT * FROM collections WHERE id=?", (cid,))


@app.patch("/api/collections/{cid}")
def rename_collection(cid: int, body: CollectionIn):
    collection_or_404(cid)
    db.execute("UPDATE collections SET name=? WHERE id=?", (body.name.strip()[:80], cid))
    return db.one("SELECT * FROM collections WHERE id=?", (cid,))


@app.delete("/api/collections/{cid}")
def delete_collection(cid: int):
    collection_or_404(cid)
    for d in db.query("SELECT id, path FROM documents WHERE collection_id=?", (cid,)):
        db.delete_document_chunks(d["id"])
        if d["path"]:
            Path(d["path"]).unlink(missing_ok=True)
    db.execute("DELETE FROM documents WHERE collection_id=?", (cid,))
    db.execute("DELETE FROM messages WHERE collection_id=?", (cid,))
    db.execute("DELETE FROM collections WHERE id=?", (cid,))
    rag.invalidate(cid)
    return {"ok": True}


@app.get("/api/collections/{cid}/documents")
def list_documents(cid: int):
    collection_or_404(cid)
    return [public_doc(d) for d in db.query("SELECT * FROM documents WHERE collection_id=? ORDER BY created DESC", (cid,))]


def register_document(cid, name, path, source_url=None):
    kind = extractors.kind_of(path)
    if kind is None:
        path.unlink(missing_ok=True)
        raise HTTPException(415, f"Unsupported file type: {path.suffix or name}")
    size = path.stat().st_size
    if size > config.MAX_UPLOAD_MB * 1024 * 1024:
        path.unlink(missing_ok=True)
        raise HTTPException(413, f"File is larger than {config.MAX_UPLOAD_MB} MB")
    did = db.execute(
        "INSERT INTO documents(collection_id, name, kind, size, path, source_url, status, stage, created) VALUES (?,?,?,?,?,?,?,?,?)",
        (cid, name, kind, size, str(path), source_url, "queued", "Queued", db.now()),
    )
    pool.submit(rag.ingest, did)
    return public_doc(db.one("SELECT * FROM documents WHERE id=?", (did,)))


def safe_name(name):
    name = Path(name).name
    return re.sub(r"[^\w؀-ۿ.\- ]+", "_", name)[:120] or "file"


@app.post("/api/collections/{cid}/upload")
async def upload(cid: int, files: list[UploadFile] = File(...)):
    collection_or_404(cid)
    out, errors = [], []
    for f in files:
        name = safe_name(f.filename or "file")
        path = config.UPLOAD_DIR / f"{uuid.uuid4().hex[:10]}_{name}"
        with path.open("wb") as w:
            while True:
                block = await f.read(1024 * 1024)
                if not block:
                    break
                w.write(block)
        try:
            out.append(register_document(cid, name, path))
        except HTTPException as e:
            errors.append({"name": name, "error": e.detail})
    return {"documents": out, "errors": errors}


@app.post("/api/collections/{cid}/url")
def add_url(cid: int, body: UrlIn):
    collection_or_404(cid)
    url = body.url.strip()
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "Enter a full link starting with http or https")
    try:
        name, path = extractors.fetch_url(url, config.UPLOAD_DIR)
    except Exception as e:
        raise HTTPException(400, f"Could not fetch that link: {str(e)[:120]}")
    unique = config.UPLOAD_DIR / f"{uuid.uuid4().hex[:10]}_{safe_name(path.name)}"
    path.rename(unique)
    return register_document(cid, name, unique, url)


@app.get("/api/documents/{did}")
def get_document(did: int):
    d = db.one("SELECT * FROM documents WHERE id=?", (did,))
    if not d:
        raise HTTPException(404, "File not found")
    return public_doc(d)


@app.get("/api/documents/{did}/text")
def document_text(did: int):
    d = db.one("SELECT * FROM documents WHERE id=?", (did,))
    if not d:
        raise HTTPException(404, "File not found")
    rows = db.query("SELECT loc, text FROM chunks WHERE doc_id=? ORDER BY idx", (did,))
    return {"doc": public_doc(d), "chunks": rows}


@app.post("/api/documents/{did}/retry")
def retry_document(did: int):
    d = db.one("SELECT * FROM documents WHERE id=?", (did,))
    if not d:
        raise HTTPException(404, "File not found")
    db.execute("UPDATE documents SET status='queued', stage='Queued', progress=0, error=NULL WHERE id=?", (did,))
    pool.submit(rag.ingest, did)
    return {"ok": True}


@app.delete("/api/documents/{did}")
def delete_document(did: int):
    d = db.one("SELECT * FROM documents WHERE id=?", (did,))
    if not d:
        raise HTTPException(404, "File not found")
    db.delete_document_chunks(did)
    db.execute("DELETE FROM documents WHERE id=?", (did,))
    if d["path"]:
        Path(d["path"]).unlink(missing_ok=True)
    rag.invalidate(d["collection_id"])
    return {"ok": True}


@app.get("/api/collections/{cid}/messages")
def messages(cid: int):
    collection_or_404(cid)
    rows = db.query("SELECT id, role, content, sources, created FROM messages WHERE collection_id=? ORDER BY id", (cid,))
    for r in rows:
        r["sources"] = json.loads(r["sources"]) if r["sources"] else []
    return rows


@app.delete("/api/collections/{cid}/messages")
def clear_messages(cid: int):
    collection_or_404(cid)
    db.execute("DELETE FROM messages WHERE collection_id=?", (cid,))
    return {"ok": True}


@app.post("/api/collections/{cid}/chat")
def chat(cid: int, body: ChatIn):
    collection_or_404(cid)
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Ask something first")

    def gen():
        try:
            for ev in rag.answer_stream(cid, question[:4000], body.doc_ids):
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"t": "error", "d": str(e)[:200]}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache"})


@app.post("/api/collections/{cid}/study")
def study(cid: int, body: StudyIn):
    collection_or_404(cid)
    try:
        return rag.study(cid, body.kind, body.doc_id, body.topic, max(3, min(body.count, 20)))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"The model could not build this right now: {str(e)[:120]}")


@app.middleware("http")
async def no_cache_assets(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/assets") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(Exception)
def on_error(_, exc):
    return JSONResponse({"detail": str(exc)[:200]}, status_code=500)


app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets", check_dir=False), name="assets")


@app.get("/")
def index():
    return FileResponse(config.STATIC_DIR / "index.html")
