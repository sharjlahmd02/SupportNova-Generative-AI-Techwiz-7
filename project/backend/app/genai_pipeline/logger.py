import logging
import json
from datetime import datetime
from typing import Dict, Any


class PipelineLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def log_analysis(self, complaint_id: int, prompt_version: str, model: str, output: Dict[str, Any]):
        self.logger.info(json.dumps({
            "event": "gemini_analysis",
            "complaint_id": complaint_id,
            "prompt_version": prompt_version,
            "model": model,
            "timestamp": datetime.utcnow().isoformat(),
            "output": output,
        }))

    def log_validation(self, complaint_id: int, output: Dict[str, Any]):
        self.logger.info(json.dumps({
            "event": "python_validation",
            "complaint_id": complaint_id,
            "timestamp": datetime.utcnow().isoformat(),
            "output": output,
        }))

    def log_comparison(self, complaint_id: int, diff: Dict[str, Any], status: str):
        self.logger.info(json.dumps({
            "event": "comparison",
            "complaint_id": complaint_id,
            "timestamp": datetime.utcnow().isoformat(),
            "diff": diff,
            "verification_status": status,
        }))

    def log_error(self, event: str, error: str, context: Dict[str, Any] = None):
        self.logger.error(json.dumps({
            "event": event,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
            "context": context or {},
        }))


pipeline_logger = PipelineLogger("supportnova.pipeline")