#!/bin/sh
# Fetch the CUDA build of PyTorch only when Maia is set to use the GPU.
# The image ships the small CPU build; the CUDA one (about 3 GB) is cached in
# /data so it downloads once, on the first start with HUMAN_MODEL_DEVICE=cuda.
set -eu

if [ "${HUMAN_MODEL_DEVICE:-cpu}" = "cuda" ]; then
    target=/data/runtime/torch-2.8.0-cu128
    if [ ! -f "$target/.complete" ]; then
        echo "Maia GPU: downloading CUDA PyTorch 2.8.0 (about 3 GB, first GPU start only)"
        rm -rf "$target.partial"
        mkdir -p /data/runtime
        # Keep shared dependencies at the image's locked versions.
        grep -v '^torch==' /app/requirements-human-cpu.lock > /tmp/torch-cuda-constraints.txt
        cat /app/requirements.lock >> /tmp/torch-cuda-constraints.txt
        pip install --no-cache-dir --disable-pip-version-check --quiet \
            --target "$target.partial" \
            --constraint /tmp/torch-cuda-constraints.txt \
            --index-url https://download.pytorch.org/whl/cu128 \
            --extra-index-url https://pypi.org/simple \
            torch==2.8.0
        touch "$target.partial/.complete"
        rm -rf "$target"
        mv "$target.partial" "$target"
    fi
    export PYTHONPATH="$target${PYTHONPATH:+:$PYTHONPATH}"
fi

exec "$@"
