"""Pinned model metadata; importing this module never imports Torch or accesses the network."""

import hashlib
import json
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

from trainer.human_models.types import ModelProvenance

MANIFEST = Path(__file__).with_name("manifest.json")
PINS = json.loads(MANIFEST.read_text(encoding="utf-8"))
MODEL = PINS["models"]["79m"]
ADAPTER_VERSION = "maia-policy-1"


def provenance(settings):
    try:
        torch_version = version("torch")
    except PackageNotFoundError:
        torch_version = "unavailable"
    return ModelProvenance(
        provider="maia3",
        model="79m",
        model_revision=MODEL["revision"],
        checkpoint_sha256=MODEL["sha256"],
        code_revision=PINS["source_revision"],
        adapter_version=ADAPTER_VERSION,
        inference={
            "device": settings.human_model_device,
            "precision": "float32",
            "torch": torch_version,
            "threads": settings.human_model_threads,
            "history_window": 8,
            "policy": "complete-legal-softmax",
            "seed": 42,
        },
    )


def verify_checkpoint(path):
    path = Path(path)
    if not path.is_file():
        raise ValueError("checkpoint_missing")
    if path.stat().st_size != MODEL["bytes"]:
        raise ValueError("checkpoint_integrity")
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != MODEL["sha256"]:
            raise ValueError("checkpoint_integrity")


def verify_source():
    from trainer._vendor import maia3

    root = Path(maia3.__file__).parent
    for name in ("__init__.py", "models.py", "dataset.py", "utils.py"):
        # Git checkouts may translate LF to CRLF on Windows; pin the Git blob.
        canonical = (root / name).read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(canonical).hexdigest() != PINS["source_files"][name]:
            raise ValueError("source_integrity")
