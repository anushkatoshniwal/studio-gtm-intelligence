import asyncio
import json
from typing import Any

from app.main import app


async def get_context() -> tuple[int, dict[str, Any]]:
    response_messages: list[dict[str, Any]] = []
    request_sent = False

    async def receive() -> dict[str, Any]:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        response_messages.append(message)

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/intelligence/context",
            "raw_path": b"/intelligence/context",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 50000),
            "server": ("testserver", 80),
            "root_path": "",
        },
        receive,
        send,
    )

    response_start = next(
        message for message in response_messages if message["type"] == "http.response.start"
    )
    response_body = b"".join(
        message.get("body", b"")
        for message in response_messages
        if message["type"] == "http.response.body"
    )
    return response_start["status"], json.loads(response_body)


async def run_test() -> None:
    status, body = await get_context()
    repeated_status, repeated_body = await get_context()
    assert status == 200
    assert repeated_status == 200
    assert repeated_body == body
    assert body["signal_count"] == 70
    assert len(body["signals_by_source"]["product"]) == 30
    assert len(body["signals_by_source"]["customer"]) == 20
    assert len(body["signals_by_source"]["market"]) == 20
    assert len(body["scored_signals"]) == 70
    assert len(body["evidence_clusters"]) == 14
    assert len(body["opportunities"]) == 14

    signal_fields = {
        "source",
        "source_label",
        "segment",
        "signal_type",
        "signal_strength",
        "signal",
        "timestamp",
    }
    all_signals = [
        signal
        for records in body["signals_by_source"].values()
        for signal in records
    ]
    assert all(set(signal) == signal_fields for signal in all_signals)
    assert all("context_score" in signal for signal in body["scored_signals"])
    assert all(0 <= signal["context_score"] <= 100 for signal in body["scored_signals"])

    for cluster in body["evidence_clusters"]:
        assert 0 <= cluster["evidence_strength"] <= 100
        assert cluster["supporting_signals"]
        assert "contradicting_signals" in cluster
        assert "unknowns" in cluster


if __name__ == "__main__":
    asyncio.run(run_test())
    print("Verified 70 signals and 14 clusters/opportunities in context snapshot.")
