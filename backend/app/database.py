from collections.abc import Generator
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "studio_gtm.db"
DATABASE_PATH = (
    Path(os.getenv("DATABASE_PATH", DEFAULT_DATABASE_PATH)).expanduser().resolve()
)
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _add_signal_metadata_columns()


def _add_signal_metadata_columns() -> None:
    table_names = ("product_signals", "customer_signals", "market_signals")
    column_definitions = {
        "segment": (
            "VARCHAR(50) NOT NULL DEFAULT 'other' "
            "CHECK (segment IN ('creator', 'media_agency', 'enterprise', 'other'))"
        ),
        "signal_type": "VARCHAR(100) NOT NULL DEFAULT 'other'",
        "strength": (
            "INTEGER NOT NULL DEFAULT 3 CHECK (strength BETWEEN 1 AND 5)"
        ),
    }

    with engine.begin() as connection:
        for table_name in table_names:
            existing_columns = {
                row[1]
                for row in connection.exec_driver_sql(
                    f"PRAGMA table_info({table_name})"
                )
            }
            for column_name, definition in column_definitions.items():
                if column_name not in existing_columns:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN {column_name} {definition}"
                    )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
