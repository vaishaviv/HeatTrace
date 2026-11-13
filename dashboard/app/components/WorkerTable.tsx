"use client";

import { useMemo, useState } from "react";
import type { Worker } from "@/lib/types";
import { STATUS_META } from "@/lib/status";
import { timeAgo } from "@/lib/time";

type SortKey = "status" | "wbgt";

interface Props {
  workers: Worker[];
  now: number | null;
  onSelect?: (workerId: string) => void; // used by the drill-down later
}

export default function WorkerTable({ workers, now, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [asc, setAsc] = useState(true); // status asc = most urgent first

  const sorted = useMemo(() => {
    const copy = [...workers];
    copy.sort((a, b) => {
      let v: number;
      if (sortKey === "wbgt") {
        v = a.wbgt - b.wbgt;
      } else {
        const r = STATUS_META[a.status].rank - STATUS_META[b.status].rank;
        v = r !== 0 ? r : b.wbgt - a.wbgt; // hotter first within a status
      }
      return asc ? v : -v;
    });
    return copy;
  }, [workers, sortKey, asc]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setAsc((a) => !a);
    } else {
      setSortKey(key);
      setAsc(key === "status"); // WBGT defaults to hottest first
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (asc ? " ↑" : " ↓") : "";

  const ariaSort = (key: SortKey) =>
    sortKey === key ? (asc ? "ascending" : "descending") : "none";

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white text-gray-900">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">Worker</th>
            <th className="px-3 py-2 font-medium">Zone</th>
            <th className="px-3 py-2 font-medium" aria-sort={ariaSort("status")}>
              <button onClick={() => toggle("status")} className="font-medium">
                Status{arrow("status")}
              </button>
            </th>
            <th className="px-3 py-2 font-medium" aria-sort={ariaSort("wbgt")}>
              <button onClick={() => toggle("wbgt")} className="font-medium">
                Est. WBGT{arrow("wbgt")}
              </button>
            </th>
            <th className="px-3 py-2 font-medium">Temp</th>
            <th className="px-3 py-2 font-medium">RH</th>
            <th className="px-3 py-2 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((w) => {
            const meta = STATUS_META[w.status];
            return (
              <tr
                key={w.worker_id}
                tabIndex={onSelect ? 0 : undefined}
                onClick={() => onSelect?.(w.worker_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect?.(w.worker_id);
                }}
                className={`border-t border-gray-100 ${meta.row} ${
                  onSelect ? "cursor-pointer hover:bg-gray-50" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-gray-500">{w.worker_id}</div>
                </td>
                <td className="px-3 py-2">{w.zone}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.pill}`}
                  >
                    <span aria-hidden="true">{meta.icon}</span>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {w.wbgt.toFixed(1)}°C
                </td>
                <td className="px-3 py-2 tabular-nums">{w.t_air.toFixed(1)}°C</td>
                <td className="px-3 py-2 tabular-nums">{w.rh}%</td>
                <td
                  className={`px-3 py-2 ${
                    w.status === "offline" ? "text-gray-500" : ""
                  }`}
                >
                  {timeAgo(w.last_seen, now)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}