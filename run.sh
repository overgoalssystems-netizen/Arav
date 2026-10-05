#!/usr/bin/env bash
# Sarvam Vaani — one-command launcher
set -euo pipefail
cd "$(dirname "$0")"

# 1) create a virtual environment (once)
if [ ! -d ".venv" ]; then
  echo "› creating virtual environment…"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# 2) install dependencies
echo "› installing dependencies…"
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

# 3) make sure a .env exists
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "› created backend/.env — add your SARVAM_API_KEY to it for real AI replies."
fi

# 4) run
PORT="${PORT:-8000}"
echo "› Sarvam Vaani running at  http://localhost:${PORT}"
exec uvicorn app:app --app-dir backend --host 0.0.0.0 --port "${PORT}"
