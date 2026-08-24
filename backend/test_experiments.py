from pydantic import ValidationError

from app.experiments import GTMExperiment

EXPERIMENTS = (
    GTMExperiment(
        title="Creator activation checklist",
        hypothesis="A guided first-project checklist will increase creator activation.",
        source_signals=[
            "Creators reported uncertainty about the best source-audio format.",
            "First-project setup friction delayed initial dubbing exports.",
        ],
        target_segment="Creators",
        GTM_motion="Product-led onboarding",
        proposed_action="Show a five-step checklist during the first dubbing project.",
        primary_metric="First-project export rate (%)",
        baseline=42,
        target=55,
        estimated_cost=3000,
        estimated_return=12000,
        time_to_test_days=21,
        confidence=4,
        risks=["The checklist may add friction for experienced creators."],
        decision_rule="Roll out if export rate reaches 55% without reducing signup completion.",
    ),
    GTMExperiment(
        title="Agency localization bundle",
        hypothesis="Predictable bundled pricing will improve agency purchase conversion.",
        source_signals=[
            "Agencies objected to variable usage costs during campaign revisions.",
            "Agencies showed willingness to pay for predictable localization bundles.",
        ],
        target_segment="Media agencies",
        GTM_motion="Sales-assisted pilot",
        proposed_action="Offer a fixed-price, 30-day multilingual campaign bundle.",
        primary_metric="Pilot-to-paid conversion rate (%)",
        baseline=18,
        target=30,
        estimated_cost=7500,
        estimated_return=30000,
        time_to_test_days=45,
        confidence=3,
        risks=[
            "Heavy revision volume may reduce gross margin.",
            "The bundle may attract projects with unusually complex requirements.",
        ],
        decision_rule="Continue if conversion reaches 30% and gross margin remains above 60%.",
    ),
)


def expect_validation_error(**changes: object) -> None:
    experiment_data = EXPERIMENTS[0].model_dump()
    experiment_data.update(changes)
    try:
        GTMExperiment.model_validate(experiment_data)
    except ValidationError:
        return
    raise AssertionError(f"Expected validation to fail for: {changes}")


if __name__ == "__main__":
    assert len(EXPERIMENTS) == 2
    assert all(experiment.title for experiment in EXPERIMENTS)

    expect_validation_error(title="   ")
    expect_validation_error(source_signals=[])
    expect_validation_error(estimated_cost=-1)
    expect_validation_error(time_to_test_days=0)
    expect_validation_error(confidence=6)
    expect_validation_error(target=EXPERIMENTS[0].baseline)
    expect_validation_error(risks=["valid risk", "   "])

    print("Verified two representative GTM experiments and validation rules.")
