# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
RUN apt-get update && apt-get install -y --no-install-recommends python3 git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci
COPY . .
# Build the downloadable corresponding source from the public-only build context.
# This temporary repository never enters the runtime image.
RUN git init --quiet && git add . \
    && SOURCE_PYTHON=python3 npm --prefix frontend run build

FROM python:3.12-slim-trixie AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    SERVER_HOST=0.0.0.0 SERVER_PORT=8000 DATABASE_PATH=/data/trainer.sqlite3 \
    STOCKFISH_PATH=/usr/games/stockfish ACCOUNTS_ENABLED=true SESSION_SECURE=true
RUN apt-get update && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 fieldwork && useradd --uid 1000 --gid 1000 --no-create-home fieldwork \
    && mkdir /data && chown 1000:1000 /data
WORKDIR /app
COPY pyproject.toml requirements.lock alembic.ini LICENSE NOTICE.md README.md ./
COPY backend ./backend
COPY migrations ./migrations
COPY scripts ./scripts
COPY docs ./docs
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN pip install --no-cache-dir --constraint requirements.lock --editable .
USER 1000:1000
EXPOSE 8000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/auth/me', timeout=4).close()"
CMD ["python", "-m", "trainer"]
