from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class GTMExperiment(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    hypothesis: str
    source_signals: list[str] = Field(min_length=1)
    target_segment: str
    GTM_motion: str
    proposed_action: str
    primary_metric: str
    baseline: float = Field(ge=0)
    target: float = Field(ge=0)
    estimated_cost: float = Field(ge=0)
    estimated_return: float = Field(ge=0)
    time_to_test_days: int = Field(ge=1, le=365)
    confidence: int = Field(ge=1, le=5)
    risks: list[str] = Field(min_length=1)
    decision_rule: str

    @field_validator(
        "title",
        "hypothesis",
        "target_segment",
        "GTM_motion",
        "proposed_action",
        "primary_metric",
        "decision_rule",
    )
    @classmethod
    def text_must_not_be_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("field must not be empty")
        return value

    @field_validator("source_signals", "risks")
    @classmethod
    def list_items_must_not_be_empty(cls, values: list[str]) -> list[str]:
        cleaned_values = [value.strip() for value in values]
        if any(not value for value in cleaned_values):
            raise ValueError("list items must not be empty")
        return cleaned_values

    @model_validator(mode="after")
    def target_must_change_baseline(self) -> "GTMExperiment":
        if self.target == self.baseline:
            raise ValueError("target must differ from baseline")
        return self
