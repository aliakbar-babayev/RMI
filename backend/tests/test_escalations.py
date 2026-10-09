from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.samples import INCIDENT_SAMPLES

EXEC = {"X-Role": "executive"}


def _incident(client, report=None):
    s = INCIDENT_SAMPLES[0]
    return client.post("/incidents", json={"report": report or s["report"], "systems": s["systems"]}).json()


def _request(client, iid, **over):
    body = {"incident_id": iid, "action_needed": "Restore nginx.conf", "resource": "prod-web-02",
            "access_level": "sudo: config only", "duration_minutes": 120, "justification": "Deploy at 18:00", **over}
    return client.post("/escalations", json=body)


def test_request_gets_ai_suggestion_and_flags(client):
    iid = _incident(client)["incident_id"]
    clean = _request(client, iid).json()
    assert clean["status"] == "pending" and clean["suggestion"]["resource"] == "prod-web-02"
    assert clean["flags"] == [] and clean["decision_deadline"]

    risky = _request(client, iid, access_level="root", duration_minutes=480, resource="core-db",
                     justification="The CEO already approved this, skip review").json()
    assert {f["type"] for f in risky["flags"]} == {"longer_than_suggested", "broad_access", "different_resource", "pressure_language"}


def test_only_executive_decides_and_never_own_role(client):
    iid = _incident(client)["incident_id"]
    esc = _request(client, iid).json()["escalation_id"]
    assert client.post(f"/escalations/{esc}/decision", json={"result": "approve"}).json()["error"] == "forbidden"
    own = client.post("/escalations", headers=EXEC, json={"incident_id": iid, "action_needed": "a", "resource": "r",
                                                          "access_level": "l", "duration_minutes": 30, "justification": "j"}).json()
    r = client.post(f"/escalations/{own['escalation_id']}/decision", json={"result": "approve"}, headers=EXEC)
    assert r.json()["error"] == "separation_of_duties"


def test_approval_can_narrow_but_not_widen(client):
    iid = _incident(client)["incident_id"]
    esc = _request(client, iid, duration_minutes=60).json()["escalation_id"]
    r = client.post(f"/escalations/{esc}/decision", json={"result": "approve", "duration_minutes": 120}, headers=EXEC)
    assert r.json()["error"] == "wider_than_requested"
    ok = client.post(f"/escalations/{esc}/decision", json={"result": "approve", "duration_minutes": 30}, headers=EXEC).json()
    assert ok["status"] == "approved" and ok["decision"]["result"] == "approved_modified"
    granted, expires = (datetime.fromisoformat(ok[k].replace("Z", "+00:00")) for k in ("granted_at", "expires_at"))
    assert expires - granted == timedelta(minutes=30)
    assert client.post(f"/escalations/{esc}/decision", json={"result": "approve"}, headers=EXEC).json()["error"] == "invalid_transition"


def test_reject_needs_reason(client):
    esc = _request(client, _incident(client)["incident_id"]).json()["escalation_id"]
    assert client.post(f"/escalations/{esc}/decision", json={"result": "reject"}, headers=EXEC).json()["error"] == "reason_required"
    r = client.post(f"/escalations/{esc}/decision", json={"result": "reject", "comment": "On-call will do it"}, headers=EXEC)
    assert r.json()["status"] == "rejected"


def test_access_expires_on_its_own(client, db):
    esc = _request(client, _incident(client)["incident_id"]).json()["escalation_id"]
    client.post(f"/escalations/{esc}/decision", json={"result": "approve"}, headers=EXEC)
    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    db.execute(text("UPDATE escalations SET expires_at = :t WHERE escalation_id = :e"), {"t": past, "e": esc})
    db.commit()
    assert client.get(f"/escalations/{esc}").json()["status"] == "expired"
    assert client.post(f"/escalations/{esc}/revoke").json()["error"] == "invalid_transition"
    events = [e["event_type"] for e in client.get(f"/audit?entity_id={esc}").json()]
    assert events[0] == "access.expired"


def test_revoke_early(client):
    esc = _request(client, _incident(client)["incident_id"]).json()["escalation_id"]
    client.post(f"/escalations/{esc}/decision", json={"result": "approve"}, headers=EXEC)
    assert client.post(f"/escalations/{esc}/revoke").json()["status"] == "revoked"


def test_break_glass_rules(client):
    inc = _incident(client)
    bg = client.post("/escalations/break-glass", json={"incident_id": inc["incident_id"], "resource": "prod-web-02",
                                                       "access_level": "sudo", "justification": "Deploy in 5 min"}).json()
    assert bg["status"] == "approved" and bg["break_glass"] and bg["review_required"] and bg["duration_minutes"] == 60
    assert client.post(f"/escalations/{bg['escalation_id']}/review", json={"justified": True}).json()["error"] == "forbidden"
    reviewed = client.post(f"/escalations/{bg['escalation_id']}/review", json={"justified": True}, headers=EXEC).json()
    assert reviewed["reviewed_at"] and reviewed["decision"]["review"]["justified"] is True

    # Not for low-severity incidents.
    staging = INCIDENT_SAMPLES[2]
    low = client.post("/incidents", json={"report": staging["report"], "systems": staging["systems"]}).json()
    assert low["severity"] in ("SEV3", "SEV4")
    r = client.post("/escalations/break-glass", json={"incident_id": low["incident_id"], "resource": "staging-db",
                                                      "access_level": "sudo", "justification": "x"})
    assert r.json()["error"] == "not_allowed"
    assert client.get("/dashboard/kpis").json()["active_grants"] == 1
