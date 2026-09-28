"""Private newline-JSON worker. It owns no database, accounts or network client."""

import json
import sys

from trainer.human_models.types import HumanRequest, ModelProvenance


def send(payload):
    print(json.dumps(payload, separators=(",", ":"), allow_nan=False), flush=True)


def main():
    try:
        configuration = json.loads(sys.stdin.readline(262144))
        from trainer.human_models.predictor import MaiaPredictor

        model = MaiaPredictor(
            configuration["checkpoint"], ModelProvenance.model_validate(configuration["provenance"])
        )
        send({"ready": True})
    except Exception:
        send({"error": "initialization_failed"})
        return 1
    while raw := sys.stdin.readline(262144):
        if not raw.endswith("\n"):
            send({"error": "request_too_large"})
            return 1
        try:
            request = HumanRequest.model_validate_json(raw)
            send({"policy": model.predict(request).model_dump(mode="json")})
        except Exception:
            send({"error": "prediction_failed"})
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
