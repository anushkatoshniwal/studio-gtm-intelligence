from app.scoring import ScoringResult, SourceType, score_signal

TEST_CASES: tuple[tuple[SourceType, str], ...] = (
    (
        "product",
        "Enterprise team returned every business day and converted to an annual plan.",
    ),
    (
        "customer",
        "Agency buyer said security review was required and expressed purchase intent.",
    ),
    (
        "market",
        "Competitor pricing could create risk for high-volume translation workflows.",
    ),
)


def validate_result(result: ScoringResult) -> None:
    for dimension in ("impact", "frequency", "urgency", "confidence"):
        score = result[dimension]
        assert isinstance(score, int)
        assert 1 <= score <= 5

    context_score = result["context_score"]
    assert isinstance(context_score, float)
    assert 0 <= context_score <= 100
    assert isinstance(result["reasoning"], str)
    assert result["reasoning"]


if __name__ == "__main__":
    for source_type, signal in TEST_CASES:
        first_result = score_signal(signal, source_type)
        second_result = score_signal(signal, source_type)
        assert first_result == second_result
        validate_result(first_result)
        print(f"{source_type}: {first_result}")

    print("All scoring checks passed.")
