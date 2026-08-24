from app.decision import decide_experiment
from app.economics import ExperimentAssumptions, calculate_experiment_economics

REFERENCE_ASSUMPTIONS = ExperimentAssumptions(
    qualified_accounts=500,
    current_conversion_rate=0.02,
    expected_conversion_rate=0.04,
    revenue_per_new_customer=100000,
    acquisition_cost=100000,
    pilot_cost=150000,
    fixed_team_execution_cost=50000,
)


def validate_result(result: dict[str, object]) -> None:
    assert result["decision"] in {"GO", "REVIEW", "NO-GO"}
    assert isinstance(result["reasons"], list) and result["reasons"]
    assert isinstance(result["risks"], list) and result["risks"]
    assert isinstance(result["recommended_pilot_size"], int)
    assert result["recommended_pilot_size"] >= 0


if __name__ == "__main__":
    reference_economics = calculate_experiment_economics(REFERENCE_ASSUMPTIONS)

    reference_result = decide_experiment(
        reference_economics,
        confidence=4,
        feasibility=4,
    )
    assert reference_result["decision"] == "GO"
    assert reference_result["recommended_pilot_size"] == 100
    validate_result(reference_result)

    strong_result = decide_experiment(
        reference_economics,
        confidence=5,
        feasibility=5,
    )
    assert strong_result["decision"] == "GO"
    validate_result(strong_result)

    weak_evidence_result = decide_experiment(
        reference_economics,
        confidence=2,
        feasibility=4,
    )
    assert weak_evidence_result["decision"] == "REVIEW"
    validate_result(weak_evidence_result)

    execution_review_result = decide_experiment(
        reference_economics,
        confidence=4,
        feasibility=2,
    )
    assert execution_review_result["decision"] == "REVIEW"
    validate_result(execution_review_result)

    negative_roi_economics = calculate_experiment_economics(
        ExperimentAssumptions(
            qualified_accounts=100,
            current_conversion_rate=0.10,
            expected_conversion_rate=0.12,
            revenue_per_new_customer=10000,
            acquisition_cost=40000,
            pilot_cost=40000,
            fixed_team_execution_cost=20000,
        )
    )
    negative_roi_result = decide_experiment(
        negative_roi_economics,
        confidence=5,
        feasibility=5,
    )
    assert negative_roi_result["decision"] == "NO-GO"
    assert negative_roi_result["recommended_pilot_size"] == 0
    validate_result(negative_roi_result)

    zero_lift_economics = calculate_experiment_economics(
        REFERENCE_ASSUMPTIONS.model_copy(update={"expected_conversion_rate": 0.02})
    )
    zero_lift_result = decide_experiment(
        zero_lift_economics,
        confidence=5,
        feasibility=5,
    )
    assert zero_lift_result["decision"] == "NO-GO"
    validate_result(zero_lift_result)

    break_even_economics = calculate_experiment_economics(
        REFERENCE_ASSUMPTIONS.model_copy(
            update={
                "acquisition_cost": 400000,
                "pilot_cost": 300000,
                "fixed_team_execution_cost": 300000,
            }
        )
    )
    break_even_result = decide_experiment(
        break_even_economics,
        confidence=5,
        feasibility=5,
    )
    assert break_even_result["decision"] == "NO-GO"
    assert break_even_result["reasons"][0] == (
        "Incremental revenue exactly covers incremental cost (0.0% ROI)."
    )
    validate_result(break_even_result)

    for invalid_rating in (0, 6):
        try:
            decide_experiment(
                reference_economics,
                confidence=invalid_rating,
                feasibility=4,
            )
        except ValueError:
            pass
        else:
            raise AssertionError("Expected invalid confidence to be rejected")

    print("Verified GO, REVIEW, negative-ROI, and zero-lift decisions.")
