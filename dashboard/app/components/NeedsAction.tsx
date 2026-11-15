"use client";

import Link from "next/link";
import type { Worker } from "@/lib/types";
import { STATUS_META } from "@/lib/status";

interface Props {
  workers: Worker[];
}

// The first thing on the board: who needs a supervisor right now, drawn as
// safety-sign plates. Escalated first, then alerts, hottest first within each.
const PLATE: Record<"escalated" | "alert", string> = {
  escalated: "bg-ink text-white border-critical border-4",
  alert: "bg-critical text-white border-ink border-2",
};

export default function NeedsAction({ workers }: Props) {
  const names = new Map(workers.map((w) => [w.worker_id, w.name]));
  const urgent = workers
    .filter((w) => w.status === "escalated" || w.status === "alert")
    .sort(
      (a, b) =>
        STATUS_META[a.status].rank - STATUS_META[b.status].rank || b.wbgt - a.wbgt
    );
  const offline = workers.filter((w) => w.status === "offline");

  return (
    <div className="space-y-3">
      {urgent.length === 0 ? (
        <p className="rounded-md border-2 border-safe bg-white p-4 font-semibold text-safe">
          <span aria-hidden="true">✓ </span>
          No one needs action right now.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {urgent.map((w) => {
            const meta = STATUS_META[w.status];
            const buddy = w.buddy_id ? names.get(w.buddy_id) ?? w.buddy_id : null;
            return (
              <li key={w.worker_id}>
                <Link
                  href={`/workers/${encodeURIComponent(w.worker_id)}`}
                  className={`block rounded-md p-4 ${PLATE[w.status as "escalated" | "alert"]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-5xl leading-none font-extrabold tabular-nums">
                      {w.wbgt.toFixed(1)}°
                    </span>
                    <span className="text-right text-sm font-semibold">
                      <span aria-hidden="true">{meta.icon} </span>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-3 text-lg leading-tight font-extrabold">{w.name}</p>
                  <p className="text-sm text-white/85">
                    Zone {w.zone}
                    {buddy ? `, buddy ${buddy}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {offline.length > 0 && (
        <p className="text-sm text-concrete">
          <span aria-hidden="true">○ </span>
          {offline.length === 1 ? "1 hat is offline: " : `${offline.length} hats are offline: `}
          {offline.map((w, i) => (
            <span key={w.worker_id}>
              {i > 0 && ", "}
              <Link
                href={`/workers/${encodeURIComponent(w.worker_id)}`}
                className="font-semibold text-ink underline underline-offset-4"
              >
                {w.name}
              </Link>{" "}
              ({w.zone})
            </span>
          ))}
          . Check on them in person.
        </p>
      )}
    </div>
  );
}
