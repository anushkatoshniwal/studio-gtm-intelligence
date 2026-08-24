from pydantic import ValidationError

from app.recommendations import GTMRecommendation

VALID_RECOMMENDATION = {
    "opportunity_title": "Predictable agency localization bundle",
    "problem": "Campaign revision cycles make localization spend unpredictable.",
    "target_segment": "media_agency",
    "why_now": "Agency demand for regional campaign variants is increasing.",
    "evidence_summary": "Customer and market signals support testing bundled pricing.",
    "supporting_evidence": [
        "Agencies objected to variable usage costs during revisions.",
        "Agencies showed willingness to pay for predictable bundles.",
    ],
    "contradicting_evidence": [
        "Some small projects may remain better suited to usage pricing."
    ],
    "key_unknowns": ["Acceptable bundle size and gross-margin floor."],
    "recommended_gtm_motion": "Sales-assisted 30-day campaign pilot.",
    "experiment_title": "Agency localization bundle pilot",
    "experiment_hypothesis": "Predictable bundled pricing will increase paid conversion.",
    "expected_outcome": "Higher pilot-to-paid conversion without unacceptable margin loss.",
    "primary_metric": "Pilot-to-paid conversion rate",
    "reasoning": "The recommendation prioritizes direct pricing objections and purchase intent.",
    "evidence_confidence": 78,
    "claims": [
        {
            "claim": "Agencies reported difficulty forecasting revision costs.",
            "claim_type": "observed",
            "evidence_references": ["customer-signal:pricing-objection"],
        },
        {
            "claim": "A fixed bundle can preserve target gross margin.",
            "claim_type": "assumption",
            "evidence_references": [],
        },
        {
            "claim": "Bundled pricing will increase paid conversion.",
            "claim_type": "hypothesis",
            "evidence_references": ["market-signal:pricing-change"],
        },
    ],
}


def expect_validation_error(**changes: object) -> None:
    recommendation_data = {**VALID_RECOMMENDATION, **changes}
    try:
        GTMRecommendation.model_validate(recommendation_data)
    except ValidationError:
        return
    raise AssertionError(f"Expected recommendation validation to fail: {changes}")


if __name__ == "__main__":
    recommendation = GTMRecommendation.model_validate(VALID_RECOMMENDATION)
    assert {claim.claim_type for claim in recommendation.claims} == {
        "observed",
        "assumption",
        "hypothesis",
    }

    expect_validation_error(opportunity_title="   ")
    expect_validation_error(supporting_evidence=[])
    expect_validation_error(contradicting_evidence=[])
    expect_validation_error(evidence_confidence=-1)
    expect_validation_error(evidence_confidence=101)
    expect_validation_error(
        claims=[
            {
                "claim": "Invalid provenance",
                "claim_type": "inference",
                "evidence_references": [],
            }
        ]
    )
    expect_validation_error(
        claims=[
            {
                "claim": "Observed but unreferenced",
                "claim_type": "observed",
                "evidence_references": [],
            }
        ]
    )

    print("Verified GTM recommendation and claim provenance validation.")
