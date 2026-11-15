"use client";

import { useMemo } from "react";
import type { Alert, Worker } from "@/lib/types";
import {
  alertState,
  canAck,
  isOpenEscalation,
  ALERT_STATE_META,
} from "@/lib/alertState";
import { formatSGT, formatSGTDateTime, formatSGTStamp, sgtToday } from "@/lib/time";
import { downloadCSV, toCSV, type Column } from "@/lib/csv";
import Pill from "@/app/components/Pill";
import AckButton from "@/app/components/AckButton";
import CsvButton from "@/app/components/CsvButton";

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

  function exportCSV() {
    const name = (a: Alert) => names.get(a.worker_id) ?? "";
    const columns: Column<Alert>[] = [
      { header: "alert_id", value: (a) => a.alert_id },
      { header: "worker_id", value: (a) => a.worker_id },
      { header: "worker_name", value: name },
      { header: "zone", value: (a) => a.zone },
      { header: "wbgt_c", value: (a) => a.wbgt },
      { header: "state", value: (a) => ALERT_STATE_META[alertState(a)].label },
      { header: "raised_sgt", value: (a) => formatSGTStamp(a.raised_ts) },
      { header: "ack_sgt", value: (a) => formatSGTStamp(a.ack_ts) },
      { header: "escalated_sgt", value: (a) => formatSGTStamp(a.escalated_ts) },
      { header: "cleared_sgt", value: (a) => formatSGTStamp(a.cleared_ts) },
      { header: "raised_ts", value: (a) => a.raised_ts },
      { header: "ack_ts", value: (a) => a.ack_ts },
      { header: "escalated_ts", value: (a) => a.escalated_ts },
      { header: "cleared_ts", value: (a) => a.cleared_ts },
    ];
    downloadCSV(`heattrace-alerts-${sgtToday()}.csv`, toCSV(sorted, columns));
  }

  const toolbar = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-sm text-concrete">Newest first. Times are Singapore time.</p>
      <CsvButton onExport={exportCSV} disabled={sorted.length === 0} />
    </div>
  );

  if (sorted.length === 0) {
    return (
      <>
        {toolbar}
        <p className="border-t-2 border-ink bg-white p-4 text-sm text-concrete">
          No alerts in this period.
        </p>
      </>
    );
  }

  return (
    <>
      {toolbar}
      <div className="overflow-x-auto border-t-2 border-ink bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-concrete">
            <tr className="border-b border-rule">
              <th className="px-3 py-2 font-semibold">Worker</th>
              <th className="px-3 py-2 font-semibold">State</th>
              <th className="px-3 py-2 font-semibold">Action</th>
              <th className="px-3 py-2 font-semibold">Zone</th>
              <th className="px-3 py-2 font-semibold">WBGT</th>
              <th className="px-3 py-2 font-semibold">Raised</th>
              <th className="px-3 py-2 font-semibold">Ack</th>
              <th className="px-3 py-2 font-semibold">Escalated</th>
              <th className="px-3 py-2 font-semibold">Cleared</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const meta = ALERT_STATE_META[alertState(a)];
              const redRow = isOpenEscalation(a);
              return (
                <tr
                  key={a.alert_id}
                  className={`border-b border-rule ${
                    redRow ? "border-l-4 border-l-critical bg-critical/15" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold">
                      {names.get(a.worker_id) ?? a.worker_id}
                    </div>
                    <div className="text-xs text-concrete">{a.worker_id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Pill icon={meta.icon} label={meta.label} className={meta.pill} />
                  </td>
                  <td className="px-3 py-2">
                    {canAck(a) ? (
                      <AckButton
                        alertId={a.alert_id}
                        workerName={names.get(a.worker_id) ?? a.worker_id}
                      />
                    ) : (
                      <span className="text-concrete">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{a.zone}</td>
                  <td className="px-3 py-2 font-extrabold tabular-nums">
                    {a.wbgt.toFixed(1)}°
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {formatSGTDateTime(a.raised_ts)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{time(a.ack_ts)}</td>
                  <td className="px-3 py-2 tabular-nums">{time(a.escalated_ts)}</td>
                  <td className="px-3 py-2 tabular-nums">{time(a.cleared_ts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
