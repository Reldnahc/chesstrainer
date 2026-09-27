"""Export public OpenAPI without opening a database, running workers or engines."""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from trainer.api import create_app
from trainer.config import Settings

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "backend/tests/fixtures/api_contract.json"


def public_schema(app):
    schema = app.openapi()
    schema["info"]["title"] = "Fieldwork API"
    schema["paths"] = {
        path: operations for path, operations in schema["paths"].items() if path.startswith("/api/")
    }
    return schema


def contract():
    # Hosted mode includes authentication endpoints in addition to the shared
    # routes. Explicit settings prevent the export from using a developer's .env.
    with TemporaryDirectory(prefix="fieldwork-contract-") as directory:
        settings = Settings(
            _env_file=None,
            database_path=Path(directory) / "unused.sqlite3",
            accounts_enabled=True,
            public_origin="https://contract.invalid",
            stockfish_path="unused-contract-engine",
        )
        app = create_app(settings, workers=False, start_engine=False)
        return public_schema(app)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Fail if the checked-in schema is stale"
    )
    args = parser.parse_args()
    document = json.dumps(contract(), indent=2, sort_keys=True) + "\n"
    if args.check:
        if not DESTINATION.exists() or DESTINATION.read_text(encoding="utf-8") != document:
            raise SystemExit("API schema is stale. Run python scripts/export_api_contract.py.")
        print("API schema matches the backend.")
    else:
        DESTINATION.write_text(document, encoding="utf-8")
        print(f"Exported {DESTINATION.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
