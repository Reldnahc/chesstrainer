import json
import logging

import uvicorn

from trainer.config import Settings


class JSONFormatter(logging.Formatter):
    def format(self, record):
        result = {
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
        }
        for key in ["job_id", "decision_id", "engine", "error_type", "game_index"]:
            if hasattr(record, key):
                result[key] = getattr(record, key)
        return json.dumps(result)


def main():
    settings = Settings()
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])
    uvicorn.run(
        "trainer.api:create_app",
        factory=True,
        host=settings.server_host,
        port=settings.server_port,
        workers=1,
    )


if __name__ == "__main__":
    main()
