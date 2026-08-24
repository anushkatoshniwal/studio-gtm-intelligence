from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ClaimType = Literal["observed", "assumption", "hypothesis"]


class RecommendationClaim(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    claim: str
    claim_type: ClaimType
    evidence_references: list[str] = Field(default_factory=list)

    @field_validator("claim")
    @classmethod
    def claim_must_not_be_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("claim must not be empty")
        return value

    @field_validator("evidence_references")
    @classmethod
    def references_must_not_be_empty(cls, values: list[str]) -> list[str]:
        cleaned_values = [value.strip() for value in values]
        if any(not value for value in cleaned_values):
            raise ValueError("evidence references must not contain blank items")
        return cleaned_values

    @model_validator(mode="after")
    def observed_claim_requires_evidence(self) -> "RecommendationClaim":
        if self.claim_type == "observed" and not self.evidence_references:
            raise ValueError("observed claims require at least one evidence reference")
        return self


class GTMRecommendation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    opportunity_title: str
    problem: str
    target_segment: str
    why_now: str
    evidence_summary: str
    supporting_evidence: list[str] = Field(min_length=1)
    contradicting_evidence: list[str] = Field(min_length=1)
    key_unknowns: list[str] = Field(min_length=1)
    recommended_gtm_motion: str
    experiment_title: str
    experiment_hypothesis: str
    expected_outcome: str
    primary_metric: str
    reasoning: str
    evidence_confidence: float = Field(ge=0, le=100)
    claims: list[RecommendationClaim] = Field(min_length=1)

    @field_validator(
        "opportunity_title",
        "problem",
        "target_segment",
        "why_now",
        "evidence_summary",
        "recommended_gtm_motion",
        "experiment_title",
        "experiment_hypothesis",
        "expected_outcome",
        "primary_metric",
        "reasoning",
    )
    @classmethod
    def text_must_not_be_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("field must not be empty")
        return value

    @field_validator(
        "supporting_evidence",
        "contradicting_evidence",
        "key_unknowns",
    )
    @classmethod
    def list_items_must_not_be_empty(cls, values: list[str]) -> list[str]:
        cleaned_values = [value.strip() for value in values]
        if any(not value for value in cleaned_values):
            raise ValueError("list items must not be empty")
        return cleaned_values
