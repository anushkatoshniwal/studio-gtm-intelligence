from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db, init_db
from app.decision import Decision, decide_experiment
from app.economics import (
    ExperimentAssumptions,
    ExperimentEconomics,
    calculate_experiment_economics,
)
from app.models import CustomerSignal, MarketSignal, ProductSignal
from app.scoring import SourceType, score_signal
from app.synthesis import synthesize_evidence


class ExperimentSimulationRequest(BaseModel):
    qualified_accounts: int = Field(ge=1)
    current_conversion_rate: float = Field(ge=0, le=1)
    expected_conversion_rate: float = Field(ge=0, le=1)
    revenue_per_customer: float = Field(ge=0)
    acquisition_cost: float = Field(ge=0)
    pilot_cost: float = Field(ge=0)
    fixed_team_cost: float = Field(ge=0)
    expansion_revenue_per_customer: float = Field(default=0, ge=0)
    evidence_confidence: int = Field(ge=1, le=5)
    feasibility: int = Field(ge=1, le=5)


class ExperimentSimulationResponse(ExperimentEconomics):
    decision: Decision
    reasons: list[str]
    risks: list[str]
    recommended_pilot_size: int


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Studio GTM Intelligence API", lifespan=lifespan)

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/signals/product")
def get_product_signals(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    records = db.scalars(
        select(ProductSignal).order_by(
            ProductSignal.created_at.desc(),
            ProductSignal.id.desc(),
        )
    ).all()

    return [
        {
            "id": record.id,
            "signal": record.signal,
            "source": record.source,
            "created_at": record.created_at,
        }
        for record in records
    ]


@app.get("/signals/customer")
def get_customer_signals(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    records = db.scalars(
        select(CustomerSignal).order_by(
            CustomerSignal.created_at.desc(),
            CustomerSignal.id.desc(),
        )
    ).all()

    return [
        {
            "id": record.id,
            "signal": record.signal,
            "source": record.source,
            "created_at": record.created_at,
        }
        for record in records
    ]


@app.get("/signals/market")
def get_market_signals(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    records = db.scalars(
        select(MarketSignal).order_by(
            MarketSignal.created_at.desc(),
            MarketSignal.id.desc(),
        )
    ).all()

    return [
        {
            "id": record.id,
            "signal": record.signal,
            "source": record.source,
            "created_at": record.created_at,
        }
        for record in records
    ]


@app.get("/signals/scored")
def get_scored_signals(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    scored_signals: list[dict[str, object]] = []
    signal_sources: tuple[
        tuple[SourceType, type[ProductSignal] | type[CustomerSignal] | type[MarketSignal]],
        ...,
    ] = (
        ("product", ProductSignal),
        ("customer", CustomerSignal),
        ("market", MarketSignal),
    )

    for source_type, model in signal_sources:
        records = db.scalars(select(model)).all()
        for record in records:
            scores = score_signal(record.signal, source_type)
            scored_signals.append(
                {
                    "source": source_type,
                    "signal": record.signal,
                    "created_at": record.created_at,
                    **scores,
                }
            )

    return sorted(
        scored_signals,
        key=lambda record: float(record["context_score"]),
        reverse=True,
    )


@app.get("/intelligence/context")
def get_intelligence_context(db: Session = Depends(get_db)) -> dict[str, object]:
    signals_by_source: dict[str, list[dict[str, object]]] = {
        "product": [],
        "customer": [],
        "market": [],
    }
    scored_signals: list[dict[str, object]] = []
    timestamps = []
    signal_sources: tuple[
        tuple[SourceType, type[ProductSignal] | type[CustomerSignal] | type[MarketSignal]],
        ...,
    ] = (
        ("product", ProductSignal),
        ("customer", CustomerSignal),
        ("market", MarketSignal),
    )

    for source_type, model in signal_sources:
        records = db.scalars(
            select(model).order_by(model.created_at.desc(), model.id.desc())
        ).all()
        for record in records:
            signal_metadata = {
                "source": source_type,
                "source_label": record.source,
                "segment": record.segment,
                "signal_type": record.signal_type,
                "signal_strength": record.strength,
                "signal": record.signal,
                "timestamp": record.created_at,
            }
            signals_by_source[source_type].append(signal_metadata)
            scored_signals.append(
                {
                    **signal_metadata,
                    **score_signal(record.signal, source_type),
                }
            )
            timestamps.append(record.created_at)

    snapshot_at = max(timestamps)
    clusters, opportunities = synthesize_evidence(db, as_of=snapshot_at)
    cluster_payloads = [
        {
            **cluster.model_dump(exclude={"key_unknowns"}),
            "unknowns": cluster.key_unknowns,
        }
        for cluster in clusters
    ]
    scored_signals.sort(
        key=lambda record: (
            -float(record["context_score"]),
            str(record["source"]),
            str(record["signal"]),
        )
    )

    return {
        "snapshot_at": snapshot_at,
        "signal_count": sum(len(records) for records in signals_by_source.values()),
        "signals_by_source": signals_by_source,
        "scored_signals": scored_signals,
        "evidence_clusters": cluster_payloads,
        "opportunities": [opportunity.model_dump() for opportunity in opportunities],
    }


@app.post("/experiments/simulate", response_model=ExperimentSimulationResponse)
def simulate_experiment(
    request: ExperimentSimulationRequest,
) -> ExperimentSimulationResponse:
    economics_assumptions = ExperimentAssumptions(
        qualified_accounts=request.qualified_accounts,
        current_conversion_rate=request.current_conversion_rate,
        expected_conversion_rate=request.expected_conversion_rate,
        revenue_per_new_customer=request.revenue_per_customer,
        acquisition_cost=request.acquisition_cost,
        pilot_cost=request.pilot_cost,
        fixed_team_execution_cost=request.fixed_team_cost,
    )
    economics = calculate_experiment_economics(economics_assumptions)

    if request.expansion_revenue_per_customer > 0:
        expansion_revenue = (
            max(economics.incremental_customers, 0)
            * request.expansion_revenue_per_customer
        )
        economics = calculate_experiment_economics(
            economics_assumptions.model_copy(
                update={"expansion_consumption_revenue": expansion_revenue}
            )
        )

    decision_result = decide_experiment(
        economics,
        confidence=request.evidence_confidence,
        feasibility=request.feasibility,
    )
    return ExperimentSimulationResponse(
        **economics.model_dump(),
        decision=decision_result["decision"],
        reasons=decision_result["reasons"],
        risks=decision_result["risks"],
        recommended_pilot_size=decision_result["recommended_pilot_size"],
    )
