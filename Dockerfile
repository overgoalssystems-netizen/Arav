# Optional container image — works on Render, Railway, Fly.io, Cloud Run, a VPS, etc.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# install dependencies first (better layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

# then the app
COPY . .

EXPOSE 8000

# honour the platform's $PORT (Render, Railway, Cloud Run all set it)
CMD ["sh", "-c", "uvicorn app:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
