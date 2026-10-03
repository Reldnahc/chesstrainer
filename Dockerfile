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
# Keep the large CPU runtime layer reusable when application code or writing changes.
RUN pip install --no-cache-dir --no-deps torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --constraint requirements.lock \
       --requirement requirements-human-cpu.lock
COPY pyproject.toml alembic.ini LICENSE NOTICE.md README.md ./
COPY backend ./backend
COPY migrations ./migrations
COPY scripts ./scripts
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/fieldwork-entrypoint
COPY docs ./docs
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN pip install --no-cache-dir --constraint requirements.lock \
       --constraint requirements-human-cpu.lock --editable '.[human]'
USER 1000:1000
EXPOSE 8000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/auth/me' % os.environ.get('SERVER_PORT', '8000'), timeout=4).close()"
# HUMAN_MODEL_DEVICE=cuda makes the entrypoint fetch CUDA PyTorch into /data once.
ENTRYPOINT ["fieldwork-entrypoint"]
CMD ["python", "-m", "trainer"]
