from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import ProductSignal

SYNTHETIC_SIGNALS = [
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator signed up with an individual account after viewing a Sarvam Studio dubbing demo.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator activated their workspace by uploading a 4-minute Hindi tutorial within 20 minutes of signup.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator generated a Tamil dub for a short-form video and downloaded the result on the first session.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator translated captions from English to Marathi for a weekly educational video.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator used text-to-speech to produce a Kannada voiceover for a product review.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator used speech-to-text to generate and edit a transcript for a podcast clip.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator returned three days after activation to dub two additional videos.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator created a project named Regional Shorts and added Hindi, Tamil, and Telugu outputs.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator completed five exports in one week and revisited Sarvam Studio on four separate days.",
    },
    {
        "source": "synthetic-demo:creator",
        "signal": "Creator converted from the demo plan after reaching the included monthly dubbing limit.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency strategist signed up after receiving a referral from a regional campaign partner.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency activated its workspace by inviting two editors and creating a client campaign project.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency dubbed a 30-second advertisement into six Indian languages during its first session.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency translated campaign scripts from English into Bengali, Malayalam, and Gujarati.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency generated text-to-speech variants with three voices for a client approval round.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency transcribed customer interview footage with speech-to-text before editing highlight reels.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency returned weekly for four consecutive weeks to localize new campaign assets.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency created separate projects for three clients and assigned language-specific deliverables.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency processed 42 minutes of dubbing across nine assets during a campaign launch week.",
    },
    {
        "source": "synthetic-demo:media-agency",
        "signal": "Media agency converted to a paid workspace after its team completed a successful client pilot.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise learning manager signed up using a company email to evaluate multilingual training content.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise team activated after inviting five reviewers and uploading its first compliance module.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise team dubbed a 12-minute onboarding video into Hindi, Telugu, and Marathi.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise team translated safety-training transcripts into seven regional languages for review.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise team used text-to-speech to generate consistent narration for four learning modules.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise research team used speech-to-text to transcribe multilingual customer support calls.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise team returned every business day for two weeks during a localization pilot.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise administrator created projects for onboarding, compliance, and customer education.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise reviewers completed 18 localized exports and requested access for another department.",
    },
    {
        "source": "synthetic-demo:enterprise",
        "signal": "Enterprise account converted to a paid plan after completing security review and a 30-day pilot.",
    },
]


def enrich_product_signal(record: dict[str, str]) -> dict[str, str | int]:
    signal = record["signal"].lower()
    segment = record["source"].split(":", 1)[1].replace("media-agency", "media_agency")

    if "converted" in signal:
        signal_type, strength = "conversion", 5
    elif "signed up" in signal:
        signal_type, strength = "signup", 2
    elif "activated" in signal:
        signal_type, strength = "activation", 4
    elif "speech-to-text" in signal:
        signal_type, strength = "speech_to_text_usage", 3
    elif "text-to-speech" in signal:
        signal_type, strength = "text_to_speech_usage", 3
    elif "translated" in signal:
        signal_type, strength = "translation_usage", 3
    elif "dub" in signal:
        signal_type, strength = "dubbing_usage", 3
    elif any(term in signal for term in ("returned", "revisited", "weekly", "every business day")):
        signal_type, strength = "repeat_usage", 4
    elif "created" in signal:
        signal_type, strength = "project_creation", 3
    else:
        signal_type, strength = "usage_intensity", 4

    return {
        **record,
        "segment": segment,
        "signal_type": signal_type,
        "strength": strength,
    }


def seed_product_signals() -> int:
    init_db()

    with SessionLocal() as db:
        existing_signals = {
            record.signal: record
            for record in db.scalars(
                select(ProductSignal).where(
                    ProductSignal.source.like("synthetic-demo:%")
                )
            ).all()
        }
        inserted = 0
        for seed_record in SYNTHETIC_SIGNALS:
            enriched_record = enrich_product_signal(seed_record)
            existing_record = existing_signals.get(seed_record["signal"])
            if existing_record is None:
                db.add(ProductSignal(**enriched_record))
                inserted += 1
            else:
                existing_record.segment = str(enriched_record["segment"])
                existing_record.signal_type = str(enriched_record["signal_type"])
                existing_record.strength = int(enriched_record["strength"])

        db.commit()
        return inserted


if __name__ == "__main__":
    inserted = seed_product_signals()
    print(f"Inserted {inserted} synthetic demo product signals.")
