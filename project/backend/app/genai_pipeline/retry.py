import time
import logging
from typing import Callable, TypeVar, Optional

T = TypeVar("T")
logger = logging.getLogger(__name__)


def retry_with_backoff(
    func: Callable[[], T],
    max_retries: int = 2,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
) -> Optional[T]:
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries:
                logger.error(f"All retries exhausted for {func.__name__}: {e}")
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            time.sleep(delay)
    return None