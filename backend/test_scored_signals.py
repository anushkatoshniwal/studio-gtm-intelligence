from collections import Counter

from app.database import SessionLocal, init_db
from app.main import get_scored_signals
from app.scoring import SourceType, score_signal

EXPECTED_FIELDS = {
    "source",
    "signal",
    "created_at",
    "impact",
    "frequency",
    "urgency",
    "confidence",
    "context_score",
    "reasoning",
}


if __name__ == "__main__":
    init_db()

    with SessionLocal() as db:
        results = get_scored_signals(db)

    assert len(results) == 70
    assert Counter(result["source"] for result in results) == {
        "product": 30,
        "customer": 20,
        "market": 20,
    }
    assert all(set(result) == EXPECTED_FIELDS for result in results)
    assert all(
        float(results[index - 1]["context_score"])
        >= float(results[index]["context_score"])
        for index in range(1, len(results))
    )

    for result in results:
        source_type: SourceType = result["source"]  # type: ignore[assignment]
        expected_scores = score_signal(str(result["signal"]), source_type)
        for field, expected_value in expected_scores.items():
            assert result[field] == expected_value

    print("Verified 70 correctly scored signals in descending context-score order.")
