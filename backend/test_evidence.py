from pydantic import ValidationError

from app.evidence import EvidenceCluster, Opportunity

VALID_CLUSTER_DATA = {
    "title": "Predictable agency localization pricing",
    "summary": "Agency evidence points to demand for predictable campaign pricing.",
    "segment": "media_agency",
    "supporting_signals": [
        "Agencies objected to variable usage costs during revisions.",
        "Agencies showed willingness to pay for localization bundles.",
    ],
    "contradicting_signals": [
        "Some agencies preferred usage-based pricing for small projects."
    ],
    "evidence_strength": 78,
    "sources_used": ["customer", "market"],
    "key_unknowns": ["Acceptable bundle size and margin floor."],
    "opportunity": "Test a fixed-price multilingual campaign bundle.",
}


def expect_cluster_validation_error(**changes: object) -> None:
    cluster_data = {**VALID_CLUSTER_DATA, **changes}
    try:
        EvidenceCluster.model_validate(cluster_data)
    except ValidationError:
        return
    raise AssertionError(f"Expected EvidenceCluster validation to fail: {changes}")


if __name__ == "__main__":
    cluster = EvidenceCluster.model_validate(VALID_CLUSTER_DATA)
    opportunity = Opportunity(
        title="Agency localization bundle",
        problem="Campaign revision cycles make localization spend unpredictable.",
        target_segment="media_agency",
        evidence=[cluster],
        why_now="Agency localization demand is increasing across regional campaigns.",
        potential_gtm_motion="Sales-assisted 30-day campaign pilot.",
    )
    assert opportunity.evidence[0] == cluster

    expect_cluster_validation_error(title="   ")
    expect_cluster_validation_error(evidence_strength=-1)
    expect_cluster_validation_error(evidence_strength=101)
    expect_cluster_validation_error(supporting_signals=[])
    expect_cluster_validation_error(supporting_signals=["valid", "   "])

    try:
        Opportunity(
            title="Valid title",
            problem="   ",
            target_segment="media_agency",
            evidence=[cluster],
            why_now="Valid timing",
            potential_gtm_motion="Valid motion",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected blank Opportunity fields to be rejected")

    try:
        Opportunity(
            title="Valid title",
            problem="Valid problem",
            target_segment="media_agency",
            evidence=[],
            why_now="Valid timing",
            potential_gtm_motion="Valid motion",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected empty Opportunity evidence to be rejected")

    print("Verified EvidenceCluster and Opportunity validation rules.")
