from typing import Literal, TypedDict

SourceType = Literal["product", "customer", "market"]


class ScoringResult(TypedDict):
    impact: int
    frequency: int
    urgency: int
    confidence: int
    context_score: float
    reasoning: str


# Source baselines reflect the type of evidence each source normally provides.
SOURCE_BASELINES: dict[SourceType, dict[str, int]] = {
    "product": {"impact": 2, "frequency": 3, "urgency": 2, "confidence": 4},
    "customer": {"impact": 3, "frequency": 2, "urgency": 3, "confidence": 3},
    "market": {"impact": 3, "frequency": 2, "urgency": 2, "confidence": 2},
}

# A rule is applied once when any of its terms appear in the normalized signal.
SCORING_RULES: dict[str, tuple[tuple[str, tuple[str, ...], int], ...]] = {
    "impact": (
        (
            "commercial outcome",
            ("converted", "conversion", "purchase intent", "revenue", "churn"),
            2,
        ),
        (
            "strategic account or scale",
            ("enterprise", "annual plan", "largest client", "high-volume", "hundreds"),
            1,
        ),
        (
            "core workflow or quality",
            ("output quality", "accuracy", "dubbing", "translation", "voice", "workflow"),
            1,
        ),
    ),
    "frequency": (
        (
            "high-frequency behavior",
            ("daily", "every business day", "every week", "consecutive weeks"),
            2,
        ),
        (
            "repeat behavior",
            ("repeat", "returned", "weekly", "revisited", "multiple", "across"),
            1,
        ),
        (
            "one-time or early activity",
            ("signed up", "first session", "first project", "pilot"),
            -1,
        ),
    ),
    "urgency": (
        (
            "blocking requirement",
            ("blocked", "required", "requirement", "must", "security review", "deadline"),
            2,
        ),
        (
            "immediate commercial pressure",
            ("purchase intent", "churn", "launch", "pricing objection", "competitor"),
            1,
        ),
        (
            "friction or risk",
            ("friction", "unclear", "difficult", "concern", "risk", "missing"),
            1,
        ),
    ),
    "confidence": (
        (
            "observed product behavior",
            ("used", "completed", "created", "downloaded", "converted", "returned"),
            1,
        ),
        (
            "direct customer evidence",
            ("said", "reported", "requested", "asked", "expressed", "indicated"),
            1,
        ),
        (
            "quantified evidence",
            ("percent", "minutes", "days", "weeks", "monthly", "annual"),
            1,
        ),
        (
            "uncertain or projected claim",
            ("may", "might", "could", "expected", "forecast", "projected"),
            -1,
        ),
    ),
}

SCORE_WEIGHTS = {
    "impact": 0.35,
    "frequency": 0.25,
    "urgency": 0.25,
    "confidence": 0.15,
}


def _clamp(score: int) -> int:
    return max(1, min(5, score))


def score_signal(signal: str, source_type: SourceType) -> ScoringResult:
    """Score one GTM signal with deterministic, keyword-based rules."""
    if source_type not in SOURCE_BASELINES:
        raise ValueError("source_type must be 'product', 'customer', or 'market'")
    if not signal.strip():
        raise ValueError("signal must not be empty")

    normalized_signal = " ".join(signal.lower().split())
    scores = SOURCE_BASELINES[source_type].copy()
    matched_reasons: dict[str, list[str]] = {
        dimension: [] for dimension in SCORE_WEIGHTS
    }

    for dimension, rules in SCORING_RULES.items():
        for label, terms, adjustment in rules:
            matched_terms = [term for term in terms if term in normalized_signal]
            if matched_terms:
                scores[dimension] += adjustment
                matched_reasons[dimension].append(
                    f"{label} {adjustment:+d} ({', '.join(matched_terms)})"
                )

    scores = {dimension: _clamp(value) for dimension, value in scores.items()}
    weighted_average = sum(
        scores[dimension] * weight for dimension, weight in SCORE_WEIGHTS.items()
    )
    # Normalize the weighted 1–5 result so 1 maps to 0 and 5 maps to 100.
    context_score = round((weighted_average - 1) / 4 * 100, 1)

    dimension_summary = "; ".join(
        f"{dimension} {scores[dimension]} "
        f"({', '.join(matched_reasons[dimension]) or 'source baseline'})"
        for dimension in SCORE_WEIGHTS
    )

    reasoning = (
        f"Started from the {source_type} source baseline: {dimension_summary}. "
        f"Weighted result: {context_score}/100."
    )

    return {
        "impact": scores["impact"],
        "frequency": scores["frequency"],
        "urgency": scores["urgency"],
        "confidence": scores["confidence"],
        "context_score": context_score,
        "reasoning": reasoning,
    }
