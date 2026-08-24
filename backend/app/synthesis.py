from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.evidence import EvidenceCluster, Opportunity
from app.models import CustomerSignal, MarketSignal, ProductSignal

SourceType = Literal["product", "customer", "market"]

THEME_MAP = {
    "signup": "activation",
    "activation": "activation",
    "activation_friction": "activation",
    "repeat_usage": "adoption_retention",
    "usage_intensity": "adoption_retention",
    "creator_economy_trend": "adoption_retention",
    "enterprise_ai_adoption": "adoption_retention",
    "conversion": "conversion_purchase",
    "purchase_intent": "conversion_purchase",
    "pricing_objection": "conversion_purchase",
    "pricing_change": "conversion_purchase",
    "market_opportunity": "conversion_purchase",
    "dubbing_usage": "localization_workflow",
    "translation_usage": "localization_workflow",
    "text_to_speech_usage": "localization_workflow",
    "speech_to_text_usage": "localization_workflow",
    "project_creation": "localization_workflow",
    "output_quality": "localization_workflow",
    "missing_capability": "localization_workflow",
    "emerging_use_case": "localization_workflow",
    "new_product_launch": "localization_workflow",
    "enterprise_requirement": "enterprise_readiness",
    "competitor_move": "competitive_pressure",
    "market_risk": "competitive_pressure",
}

THEME_TITLES = {
    "activation": "Activation and first-value friction",
    "adoption_retention": "Repeat adoption and retention",
    "conversion_purchase": "Commercial conversion and purchase intent",
    "localization_workflow": "Multilingual production workflow",
    "enterprise_readiness": "Enterprise readiness requirements",
    "competitive_pressure": "Competitive and market pressure",
}

PROBLEM_STATEMENTS = {
    "activation": "Users may not reach first value quickly or consistently.",
    "adoption_retention": "Repeat usage must translate into durable adoption.",
    "conversion_purchase": "Commercial intent may not convert under the current offer and pricing.",
    "localization_workflow": "Localization workflows remain fragmented or difficult to control.",
    "enterprise_readiness": "Enterprise adoption depends on security, governance, and administration capabilities.",
    "competitive_pressure": "Market alternatives may reduce differentiation or pricing power.",
}

GTM_MOTIONS = {
    "activation": "Product-led onboarding experiment",
    "adoption_retention": "Lifecycle retention campaign",
    "conversion_purchase": "Segmented offer and pricing pilot",
    "localization_workflow": "Workflow-led solution pilot",
    "enterprise_readiness": "Sales-assisted enterprise readiness pilot",
    "competitive_pressure": "Positioning and differentiation test",
}


@dataclass(frozen=True)
class SynthesisSignal:
    source_type: SourceType
    signal: str
    source: str
    segment: str
    signal_type: str
    strength: int
    created_at: datetime


def synthesize_evidence(
    db: Session,
    as_of: datetime | None = None,
) -> tuple[list[EvidenceCluster], list[Opportunity]]:
    """Build deterministic evidence clusters and opportunities from all signals."""
    signals = _load_signals(db)
    effective_as_of = as_of or datetime.now()
    grouped_signals: dict[tuple[str, str], list[SynthesisSignal]] = defaultdict(list)

    for signal in signals:
        theme = THEME_MAP.get(signal.signal_type, signal.signal_type)
        grouped_signals[(signal.segment, theme)].append(signal)

    clusters: list[EvidenceCluster] = []
    opportunities: list[Opportunity] = []

    for (segment, theme), grouped in sorted(grouped_signals.items()):
        supporting = [signal for signal in grouped if not _is_contradicting(signal)]
        contradicting = [signal for signal in grouped if _is_contradicting(signal)]
        independent_support = _deduplicate_signals(supporting)

        if len(independent_support) < 2:
            continue

        evidence_strength, strength_summary = _calculate_evidence_strength(
            independent_support,
            contradicting,
            effective_as_of,
        )
        sources_used = sorted(
            {signal.source_type for signal in independent_support + contradicting}
        )
        key_unknowns = _identify_unknowns(
            independent_support,
            contradicting,
            sources_used,
            effective_as_of,
        )
        theme_title = THEME_TITLES.get(theme, theme.replace("_", " ").title())
        segment_title = segment.replace("_", " ").title()
        opportunity_text = f"Test a {theme_title.lower()} opportunity for {segment_title}."

        cluster = EvidenceCluster(
            title=f"{segment_title}: {theme_title}",
            summary=(
                f"{len(independent_support)} independent supporting signals across "
                f"{len(set(signal.source_type for signal in independent_support))} "
                f"source type(s). {strength_summary}"
            ),
            segment=segment,
            supporting_signals=[signal.signal for signal in independent_support],
            contradicting_signals=[signal.signal for signal in contradicting],
            evidence_strength=evidence_strength,
            sources_used=sources_used,
            key_unknowns=key_unknowns,
            opportunity=opportunity_text,
        )
        clusters.append(cluster)
        opportunities.append(
            Opportunity(
                title=f"{segment_title} {theme_title}",
                problem=PROBLEM_STATEMENTS.get(
                    theme,
                    f"The evidence indicates an unresolved {theme_title.lower()} problem.",
                ),
                target_segment=segment,
                evidence=[cluster],
                why_now=(
                    f"The cluster has {evidence_strength:.1f}/100 evidence strength "
                    f"from {len(sources_used)} source type(s)."
                ),
                potential_gtm_motion=GTM_MOTIONS.get(
                    theme,
                    "Focused segment pilot",
                ),
            )
        )

    return clusters, opportunities


def _load_signals(db: Session) -> list[SynthesisSignal]:
    signals: list[SynthesisSignal] = []
    model_sources = (
        ("product", ProductSignal),
        ("customer", CustomerSignal),
        ("market", MarketSignal),
    )

    for source_type, model in model_sources:
        records = db.scalars(select(model)).all()
        signals.extend(
            SynthesisSignal(
                source_type=source_type,
                signal=record.signal,
                source=record.source or "unknown",
                segment=record.segment,
                signal_type=record.signal_type,
                strength=record.strength,
                created_at=record.created_at,
            )
            for record in records
        )

    return signals


def _is_contradicting(signal: SynthesisSignal) -> bool:
    return signal.source_type == "market" and signal.source.endswith(":negative")


def _deduplicate_signals(signals: list[SynthesisSignal]) -> list[SynthesisSignal]:
    unique_signals: dict[str, SynthesisSignal] = {}
    for signal in signals:
        unique_signals.setdefault(signal.signal, signal)
    return list(unique_signals.values())


def _calculate_evidence_strength(
    supporting: list[SynthesisSignal],
    contradicting: list[SynthesisSignal],
    as_of: datetime,
) -> tuple[float, str]:
    average_strength = sum(signal.strength for signal in supporting) / len(supporting)
    strength_component = average_strength / 5 * 35
    count_component = min(len(supporting), 8) / 8 * 25
    source_count = len({signal.source_type for signal in supporting})
    diversity_component = source_count / 3 * 25
    recency_component = sum(
        _recency_score(signal.created_at, as_of) for signal in supporting
    ) / len(supporting) * 15
    contradiction_penalty = min(
        len(contradicting) / (len(supporting) + len(contradicting)) * 15,
        15,
    )

    score = round(
        max(
            0,
            min(
                100,
                strength_component
                + count_component
                + diversity_component
                + recency_component
                - contradiction_penalty,
            ),
        ),
        1,
    )
    summary = (
        f"Strength combines signal quality {strength_component:.1f}/35, "
        f"count {count_component:.1f}/25, diversity {diversity_component:.1f}/25, "
        f"recency {recency_component:.1f}/15, and a "
        f"{contradiction_penalty:.1f}-point contradiction penalty."
    )
    return score, summary


def _recency_score(created_at: datetime, as_of: datetime) -> float:
    age_days = max((as_of - created_at).total_seconds() / 86400, 0)
    return max(0, 1 - age_days / 90)


def _identify_unknowns(
    supporting: list[SynthesisSignal],
    contradicting: list[SynthesisSignal],
    sources_used: list[str],
    as_of: datetime,
) -> list[str]:
    unknowns: list[str] = []
    if len({signal.source_type for signal in supporting}) < 2:
        unknowns.append("Independent confirmation from another source type is missing.")
    if len(supporting) < 4:
        unknowns.append("More independent signals are needed to validate the pattern.")
    if not contradicting:
        unknowns.append("No contradicting evidence has been captured yet.")
    if all(_recency_score(signal.created_at, as_of) < 0.5 for signal in supporting):
        unknowns.append("The supporting evidence needs a more recent validation signal.")
    if len(sources_used) < 3:
        unknowns.append("The cluster does not yet include all three signal source types.")
    return unknowns
