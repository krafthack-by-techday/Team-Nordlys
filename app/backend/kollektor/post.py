"""HTTP-poster mot STK-nodens /events/ingest med backoff og lokal disk-kø.

Hvis noden er nede, beholder vi events i en filkø og spiller dem av når
forbindelsen er tilbake. Det betyr at en kortvarig restart av noden ikke fører
til tap av OT-signaler — relevant for små peers som ikke har eksterne lagre."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path

import httpx

log = logging.getLogger("kollektor.post")


class IngestPoster:
    def __init__(
        self,
        ingest_url: str,
        ingest_key: str,
        queue_dir: str = "/tmp/stk-kollektor-queue",
        max_retries: int = 5,
    ):
        self.ingest_url = ingest_url.rstrip("/")
        self.ingest_key = ingest_key
        self.queue_dir = Path(queue_dir)
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries
        self._client = httpx.Client(timeout=5.0)
        self._lock = threading.Lock()

        threading.Thread(target=self._drain_loop, daemon=True).start()

    def send(self, payload: dict) -> bool:
        """POST a single event payload. On failure, queue locally and return False."""
        if self._post(payload):
            return True
        self._enqueue(payload)
        return False

    def _post(self, payload: dict) -> bool:
        try:
            resp = self._client.post(
                self.ingest_url,
                json=payload,
                headers={"X-Ingest-Key": self.ingest_key},
            )
            if resp.status_code == 201 or resp.status_code == 200:
                log.info(
                    "ingest ok scenario=%s severity=%s ref=%s",
                    payload.get("scenario_id"), payload.get("severity"),
                    payload.get("external_ref"),
                )
                return True
            if resp.status_code == 429:
                log.warning("rate-cap hit for scenario=%s — dropping", payload.get("scenario_id"))
                return True  # do not retry: cap exceeded is intentional drop
            log.warning("ingest non-2xx %s: %s", resp.status_code, resp.text)
            return False
        except Exception as e:
            log.warning("ingest failed: %s", e)
            return False

    def _enqueue(self, payload: dict) -> None:
        with self._lock:
            fname = self.queue_dir / f"{int(time.time()*1000)}-{os.getpid()}.json"
            fname.write_text(json.dumps(payload))

    def _drain_loop(self):
        while True:
            time.sleep(10)
            try:
                self._drain_once()
            except Exception as e:
                log.warning("drain error: %s", e)

    def _drain_once(self):
        with self._lock:
            files = sorted(self.queue_dir.glob("*.json"))
        for path in files:
            try:
                payload = json.loads(path.read_text())
            except Exception:
                path.unlink(missing_ok=True)
                continue
            if self._post(payload):
                path.unlink(missing_ok=True)
            else:
                # Stop draining for now; keep order. Try again next tick.
                return
