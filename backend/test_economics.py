from pydantic import ValidationError

from app.economics import (
    ExperimentAssumptions,
    calculate_experiment_economics,
)


def test_reference_case() -> None:
    result = calculate_experiment_economics(
        ExperimentAssumptions(
            qualified_accounts=500,
            current_conversion_rate=0.02,
            expected_conversion_rate=0.04,
            revenue_per_new_customer=100000,
            acquisition_cost=100000,
            pilot_cost=150000,
            fixed_team_execution_cost=50000,
        )
    )

    assert result.current_customers == 10
    assert result.expected_customers == 20
    assert result.incremental_customers == 10
    assert result.baseline_revenue == 1000000
    assert result.expected_revenue == 2000000
    assert result.incremental_revenue == 1000000
    assert result.total_incremental_cost == 300000
    assert result.incremental_roi == 233.33
    assert result.break_even_incremental_customers == 3
    assert result.break_even_expected_conversion_rate == 0.026


def test_zero_lift_case() -> None:
    result = calculate_experiment_economics(
        ExperimentAssumptions(
            qualified_accounts=500,
            current_conversion_rate=0.02,
            expected_conversion_rate=0.02,
            revenue_per_new_customer=100000,
            acquisition_cost=100000,
            pilot_cost=150000,
            fixed_team_execution_cost=50000,
        )
    )

    assert result.current_customers == 10
    assert result.expected_customers == 10
    assert result.incremental_customers == 0
    assert result.incremental_revenue == 0
    assert result.total_incremental_cost == 300000
    assert result.incremental_roi == -100
    assert result.break_even_incremental_customers == 3
    assert result.break_even_expected_conversion_rate == 0.026


def test_negative_roi_case() -> None:
    result = calculate_experiment_economics(
        ExperimentAssumptions(
            qualified_accounts=100,
            current_conversion_rate=0.10,
            expected_conversion_rate=0.12,
            revenue_per_new_customer=10000,
            expansion_consumption_revenue=5000,
            acquisition_cost=40000,
            pilot_cost=40000,
            fixed_team_execution_cost=20000,
        )
    )

    assert result.current_customers == 10
    assert result.expected_customers == 12
    assert result.incremental_customers == 2
    assert result.baseline_revenue == 100000
    assert result.expected_revenue == 125000
    assert result.incremental_revenue == 25000
    assert result.total_incremental_cost == 100000
    assert result.incremental_roi == -75
    assert result.break_even_incremental_customers == 9.5
    assert result.break_even_expected_conversion_rate == 0.195


def expect_validation_error(**changes: object) -> None:
    valid_assumptions = {
        "qualified_accounts": 500,
        "current_conversion_rate": 0.02,
        "expected_conversion_rate": 0.04,
        "revenue_per_new_customer": 100000,
        "expansion_consumption_revenue": 0,
        "acquisition_cost": 100000,
        "pilot_cost": 150000,
        "fixed_team_execution_cost": 50000,
    }
    valid_assumptions.update(changes)

    try:
        ExperimentAssumptions.model_validate(valid_assumptions)
    except ValidationError:
        return
    raise AssertionError(f"Expected validation to fail for: {changes}")


if __name__ == "__main__":
    test_reference_case()
    test_zero_lift_case()
    test_negative_roi_case()
    expect_validation_error(qualified_accounts=0)
    expect_validation_error(current_conversion_rate=-0.01)
    expect_validation_error(expected_conversion_rate=1.01)
    expect_validation_error(revenue_per_new_customer=-1)
    expect_validation_error(expansion_consumption_revenue=-1)
    expect_validation_error(acquisition_cost=-1)
    print("Verified reference, zero-lift, and negative-ROI economics cases.")
