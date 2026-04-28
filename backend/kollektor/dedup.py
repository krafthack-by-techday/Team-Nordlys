"""Lokal dedup-cache. Hindrer at samme syslog-burst sendes flere ganger
til noden ved retry, og at gjentatte aggregeringer av samme nøkkel/vindu
genererer duplikat-events lokalt før noden får sjansen til å idempotens-sjekke."""

from __future__ import annotations

import threading
import time
from collections import OrderedDict


class LRUDedup:
    def __init__(self, max_entries: int = 4096, ttl_seconds: int = 600):
        self._max = max_entries
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._items: "OrderedDict[str, float]" = OrderedDict()

    def seen(self, key: str) -> bool:
        """Return True if the key was seen within TTL. Records the key as a side effect."""
        now = time.time()
        with self._lock:
            self._evict(now)
            if key in self._items:
                self._items.move_to_end(key)
                self._items[key] = now
                return True
            self._items[key] = now
            if len(self._items) > self._max:
                self._items.popitem(last=False)
            return False

    def _evict(self, now: float) -> None:
        cutoff = now - self._ttl
        while self._items:
            key, ts = next(iter(self._items.items()))
            if ts < cutoff:
                self._items.popitem(last=False)
            else:
                break
