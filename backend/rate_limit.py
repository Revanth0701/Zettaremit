"""Bounded per-process throttling. Use a single API worker for the free demo."""
from collections import OrderedDict
from threading import Lock
from time import monotonic
from fastapi import HTTPException

class Limiter:
    def __init__(self):
        self.entries = OrderedDict()
        self.lock = Lock()

    def check(self, key, limit=10, seconds=60):
        now = monotonic()
        with self.lock:
            hits = [t for t in self.entries.pop(key, []) if t > now-seconds]
            if len(hits) >= limit:
                self.entries[key] = hits
                raise HTTPException(status_code=429, detail="Too many requests; try again later", headers={"Retry-After": str(seconds)})
            hits.append(now)
            self.entries[key] = hits
            while len(self.entries) > 10000:
                self.entries.popitem(last=False)

limiter = Limiter()
