from datetime import datetime

from app.database import SessionLocal, init_db
from app.evidence import EvidenceCluster, Opportunity
from app.synthesis import synthesize_evidence


if __name__ == "__main__":
    init_db()

    with SessionLocal() as db:
        clusters, opportunities = synthesize_evidence(
            db,
            as_of=datetime(2026, 8, 21, 12, 0, 0),
        )

    assert clusters
    assert opportunities
    assert len(opportunities) == len(clusters)
    assert all(isinstance(cluster, EvidenceCluster) for cluster in clusters)
    assert all(isinstance(opportunity, Opportunity) for opportunity in opportunities)
    assert all(len(cluster.supporting_signals) >= 2 for cluster in clusters)
    assert all(0 <= cluster.evidence_strength <= 100 for cluster in clusters)
    assert any(len(cluster.sources_used) >= 2 for cluster in clusters)
    assert any(cluster.contradicting_signals for cluster in clusters)
    assert any(cluster.key_unknowns for cluster in clusters)
    assert all(opportunity.evidence for opportunity in opportunities)

    print(
        f"Verified {len(clusters)} evidence clusters and "
        f"{len(opportunities)} opportunities from 70 synthetic signals."
    )
