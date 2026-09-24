from typing import List, Dict, Any
import numpy as np


def get_embedding(text: str) -> List[float]:
    # TODO: use sentence-transformers or similar to generate embeddings
    # For now, return dummy embedding
    return [0.0] * 384


def cosine_similarity(a: List[float], b: List[float]) -> float:
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))