"use client";

import { useMemo, useState } from "react";
import type { Worker } from "@/lib/types";
import { STATUS_META } from "@/lib/status";
import { timeAgo } from "@/lib/time";
import Pill from "@/app/components/Pill";

type SortKey = "status" | "wbgt";

interface Props {
  workers: Worker[];
  now: number | null;
  onSelect?: (workerId: string) => void; // opens the drill-down
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
    <div className="overflow-x-auto border-t-2 border-ink bg-white">
      <table className="min-w-full text-sm">
        <thead className="text-left text-concrete">
          <tr className="border-b border-rule">
            <th className="px-3 py-2 font-semibold">Worker</th>
            <th className="px-3 py-2 font-semibold">Zone</th>
            <th className="px-3 py-2 font-semibold" aria-sort={ariaSort("status")}>
              <button onClick={() => toggle("status")} className="font-semibold">
                Status{arrow("status")}
              </button>
            </th>
            <th className="px-3 py-2 font-semibold" aria-sort={ariaSort("wbgt")}>
              <button onClick={() => toggle("wbgt")} className="font-semibold">
                WBGT{arrow("wbgt")}
              </button>
            </th>
            <th className="hidden px-3 py-2 font-semibold sm:table-cell">Air</th>
            <th className="hidden px-3 py-2 font-semibold sm:table-cell">RH</th>
            <th className="px-3 py-2 font-semibold">Last seen</th>
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
                aria-label={onSelect ? `Open ${w.name}` : undefined}
                className={`border-b border-rule ${meta.row} ${
                  onSelect ? "cursor-pointer hover:bg-page" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <div className="font-semibold">{w.name}</div>
                  <div className="text-xs text-concrete">{w.worker_id}</div>
                </td>
                <td className="px-3 py-2">{w.zone}</td>
                <td className="px-3 py-2">
                  <Pill icon={meta.icon} label={meta.label} className={meta.pill} />
                </td>
                <td className="px-3 py-2 text-base font-extrabold tabular-nums">
                  {w.wbgt.toFixed(1)}°
                </td>
                <td className="hidden px-3 py-2 tabular-nums sm:table-cell">
                  {w.t_air.toFixed(1)}°
                </td>
                <td className="hidden px-3 py-2 tabular-nums sm:table-cell">
                  {w.rh}%
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-concrete">
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
