// Mock-mode stand-in for what the cloud does on an ack: set ack_ts on the
// alert and mark the worker resting for 15 min. In-memory and per server
// process, so it resets on restart; that is fine for the mock. Kept on
// globalThis so dev hot reloads do not wipe it.
import type { Alert, Worker } from "@/lib/types";

export const REST_S = 15 * 60;

const store = globalThis as typeof globalThis & { __heattraceAcks?: Map<string, number> };
const acks: Map<string, number> = (store.__heattraceAcks ??= new Map());

export function recordAck(alertId: string, ts: number) {
  if (!acks.has(alertId)) acks.set(alertId, ts);
  return acks.get(alertId)!;
}

export function withAcks(alerts: Alert[]): Alert[] {
  return alerts.map((a) =>
    acks.has(a.alert_id) && !a.ack_ts ? { ...a, ack_ts: acks.get(a.alert_id)! } : a
  );
}

export function withResting(workers: Worker[], alerts: Alert[], now: number): Worker[] {
  const resting = new Set(
    withAcks(alerts)
      .filter((a) => acks.has(a.alert_id) && a.ack_ts && now < a.ack_ts + REST_S)
      .map((a) => a.worker_id)
  );
  return workers.map((w) => (resting.has(w.worker_id) ? { ...w, status: "resting" } : w));
}
