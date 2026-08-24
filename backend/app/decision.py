from math import ceil
from typing import Literal, TypedDict

from app.economics import ExperimentEconomics

Decision = Literal["GO", "REVIEW", "NO-GO"]

MIN_ATTRACTIVE_INCREMENTAL_ROI = 50.0
MIN_MEANINGFUL_CONVERSION_CUSHION = 0.10
MIN_COMFORTABLE_CONVERSION_CUSHION = 0.25
MIN_STRONG_CONFIDENCE = 4
MIN_STRONG_FEASIBILITY = 4


class DecisionResult(TypedDict):
    decision: Decision
    reasons: list[str]
    risks: list[str]
    recommended_pilot_size: int


def decide_experiment(
    economics: ExperimentEconomics,
    confidence: int,
    feasibility: int,
) -> DecisionResult:
    """Evaluate incremental economics, evidence, and execution with fixed rules."""
    _validate_rating("confidence", confidence)
    _validate_rating("feasibility", feasibility)

    conversion_cushion = _conversion_cushion(economics)
    has_economic_failure = (
        (
            economics.incremental_roi is not None
            and economics.incremental_roi < 0
        )
        or economics.incremental_customers <= 0
        or (
            conversion_cushion is not None
            and conversion_cushion <= MIN_MEANINGFUL_CONVERSION_CUSHION
        )
    )

    has_attractive_economics = (
        economics.incremental_roi is not None
        and economics.incremental_roi >= MIN_ATTRACTIVE_INCREMENTAL_ROI
        and economics.incremental_customers > 0
        and conversion_cushion is not None
        and conversion_cushion >= MIN_COMFORTABLE_CONVERSION_CUSHION
    )
    has_sufficient_evidence = confidence >= MIN_STRONG_CONFIDENCE
    has_feasible_execution = feasibility >= MIN_STRONG_FEASIBILITY

    if has_economic_failure:
        decision: Decision = "NO-GO"
    elif (
        has_attractive_economics
        and has_sufficient_evidence
        and has_feasible_execution
    ):
        decision = "GO"
    else:
        decision = "REVIEW"

    reasons = [
        _roi_reason(economics.incremental_roi),
        _customer_reason(economics.incremental_customers),
        _conversion_reason(economics, conversion_cushion),
        _evidence_execution_reason(confidence, feasibility),
    ]
    risks = _build_risks(economics, confidence, feasibility, conversion_cushion)
    recommended_pilot_size = _recommend_pilot_size(economics, decision)

    return {
        "decision": decision,
        "reasons": reasons,
        "risks": risks,
        "recommended_pilot_size": recommended_pilot_size,
    }


def _validate_rating(name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 5:
        raise ValueError(f"{name} must be an integer from 1 to 5")


def _conversion_cushion(economics: ExperimentEconomics) -> float | None:
    """Return how far expected conversion sits above break-even, proportionally."""
    if (
        economics.break_even_expected_conversion_rate is None
        or economics.break_even_incremental_customers is None
    ):
        return None

    break_even_customers = (
        economics.current_customers + economics.break_even_incremental_customers
    )
    if break_even_customers == 0:
        return float("inf") if economics.expected_customers > 0 else 0.0
    return (
        economics.expected_customers - break_even_customers
    ) / break_even_customers


def _roi_reason(incremental_roi: float | None) -> str:
    if incremental_roi is None:
        return "Incremental ROI is undefined because incremental cost is zero."
    if incremental_roi >= MIN_ATTRACTIVE_INCREMENTAL_ROI:
        return f"Incremental ROI is attractive at {incremental_roi:.1f}%."
    if incremental_roi > 0:
        return f"Incremental ROI is positive at {incremental_roi:.1f}% but below the 50% GO threshold."
    if incremental_roi == 0:
        return "Incremental revenue exactly covers incremental cost (0.0% ROI)."
    return f"Incremental ROI is negative at {incremental_roi:.1f}%."


def _customer_reason(incremental_customers: float) -> str:
    if incremental_customers > 0:
        return f"The hypothesis adds {incremental_customers:.2f} expected customers."
    return f"The hypothesis adds {incremental_customers:.2f} customers, so there is no positive lift."


def _conversion_reason(
    economics: ExperimentEconomics,
    conversion_cushion: float | None,
) -> str:
    break_even_rate = economics.break_even_expected_conversion_rate
    if break_even_rate is None or conversion_cushion is None:
        return "Break-even expected conversion cannot be assessed."
    if conversion_cushion == float("inf"):
        return "Expected conversion is above a zero break-even requirement."
    return (
        f"Expected conversion volume is {conversion_cushion:.1%} above the "
        f"{break_even_rate:.1%} break-even conversion rate."
    )


def _evidence_execution_reason(confidence: int, feasibility: int) -> str:
    if confidence >= MIN_STRONG_CONFIDENCE and feasibility >= MIN_STRONG_FEASIBILITY:
        return f"Evidence confidence and execution feasibility are both sufficient at {confidence}/5 and {feasibility}/5."
    return f"Evidence confidence is {confidence}/5 and execution feasibility is {feasibility}/5, requiring review."


def _build_risks(
    economics: ExperimentEconomics,
    confidence: int,
    feasibility: int,
    conversion_cushion: float | None,
) -> list[str]:
    risks: list[str] = []
    if economics.incremental_roi is None or economics.incremental_roi < MIN_ATTRACTIVE_INCREMENTAL_ROI:
        risks.append("Incremental returns may not provide enough margin for cost or revenue variance.")
    if conversion_cushion is None or conversion_cushion < MIN_COMFORTABLE_CONVERSION_CUSHION:
        risks.append("Expected conversion is too close to, or cannot be compared with, break-even.")
    if confidence < MIN_STRONG_CONFIDENCE:
        risks.append("Evidence confidence is not yet strong enough for a full rollout.")
    if feasibility < MIN_STRONG_FEASIBILITY:
        risks.append("Execution constraints could prevent the hypothesis from being tested reliably.")
    if economics.incremental_customers <= 0:
        risks.append("The hypothesis does not create positive incremental customer lift.")
    if not risks:
        risks.append("Cost overruns or weaker-than-expected conversion could reduce incremental ROI.")
    return risks[:4]


def _recommend_pilot_size(
    economics: ExperimentEconomics,
    decision: Decision,
) -> int:
    if decision == "NO-GO":
        return 0

    qualified_accounts = _infer_qualified_accounts(economics)
    if qualified_accounts is None:
        fallback_size = ceil(max(economics.expected_customers * 5, 10))
        return min(fallback_size, 100)

    pilot_fraction = 0.20 if decision == "GO" else 0.10
    pilot_size = max(1, ceil(qualified_accounts * pilot_fraction))
    return min(pilot_size, ceil(qualified_accounts), 100)


def _infer_qualified_accounts(economics: ExperimentEconomics) -> float | None:
    if (
        economics.break_even_expected_conversion_rate is None
        or economics.break_even_expected_conversion_rate <= 0
        or economics.break_even_incremental_customers is None
    ):
        return None
    break_even_customers = (
        economics.current_customers + economics.break_even_incremental_customers
    )
    return break_even_customers / economics.break_even_expected_conversion_rate
