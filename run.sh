#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Add your Gemini API key(s) to it, then run ./run.sh again."
  exit 1
fi
PORT="${PORT:-8000}"
echo "Dars is starting on http://localhost:${PORT}"
exec python3 -m uvicorn backend.app:app --host 127.0.0.1 --port "$PORT"
