from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    # Serverless Postgres closes idle connections; check each one before use.
    pool_pre_ping=not settings.database_url.startswith("sqlite"),
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    if settings.database_url.startswith("sqlite"):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# The audit log is append-only at the database level, not just in application code.
_APPEND_ONLY_TRIGGERS = [
    """CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
       BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END""",
    """CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
       BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END""",
    # create_all() does not add indexes to tables that already exist (databases made before it).
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_audit_events_prev_hash ON audit_events (prev_hash)",
]


# Same append-only rule for Postgres (used on hosts without a persistent disk, e.g. Vercel + Neon).
_PG_APPEND_ONLY = [
    """CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$
       BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS audit_no_change ON audit_events",
    """CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_events
       FOR EACH ROW EXECUTE FUNCTION audit_events_append_only()""",
]


# Columns added after the first release. create_all() only creates missing tables, so
# databases made earlier get these columns added here (all nullable, nothing is lost).
_ADDED_COLUMNS = {
    "analyses": {"readiness": "JSON", "incident_id": "VARCHAR(20)"},
    "risks": {"materialized_by": "VARCHAR(20)"},
    "incidents": {"reporter_name": "VARCHAR(100)", "resolution": "TEXT"},
}


def _add_missing_columns(conn) -> None:
    for table, columns in _ADDED_COLUMNS.items():
        existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        if not existing:
            continue  # table does not exist yet; create_all() makes it with every column
        for name, sql_type in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))


def init_db() -> None:
    from app.models import tables  # noqa: F401  (registers tables on Base)
    from app.seed import seed_systems

    Base.metadata.create_all(engine)
    if settings.database_url.startswith("sqlite"):
        with engine.begin() as conn:
            _add_missing_columns(conn)
            for stmt in _APPEND_ONLY_TRIGGERS:
                conn.execute(text(stmt))
    elif engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            for stmt in _PG_APPEND_ONLY:
                conn.execute(text(stmt))
    seed_systems()


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
