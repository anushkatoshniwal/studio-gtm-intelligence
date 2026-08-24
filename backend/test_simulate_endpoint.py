import asyncio
import json
from typing import Any

from app.main import app

REFERENCE_REQUEST = {
    "qualified_accounts": 500,
    "current_conversion_rate": 0.02,
    "expected_conversion_rate": 0.04,
    "revenue_per_customer": 100000,
    "acquisition_cost": 100000,
    "pilot_cost": 150000,
    "fixed_team_cost": 50000,
    "evidence_confidence": 4,
    "feasibility": 4,
}


async def post_json(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    request_body = json.dumps(payload).encode()
    response_messages: list[dict[str, Any]] = []
    request_sent = False

    async def receive() -> dict[str, Any]:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": request_body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        response_messages.append(message)

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/experiments/simulate",
            "raw_path": b"/experiments/simulate",
            "query_string": b"",
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(request_body)).encode()),
            ],
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


def validate_decision_response(body: dict[str, Any], expected_decision: str) -> None:
    assert body["decision"] == expected_decision
    assert body["decision"] in {"GO", "REVIEW", "NO-GO"}
    assert isinstance(body["reasons"], list) and body["reasons"]
    assert isinstance(body["risks"], list) and body["risks"]
    assert isinstance(body["recommended_pilot_size"], int)


async def run_tests() -> None:
    reference_status, reference_body = await post_json(REFERENCE_REQUEST)
    assert reference_status == 200
    assert reference_body["current_customers"] == 10
    assert reference_body["expected_customers"] == 20
    assert reference_body["incremental_customers"] == 10
    assert reference_body["baseline_revenue"] == 1000000
    assert reference_body["expected_revenue"] == 2000000
    assert reference_body["incremental_revenue"] == 1000000
    assert reference_body["total_incremental_cost"] == 300000
    assert reference_body["incremental_roi"] == 233.33
    assert reference_body["break_even_incremental_customers"] == 3
    assert reference_body["break_even_expected_conversion_rate"] == 0.026
    assert reference_body["recommended_pilot_size"] == 100
    validate_decision_response(reference_body, "GO")

    zero_lift_status, zero_lift_body = await post_json(
        {**REFERENCE_REQUEST, "expected_conversion_rate": 0.02}
    )
    assert zero_lift_status == 200
    assert zero_lift_body["incremental_customers"] == 0
    assert zero_lift_body["incremental_roi"] == -100
    validate_decision_response(zero_lift_body, "NO-GO")

    negative_roi_request = {
        **REFERENCE_REQUEST,
        "qualified_accounts": 100,
        "current_conversion_rate": 0.10,
        "expected_conversion_rate": 0.12,
        "revenue_per_customer": 10000,
        "acquisition_cost": 40000,
        "pilot_cost": 40000,
        "fixed_team_cost": 20000,
        "evidence_confidence": 5,
        "feasibility": 5,
    }
    negative_status, negative_body = await post_json(negative_roi_request)
    assert negative_status == 200
    assert negative_body["incremental_roi"] == -80
    validate_decision_response(negative_body, "NO-GO")

    weak_evidence_status, weak_evidence_body = await post_json(
        {**REFERENCE_REQUEST, "evidence_confidence": 2}
    )
    assert weak_evidence_status == 200
    validate_decision_response(weak_evidence_body, "REVIEW")

    invalid_status, invalid_body = await post_json(
        {**REFERENCE_REQUEST, "expected_conversion_rate": 1.5}
    )
    assert invalid_status == 422
    assert invalid_body["detail"][0]["loc"] == [
        "body",
        "expected_conversion_rate",
    ]


if __name__ == "__main__":
    asyncio.run(run_tests())
    print("Verified GO, REVIEW, NO-GO, and validation endpoint scenarios.")
