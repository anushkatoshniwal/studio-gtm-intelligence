from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import CustomerSignal

SYNTHETIC_CUSTOMER_SIGNALS = [
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator said the first-project setup felt unclear because they did not know which source audio format would produce the best dub.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator reported that aligning generated speech with fast-paced short-form video required several manual retries.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator liked the Hindi output quality but noticed inconsistent pronunciation of English brand names in Tamil dubbing.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator asked for a simple pronunciation editor to correct names without regenerating the entire voiceover.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator felt the paid plan was difficult to justify until their channel generated reliable sponsorship revenue.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator said they return to Sarvam Studio every week because regional-language versions consistently increase watch time.",
    },
    {
        "source": "synthetic-demo-call:creator",
        "signal": "Creator expressed strong purchase intent if a lower-volume plan included dubbing, captions, and reusable voice settings.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency editor said activation slowed down because client reviewers could not comment directly on specific moments in an output.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency producer rated voice naturalness highly for narration but wanted more control over emotion in advertising copy.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency team requested shared pronunciation libraries so approved client terminology could be reused across campaigns.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency buyer objected to usage-based pricing because campaign revisions made monthly costs difficult to forecast.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency reported repeat weekly use for regional campaign variants across three active consumer brands.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency operations lead asked for client workspaces, reviewer roles, and project-level access controls.",
    },
    {
        "source": "synthetic-demo-call:media-agency",
        "signal": "Agency said it would purchase an annual plan after completing a successful multilingual launch for its largest client.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise learning team said procurement and security review created more activation friction than the product setup itself.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise reviewer found training narration clear but required consistent pronunciation across hundreds of technical terms.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise administrator required single sign-on, audit logs, role-based access, and regional data-handling documentation.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise buyer requested predictable annual pricing with committed usage rather than variable monthly billing.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise pilot team reported daily repeat usage while localizing onboarding and compliance modules.",
    },
    {
        "source": "synthetic-demo-call:enterprise",
        "signal": "Enterprise sponsor indicated purchase intent after security approval if the pilot met accuracy and turnaround targets.",
    },
]


def enrich_customer_signal(record: dict[str, str]) -> dict[str, str | int]:
    signal = record["signal"].lower()
    segment = record["source"].split(":", 1)[1].replace("media-agency", "media_agency")

    if "purchase intent" in signal or "would purchase" in signal:
        signal_type, strength = "purchase_intent", 5
    elif any(term in signal for term in ("single sign-on", "audit logs", "role-based", "security review")):
        signal_type, strength = "enterprise_requirement", 5
    elif any(term in signal for term in ("pricing", "paid plan", "monthly costs", "annual pricing")):
        signal_type, strength = "pricing_objection", 4
    elif any(term in signal for term in ("return", "repeat", "weekly", "daily")):
        signal_type, strength = "repeat_usage", 4
    elif any(term in signal for term in ("quality", "naturalness", "pronunciation", "emotion")):
        signal_type, strength = "output_quality", 4
    elif any(term in signal for term in ("asked for", "requested", "could not comment", "control")):
        signal_type, strength = "missing_capability", 4
    else:
        signal_type, strength = "activation_friction", 3

    return {
        **record,
        "segment": segment,
        "signal_type": signal_type,
        "strength": strength,
    }


def seed_customer_signals() -> int:
    init_db()

    with SessionLocal() as db:
        existing_signals = {
            record.signal: record
            for record in db.scalars(
                select(CustomerSignal).where(
                    CustomerSignal.source.like("synthetic-demo-call:%")
                )
            ).all()
        }
        inserted = 0
        for seed_record in SYNTHETIC_CUSTOMER_SIGNALS:
            enriched_record = enrich_customer_signal(seed_record)
            existing_record = existing_signals.get(seed_record["signal"])
            if existing_record is None:
                db.add(CustomerSignal(**enriched_record))
                inserted += 1
            else:
                existing_record.segment = str(enriched_record["segment"])
                existing_record.signal_type = str(enriched_record["signal_type"])
                existing_record.strength = int(enriched_record["strength"])

        db.commit()
        return inserted


if __name__ == "__main__":
    inserted = seed_customer_signals()
    print(f"Inserted {inserted} synthetic demo customer-call signals.")
