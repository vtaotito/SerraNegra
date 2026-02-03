import json
import logging
import os
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": os.getenv("SERVICE_NAME", "wms-core"),
            "message": record.getMessage(),
        }
        # extras comuns
        for key in (
            "correlationId",
            "requestId",
            "orderId",
            "eventType",
            "sapDocEntry",
        ):
            if hasattr(record, key):
                base[key] = getattr(record, key)
        if record.exc_info:
            base["error"] = self.formatException(record.exc_info)
        return json.dumps(base, ensure_ascii=False)


def configure_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    root = logging.getLogger()
    root.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)

