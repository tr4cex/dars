import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "dars.db"
STATIC_DIR = ROOT / "frontend"

DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


load_env()

API_KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEYS", "").split(",") if k.strip()]
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
CHAT_MODEL = os.environ.get("DARS_CHAT_MODEL", "gemini-3.1-flash-lite")
VISION_MODEL = os.environ.get("DARS_VISION_MODEL", CHAT_MODEL)
EMBED_MODEL = os.environ.get("DARS_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = 768

CHUNK_CHARS = 1000
CHUNK_OVERLAP = 160
TOP_K = 8
MAX_UPLOAD_MB = 80
OCR_WORKERS = 4

DEFAULT_SETTINGS = {"ocr_batch": 3, "ocr_scale": 2.0}
SETTING_LIMITS = {"ocr_batch": (1, 8), "ocr_scale": (1.0, 3.0)}
