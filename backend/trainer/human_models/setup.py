"""Explicit operator command; normal reviews never call model acquisition."""

import argparse
import os
import urllib.request
from pathlib import Path
from tempfile import NamedTemporaryFile

from trainer.config import Settings
from trainer.human_models.preset import MODEL, verify_checkpoint


def acquire(destination, *, opener=urllib.request.urlopen):
    destination = Path(destination)
    if destination.exists():
        verify_checkpoint(destination)
        return "already_verified"
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(dir=destination.parent, suffix=".partial", delete=False) as out:
            temporary = Path(out.name)
            url = f"https://huggingface.co/{MODEL['repo']}/resolve/{MODEL['revision']}/{MODEL['filename']}"
            received = 0
            with opener(url, timeout=60) as response:
                while chunk := response.read(1024 * 1024):
                    received += len(chunk)
                    if received > MODEL["bytes"]:
                        raise ValueError("Model download exceeded the pinned size")
                    out.write(chunk)
            out.flush()
            os.fsync(out.fileno())
        verify_checkpoint(temporary)
        # A concurrent setup may have completed while this download was running.
        if destination.exists():
            verify_checkpoint(destination)
        else:
            temporary.replace(destination)
        return "verified"
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path", type=Path, help="Override HUMAN_MODEL_PATH for this explicit setup"
    )
    parser.add_argument(
        "--verify-only", action="store_true", help="Validate the cached model without network"
    )
    args = parser.parse_args()
    path = args.path or Settings().human_model_path
    if args.verify_only:
        verify_checkpoint(path)
        print("Cached Maia-3 79M checkpoint matches its pinned SHA-256.")
    else:
        print(acquire(path))


if __name__ == "__main__":
    main()
