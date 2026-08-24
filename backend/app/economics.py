from pydantic import BaseModel, Field


class ExperimentAssumptions(BaseModel):
    qualified_accounts: int = Field(ge=1)
    current_conversion_rate: float = Field(ge=0, le=1)
    expected_conversion_rate: float = Field(ge=0, le=1)
    revenue_per_new_customer: float = Field(ge=0)
    expansion_consumption_revenue: float = Field(default=0, ge=0)
    acquisition_cost: float = Field(ge=0)
    pilot_cost: float = Field(ge=0)
    fixed_team_execution_cost: float = Field(ge=0)


class ExperimentEconomics(BaseModel):
    current_customers: float
    expected_customers: float
    incremental_customers: float
    baseline_revenue: float
    expected_revenue: float
    incremental_revenue: float
    total_incremental_cost: float
    incremental_roi: float | None
    break_even_incremental_customers: float | None
    break_even_expected_conversion_rate: float | None


def calculate_experiment_economics(
    assumptions: ExperimentAssumptions,
) -> ExperimentEconomics:
    """Calculate deterministic baseline and incremental experiment economics.

    Acquisition, pilot, and team/execution costs are flat incremental costs.
    Expansion or consumption revenue is incremental and does not affect the
    baseline. ROI is returned as a percentage and is undefined when total cost
    is zero.
    """
    current_customers = (
        assumptions.qualified_accounts * assumptions.current_conversion_rate
    )
    expected_customers = (
        assumptions.qualified_accounts * assumptions.expected_conversion_rate
    )
    incremental_customers = expected_customers - current_customers

    baseline_revenue = current_customers * assumptions.revenue_per_new_customer
    expected_revenue = (
        expected_customers * assumptions.revenue_per_new_customer
        + assumptions.expansion_consumption_revenue
    )
    incremental_revenue = expected_revenue - baseline_revenue

    total_incremental_cost = (
        assumptions.acquisition_cost
        + assumptions.pilot_cost
        + assumptions.fixed_team_execution_cost
    )
    incremental_roi = (
        (incremental_revenue - total_incremental_cost)
        / total_incremental_cost
        * 100
        if total_incremental_cost > 0
        else None
    )

    revenue_gap_after_expansion = max(
        total_incremental_cost - assumptions.expansion_consumption_revenue,
        0,
    )
    break_even_incremental_customers = (
        revenue_gap_after_expansion / assumptions.revenue_per_new_customer
        if assumptions.revenue_per_new_customer > 0
        else (0.0 if revenue_gap_after_expansion == 0 else None)
    )
    break_even_expected_conversion_rate = (
        (current_customers + break_even_incremental_customers)
        / assumptions.qualified_accounts
        if break_even_incremental_customers is not None
        else None
    )

    return ExperimentEconomics(
        current_customers=round(current_customers, 2),
        expected_customers=round(expected_customers, 2),
        incremental_customers=round(incremental_customers, 2),
        baseline_revenue=round(baseline_revenue, 2),
        expected_revenue=round(expected_revenue, 2),
        incremental_revenue=round(incremental_revenue, 2),
        total_incremental_cost=round(total_incremental_cost, 2),
        incremental_roi=(
            round(incremental_roi, 2) if incremental_roi is not None else None
        ),
        break_even_incremental_customers=(
            round(break_even_incremental_customers, 2)
            if break_even_incremental_customers is not None
            else None
        ),
        break_even_expected_conversion_rate=(
            round(break_even_expected_conversion_rate, 4)
            if break_even_expected_conversion_rate is not None
            else None
        ),
    )
