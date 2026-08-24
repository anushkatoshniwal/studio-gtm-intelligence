from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import CustomerSignal, MarketSignal, ProductSignal

VALID_SEGMENTS = {"creator", "media_agency", "enterprise", "other"}
EXPECTED_COUNTS = {
    ProductSignal: 30,
    CustomerSignal: 20,
    MarketSignal: 20,
}


if __name__ == "__main__":
    init_db()
    total_signals = 0

    with SessionLocal() as db:
        for model, expected_count in EXPECTED_COUNTS.items():
            records = db.scalars(select(model)).all()
            assert len(records) == expected_count
            total_signals += len(records)

            assert all(record.id for record in records)
            assert all(record.signal for record in records)
            assert all(record.source for record in records)
            assert all(record.created_at for record in records)
            assert all(record.segment in VALID_SEGMENTS for record in records)
            assert all(record.signal_type and record.signal_type != "other" for record in records)
            assert all(1 <= record.strength <= 5 for record in records)

    assert total_signals == 70
    print("Verified 70 enriched product, customer, and market signals.")
