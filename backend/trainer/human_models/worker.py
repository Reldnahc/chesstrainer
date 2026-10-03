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
            payload = json.loads(raw)
            if isinstance(payload, dict) and "batch" in payload:
                requests = [HumanRequest.model_validate(item) for item in payload["batch"]]
                policies = model.predict_many(requests)
                send({"policies": [policy.model_dump(mode="json") for policy in policies]})
            else:
                request = HumanRequest.model_validate(payload)
                send({"policy": model.predict(request).model_dump(mode="json")})
        except Exception:
            send({"error": "prediction_failed"})
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
