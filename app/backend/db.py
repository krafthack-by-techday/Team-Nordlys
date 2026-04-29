import os
import sqlite3
import threading

DB_PATH = os.environ.get("DB_PATH", "/data/stk.db")

_local = threading.local()


def get_db() -> sqlite3.Connection:
    """Return a per-thread SQLite connection."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        _local.conn = conn
    return conn


def _column_names(db: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            company TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            severity TEXT DEFAULT 'medium',
            created_at TEXT NOT NULL,
            signature TEXT DEFAULT '',
            source TEXT DEFAULT 'manual',
            external_ref TEXT DEFAULT '',
            scenario_id TEXT DEFAULT ''
        )
    """)

    # Forward-compatible migration for existing databases.
    cols = _column_names(db, "events")
    for col in ("source", "external_ref", "scenario_id"):
        if col not in cols:
            default = "manual" if col == "source" else ""
            db.execute(f"ALTER TABLE events ADD COLUMN {col} TEXT DEFAULT '{default}'")

    db.execute("CREATE INDEX IF NOT EXISTS idx_events_external_ref ON events(source, external_ref)")
    db.commit()
