from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import MarketSignal

SYNTHETIC_MARKET_SIGNALS = [
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic market brief: A global video platform launched expanded Indic-language discovery features, increasing demand for localized creator content.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic competitor watch: A well-funded dubbing competitor introduced a low-cost creator plan with bundled monthly video minutes.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic competitor watch: A general-purpose voice vendor reduced its focus on Indian languages, creating room for a specialized regional offering.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic pricing update: A competing speech platform cut translation API prices by 25 percent for high-volume enterprise contracts.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic pricing update: Media agencies showed growing willingness to pay for predictable localization bundles instead of per-minute billing.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic pricing trend: Independent creators reported subscription fatigue and increased preference for free or pay-as-you-go editing tools.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic product launch: A major learning platform introduced multilingual course publishing, expanding the addressable market for rapid dubbing workflows.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic product launch: A large design suite added basic voice translation directly inside its video editor, raising the convenience bar for standalone tools.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic use-case signal: Regional ecommerce sellers began using localized product videos to improve conversion outside major metro markets.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic use-case signal: Customer support teams increased demand for speech-to-text analysis across Hindi and mixed-language calls.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic use-case risk: Buyers expressed concern that generated voices may not preserve emotion well enough for premium entertainment content.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic creator trend: Regional-language channels grew faster than English-only channels in several education and finance content categories.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic creator trend: Short-form creators increasingly expected dubbing and captions to be included in their existing editing subscriptions.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic enterprise trend: Learning and development teams expanded pilots for AI-assisted localization of onboarding and compliance material.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic enterprise trend: Security, data residency, and model-governance reviews extended procurement cycles for generative audio products.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic enterprise opportunity: Banks and insurers sought consistent multilingual narration for customer education and internal training.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic adoption risk: Enterprise buyers required measurable accuracy benchmarks before moving speech workflows beyond limited pilots.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic market opportunity: Media agencies lacked a shared review workflow for approving pronunciation and tone across regional campaign variants.",
    },
    {
        "source": "synthetic-demo-market:positive",
        "signal": "Synthetic market opportunity: Mid-sized businesses showed unmet demand for an integrated translation, dubbing, captioning, and export workflow.",
    },
    {
        "source": "synthetic-demo-market:negative",
        "signal": "Synthetic market risk: Rapid improvements in bundled platform features could compress margins for undifferentiated speech and translation tools.",
    },
]


def enrich_market_signal(record: dict[str, str]) -> dict[str, str | int]:
    signal = record["signal"].lower()

    if any(term in signal for term in ("creator", "channels")):
        segment = "creator"
    elif any(term in signal for term in ("media agencies", "agency", "campaign")):
        segment = "media_agency"
    elif any(term in signal for term in ("enterprise", "banks", "insurers", "learning and development")):
        segment = "enterprise"
    else:
        segment = "other"

    if "competitor watch" in signal:
        signal_type, strength = "competitor_move", 4
    elif "pricing" in signal:
        signal_type, strength = "pricing_change", 4
    elif "product launch" in signal:
        signal_type, strength = "new_product_launch", 4
    elif "use-case" in signal:
        signal_type, strength = "emerging_use_case", 3
    elif "creator trend" in signal:
        signal_type, strength = "creator_economy_trend", 4
    elif "enterprise trend" in signal or "enterprise opportunity" in signal:
        signal_type, strength = "enterprise_ai_adoption", 4
    elif "market opportunity" in signal or "market brief" in signal:
        signal_type, strength = "market_opportunity", 5
    else:
        signal_type, strength = "market_risk", 4

    return {
        **record,
        "segment": segment,
        "signal_type": signal_type,
        "strength": strength,
    }


def seed_market_signals() -> int:
    init_db()

    with SessionLocal() as db:
        existing_signals = {
            record.signal: record
            for record in db.scalars(
                select(MarketSignal).where(
                    MarketSignal.source.like("synthetic-demo-market:%")
                )
            ).all()
        }
        inserted = 0
        for seed_record in SYNTHETIC_MARKET_SIGNALS:
            enriched_record = enrich_market_signal(seed_record)
            existing_record = existing_signals.get(seed_record["signal"])
            if existing_record is None:
                db.add(MarketSignal(**enriched_record))
                inserted += 1
            else:
                existing_record.segment = str(enriched_record["segment"])
                existing_record.signal_type = str(enriched_record["signal_type"])
                existing_record.strength = int(enriched_record["strength"])

        db.commit()
        return inserted


if __name__ == "__main__":
    inserted = seed_market_signals()
    print(f"Inserted {inserted} synthetic demo market signals.")
