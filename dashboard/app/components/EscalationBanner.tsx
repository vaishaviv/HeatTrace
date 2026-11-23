"use client";

import type { Alert, Worker } from "@/lib/types";
import { isOpenEscalation } from "@/lib/alertState";
import { formatSGT } from "@/lib/time";

interface Props {
  alerts: Alert[];
  workers?: Worker[];
}

// Full-width red banner for every alert that escalated (no ack within 10 min,
// SMS sent) and has not cleared. The wording matches the SMS so a supervisor
// sees the same message on the board and on their phone.
export default function EscalationBanner({ alerts, workers = [] }: Props) {
  const open = alerts.filter(isOpenEscalation);
  if (open.length === 0) return null;

  const names = new Map(workers.map((w) => [w.worker_id, w.name]));

  return (
    <div role="alert" className="border-b-4 border-ink bg-critical text-white">
      <ul className="mx-auto w-full max-w-5xl space-y-1 px-4 py-3">
        {open.map((a) => (
          <li key={a.alert_id} className="font-semibold">
            <span aria-hidden="true">▲▲ </span>
            Escalated: {names.get(a.worker_id) ?? a.worker_id} in {a.zone},{" "}
            <span className="tabular-nums">{a.wbgt.toFixed(1)} °C</span>. No
            acknowledgement for 10 min
            {a.escalated_ts ? `, SMS sent ${formatSGT(a.escalated_ts)}` : ""}.
          </li>
        ))}
      </ul>
    </div>
  );
}
