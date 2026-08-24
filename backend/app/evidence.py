from pydantic import BaseModel, ConfigDict, Field, field_validator


class EvidenceCluster(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    summary: str
    segment: str
    supporting_signals: list[str] = Field(min_length=1)
    contradicting_signals: list[str]
    evidence_strength: float = Field(ge=0, le=100)
    sources_used: list[str] = Field(min_length=1)
    key_unknowns: list[str]
    opportunity: str

    @field_validator("title", "summary", "segment", "opportunity")
    @classmethod
    def text_must_not_be_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("field must not be empty")
        return value

    @field_validator(
        "supporting_signals",
        "contradicting_signals",
        "sources_used",
        "key_unknowns",
    )
    @classmethod
    def list_items_must_not_be_empty(cls, values: list[str]) -> list[str]:
        cleaned_values = [value.strip() for value in values]
        if any(not value for value in cleaned_values):
            raise ValueError("list items must not be empty")
        return cleaned_values


class Opportunity(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    problem: str
    target_segment: str
    evidence: list[EvidenceCluster] = Field(min_length=1)
    why_now: str
    potential_gtm_motion: str

    @field_validator(
        "title",
        "problem",
        "target_segment",
        "why_now",
        "potential_gtm_motion",
    )
    @classmethod
    def text_must_not_be_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("field must not be empty")
        return value
