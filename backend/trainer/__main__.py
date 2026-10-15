import json
import logging

import uvicorn

from trainer import restart
from trainer.config import Settings

# Attributes every LogRecord has; anything else came from a call's ``extra``.
STANDARD = frozenset(vars(logging.LogRecord("", 0, "", 0, "", (), None))) | {"message", "asctime"}


class JSONFormatter(logging.Formatter):
    def format(self, record):
        result = {
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
        }
        for key, value in vars(record).items():
            if key not in STANDARD and key not in result:
                result[key] = value
        if record.exc_info:
            result["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            result["stack"] = self.formatStack(record.stack_info)
        return json.dumps(result, default=str)


def main():
    settings = Settings().for_runtime()
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])
    while True:
        # Each start rebuilds the app, which reloads server settings from the database.
        restart.server = uvicorn.Server(
            uvicorn.Config(
                "trainer.api:create_app",
                factory=True,
                host=settings.server_host,
                port=settings.server_port,
                workers=1,
            )
        )
        restart.requested = False
        restart.server.run()
        if not restart.requested:
            break
        logging.getLogger("trainer").info("Restarting with saved server settings")


if __name__ == "__main__":
    main()
