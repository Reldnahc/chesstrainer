# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci
COPY . .
RUN npm --prefix frontend run build

FROM python:3.12-slim-trixie AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    SERVER_HOST=0.0.0.0 SERVER_PORT=8000 DATABASE_PATH=/data/trainer.sqlite3 \
    STOCKFISH_PATH=/usr/games/stockfish ACCOUNTS_ENABLED=true SESSION_SECURE=true \
    HUMAN_MODEL_PATH=/data/models/maia3-79m.pt HF_HUB_OFFLINE=1
RUN apt-get update && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 fieldwork && useradd --uid 1000 --gid 1000 --no-create-home fieldwork \
    && mkdir /data && chown 1000:1000 /data
WORKDIR /app
COPY requirements.lock requirements-human-cpu.lock ./
# MAIA_RUNTIME=cpu (default) keeps the image small and runs anywhere. Build with
# --build-arg MAIA_RUNTIME=cuda for a CUDA 12.8 Torch, then run with a GPU and
# HUMAN_MODEL_DEVICE=cuda. The same human lock applies minus its CPU Torch pin.
ARG MAIA_RUNTIME=cpu
# Keep the large Torch layer reusable when application code or writing changes.
RUN if [ "$MAIA_RUNTIME" = "cuda" ]; then \
        grep -v '^torch==' requirements-human-cpu.lock > requirements-human.lock \
        && pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cu128; \
    elif [ "$MAIA_RUNTIME" = "cpu" ]; then \
        cp requirements-human-cpu.lock requirements-human.lock \
        && pip install --no-cache-dir --no-deps torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu; \
    else echo "MAIA_RUNTIME must be cpu or cuda" >&2; exit 1; fi \
    && pip install --no-cache-dir --constraint requirements.lock \
       --requirement requirements-human.lock
COPY pyproject.toml alembic.ini LICENSE NOTICE.md README.md ./
COPY backend ./backend
COPY migrations ./migrations
COPY scripts ./scripts
COPY docs ./docs
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN pip install --no-cache-dir --constraint requirements.lock \
       --constraint requirements-human.lock --editable '.[human]'
USER 1000:1000
EXPOSE 8000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/auth/me' % os.environ.get('SERVER_PORT', '8000'), timeout=4).close()"
CMD ["python", "-m", "trainer"]
