"""End-to-end alert lifecycle on moto tables (guide Step 3 + 4 'Done when')."""

import boto3
from boto3.dynamodb.conditions import Key
from conftest import load_handler

from shared import alerts, db
from shared.wbgt import ta_for_target

process = load_handler("process_reading")
ack = load_handler("ack_handler")
escalate = load_handler("escalate")

T0 = 1_762_270_000
RH, LUX = 70, 60000


def reading(wid, ts, wbgt_target, seq, zone="Z2", ts_field=None):
    ta = ta_for_target(wbgt_target, RH, LUX)
    return {
        "w": wid, "z": zone, "ta": ta, "rh": RH, "lux": LUX, "tg": None,
        "wbgt": wbgt_target, "alert": 0, "seq": seq,
        "ts": ts if ts_field is None else ts_field,
        "worker_id": wid, "rx_ts": ts * 1000,
    }


def send(wid, t, target, seq, **kw):
    return process.handler(reading(wid, t, target, seq, **kw))


def cmds(published, wid):
    return [p for t, p in published if t == f"heattrace/{wid}/cmd"]


def test_rejects_bad_payload(seed):
    assert process.handler({"z": "Z1", "worker_id": "W01"})["ok"] is False


def test_normal_reading_is_stored(seed):
    out = send("W01", T0, 29.0, 1, zone="Z3")
    assert out["ok"] and out["action"] is None
    w = alerts.get_worker("W01")
    assert w["status"] == "ok" and w["last_seen"] == T0 and w["name"] == "Lim Wei Ren"
    assert len(w["rolling"]) == 1
    r = db.table("readings").get_item(Key={"worker_id": "W01", "ts": T0})["Item"]
    assert int(r["expire_at"]) == T0 + 30 * 86400
    z = db.table("zones").query(KeyConditionExpression=Key("zone").eq("Z3"))["Items"]
    assert len(z) == 1 and int(z[0]["n"]) == 1


def test_ts_zero_uses_receive_time(seed):
    out = process.handler(reading("W01", T0 + 5, 29.0, 1, zone="Z3", ts_field=0))
    assert out["ts"] == T0 + 5


def test_unknown_worker_is_created(aws):
    send("W99", T0, 29.0, 1, zone="Z1")
    w = alerts.get_worker("W99")
    assert w["name"] == "W99" and w["status"] == "ok" and w["zone"] == "Z1"


def test_seq_backwards_flags_gap(seed):
    send("W01", T0, 29.0, 50, zone="Z3")
    out = send("W01", T0 + 10, 29.0, 3, zone="Z3")
    assert out["gap"] is True


def test_late_buffered_reading_does_not_move_live_state(seed):
    send("W01", T0 + 100, 29.0, 10, zone="Z3")
    out = send("W01", T0 + 50, 34.0, 11, zone="Z3")
    assert out["late"] is True
    assert alerts.get_worker("W01")["last_seen"] == T0 + 100


def test_rolling_avg_restarts_after_long_silence(seed):
    # Hat ran yesterday, then was off for hours: yesterday's samples must not
    # leak into today's average.
    for i in range(6):
        send("W01", T0 + 10 * i, 31.0, i + 1, zone="Z3")
    send("W01", T0 + 3 * 3600, 29.0, 1, zone="Z3")
    w = alerts.get_worker("W01")
    assert len(w["rolling"]) == 1
    assert float(w["wbgt_avg"]) == float(w["wbgt"])


def test_rolling_avg_keeps_samples_across_short_gap(seed):
    send("W01", T0, 31.0, 1, zone="Z3")
    send("W01", T0 + 120, 31.0, 2, zone="Z3")  # 2 min dropout: still one window
    assert len(alerts.get_worker("W01")["rolling"]) == 2


def test_full_lifecycle_spike_ack_clear(seed):
    pub = seed["published"]
    t = T0
    # Six hot samples: the rolling average crosses 32.0 partway through.
    actions = [send("W03", t + 10 * i, 33.0, i)["action"] for i in range(6)]
    assert actions.count("raised") == 1
    w = alerts.get_worker("W03")
    assert w["status"] == "alert" and w["open_alert_id"]
    alert_id = w["open_alert_id"]
    assert cmds(pub, "W03") == [{"alert": 1, "reason": "self"}]
    assert cmds(pub, "W04") == [{"alert": 1, "reason": "buddy", "from": "W03"}]

    # Still hot: no duplicate alert.
    assert send("W03", t + 70, 33.0, 7)["action"] is None

    # Button press -> resting, buddy cleared only.
    ack_ts = t + 80
    out = ack.handler({"w": "W03", "ts": ack_ts, "worker_id": "W03"})
    assert out["acked"] == alert_id
    assert alerts.get_worker("W03")["status"] == "resting"
    assert cmds(pub, "W04")[-1] == {"alert": 0}
    assert len(cmds(pub, "W03")) == 1  # worker LED stays red

    # Second press is ignored.
    assert ack.handler({"w": "W03", "ts": ack_ts + 5, "worker_id": "W03"})["acked"] is None

    # Cool down inside the rest window: not cleared yet.
    for i in range(6):
        assert send("W03", ack_ts + 60 + 10 * i, 29.0, 20 + i)["action"] is None

    # After 15 min and cool: cleared, both notified.
    out = send("W03", ack_ts + 15 * 60 + 1, 29.0, 40)
    assert out["action"] == "cleared"
    w = alerts.get_worker("W03")
    assert w["status"] == "ok" and "open_alert_id" not in w
    a = alerts.get_alert(alert_id)
    assert a["ack_ts"] == ack_ts and a["cleared_ts"] == ack_ts + 15 * 60 + 1
    assert cmds(pub, "W03")[-1] == {"alert": 0}


def test_ack_without_open_alert_is_noop(seed):
    assert ack.handler({"w": "W01", "worker_id": "W01"})["acked"] is None


def test_unacked_alert_escalates_once_with_sms(seed, monkeypatch):
    for i in range(6):
        send("W03", T0 + 10 * i, 33.0, i)
    alert_id = alerts.get_worker("W03")["open_alert_id"]
    raised = alerts.get_alert(alert_id)["raised_ts"]

    monkeypatch.setattr(escalate.time, "time", lambda: raised + 599)
    assert escalate.handler()["escalated"] == []

    sent = []
    real_sns = alerts._sns()
    monkeypatch.setattr(alerts, "_sns", lambda: type("S", (), {
        "publish": lambda self, **kw: (sent.append(kw), real_sns.publish(**kw))[1]})())
    monkeypatch.setattr(escalate.time, "time", lambda: raised + 601)
    assert escalate.handler()["escalated"] == [alert_id]
    assert alerts.get_worker("W03")["status"] == "escalated"
    assert alerts.get_alert(alert_id)["escalated_ts"] == raised + 601
    assert len(sent) == 1
    msg = sent[0]["Message"]
    assert msg.startswith("HeatTrace: W03 Muhammad Faizal in Z2, WBGT ")
    assert len(msg) <= 160

    # Next minute: already escalated, no second SMS.
    monkeypatch.setattr(escalate.time, "time", lambda: raised + 661)
    assert escalate.handler()["escalated"] == []
    assert len(sent) == 1

    # Late ack still moves it to resting.
    assert ack.handler({"w": "W03", "worker_id": "W03", "ts": raised + 700})["acked"] == alert_id
    assert alerts.get_worker("W03")["status"] == "resting"


def test_acked_alert_does_not_escalate(seed, monkeypatch):
    for i in range(6):
        send("W03", T0 + 10 * i, 33.0, i)
    alert_id = alerts.get_worker("W03")["open_alert_id"]
    alerts.ack_alert(alert_id, T0 + 100)
    monkeypatch.setattr(escalate.time, "time", lambda: T0 + 3600)
    assert escalate.handler()["escalated"] == []


def test_dashboard_ack_by_alert_id_matches_button(seed):
    for i in range(6):
        send("W05", T0 + 10 * i, 33.0, i, zone="Z1")
    alert_id = alerts.get_worker("W05")["open_alert_id"]
    assert alerts.ack_alert(alert_id, T0 + 90)["alert_id"] == alert_id
    assert alerts.get_worker("W05")["status"] == "resting"
    assert cmds(seed["published"], "W06")[-1] == {"alert": 0}


def test_sns_topic_exists(aws):
    arns = [t["TopicArn"] for t in boto3.client("sns").list_topics()["Topics"]]
    assert aws["topic"] in arns
