"use client";

import { useMemo } from "react";
import type { Alert, Worker } from "@/lib/types";
import {
  alertState,
  isOpenEscalation,
  ALERT_STATE_META,
} from "@/lib/alertState";
import { formatSGT, formatSGTDateTime } from "@/lib/time";

interface Props {
  alerts: Alert[];
  workers?: Worker[]; // optional: used to show names instead of IDs
}

const time = (ts: number | null | undefined) =>
  ts && ts > 0 ? formatSGT(ts) : "—";

export default function AlertLog({ alerts, workers = [] }: Props) {
  const names = useMemo(
    () => new Map(workers.map((w) => [w.worker_id, w.name])),
    [workers]
  );

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => b.raised_ts - a.raised_ts), // newest first
    [alerts]
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        No alerts.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white text-gray-900">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">Worker</th>
            <th className="px-3 py-2 font-medium">Zone</th>
            <th className="px-3 py-2 font-medium">Est. WBGT</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Raised</th>
            <th className="px-3 py-2 font-medium">Ack</th>
            <th className="px-3 py-2 font-medium">Escalated</th>
            <th className="px-3 py-2 font-medium">Cleared</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const state = alertState(a);
            const meta = ALERT_STATE_META[state];
            const redRow = isOpenEscalation(a);
            return (
              <tr
                key={a.alert_id}
                className={`border-t border-gray-100 ${
                  redRow ? "border-l-4 border-l-red-600 bg-red-50" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {names.get(a.worker_id) ?? a.worker_id}
                  </div>
                  <div className="text-xs text-gray-500">{a.worker_id}</div>
                </td>
                <td className="px-3 py-2">{a.zone}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {a.wbgt.toFixed(1)}°C
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.pill}`}
                  >
                    <span aria-hidden="true">{meta.icon}</span>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatSGTDateTime(a.raised_ts)}
                </td>
                <td className="px-3 py-2 tabular-nums">{time(a.ack_ts)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {time(a.escalated_ts)}
                </td>
                <td className="px-3 py-2 tabular-nums">{time(a.cleared_ts)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}