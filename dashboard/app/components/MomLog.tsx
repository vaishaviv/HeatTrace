"use client";

import { useMemo, useState } from "react";
import type { MomRow } from "@/lib/types";
import { useMomLog } from "@/lib/hooks";
import { formatSGT, formatSGTStamp, sgtDate } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { downloadCSV, toCSV, type Column } from "@/lib/csv";
import CsvButton from "@/app/components/CsvButton";

// The hourly WBGT record for a MOM inspector: per hour, each zone's highest
// reading and whether a rest break was triggered. Replaces the manual meter
// reading. Rest decisions come from the cloud; the board only displays them.
export default function MomLog() {
  // The clock is read in an effect (useNow), never during render, so this is
  // safe even if the MOM tab becomes the default. Until then, date is null and
  // no request is made. Once a date is picked it sticks; otherwise it follows
  // today, rolling over at midnight SGT.
  const now = useNow(60_000);
  const today = now === null ? null : sgtDate(now);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const log = useMomLog(date);

  const { zones, hours, cell, peak, restCount } = useMemo(() => {
    const rows: MomRow[] = log.data ?? [];
    const zones = [...new Set(rows.map((r) => r.zone))].sort();
    const hours = [...new Set(rows.map((r) => r.hour_ts))].sort((a, b) => a - b);
    const cell = new Map(rows.map((r) => [`${r.hour_ts}:${r.zone}`, r]));
    const peak = rows.reduce<MomRow | null>(
      (p, r) => (!p || r.max_wbgt > p.max_wbgt ? r : p),
      null
    );
    const restCount = rows.filter((r) => r.rest_triggered).length;
    return { zones, hours, cell, peak, restCount };
  }, [log.data]);

  function exportCSV() {
    if (!date) return;
    const columns: Column<MomRow>[] = [
      { header: "date", value: () => date },
      { header: "hour_sgt", value: (r) => formatSGTStamp(r.hour_ts) },
      { header: "zone", value: (r) => r.zone },
      { header: "max_wbgt_c", value: (r) => r.max_wbgt },
      { header: "rest_triggered", value: (r) => r.rest_triggered },
      { header: "hour_ts", value: (r) => r.hour_ts },
    ];
    downloadCSV(`heattrace-mom-${date}.csv`, toCSV(log.data ?? [], columns));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-semibold">
          Date
          <input
            type="date"
            value={date ?? ""}
            max={today ?? undefined}
            disabled={date === null}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
            className="mt-1 rounded border-2 border-ink bg-white px-2 py-1 text-base"
          />
        </label>
        <CsvButton onExport={exportCSV} disabled={!log.data || log.data.length === 0} />
        {peak && (
          <p className="text-sm">
            Highest: <strong className="tabular-nums">{peak.max_wbgt.toFixed(1)} °C</strong> in{" "}
            {peak.zone} at {formatSGT(peak.hour_ts)}.{" "}
            {restCount === 0
              ? "No rest breaks triggered."
              : `Rest breaks triggered in ${restCount} zone-hour${restCount === 1 ? "" : "s"}.`}
          </p>
        )}
      </div>

      {log.error && (
        <p className="font-semibold text-critical">
          MOM log could not be loaded: {log.error.message}
        </p>
      )}
      {!log.data && !log.error && <p className="text-concrete">Loading MOM log…</p>}
      {log.data && log.data.length === 0 && (
        <p className="text-concrete">
          {date === today
            ? "No hourly readings logged yet today. Rows appear as each hour closes."
            : `No readings were logged on ${date}. Pick another date.`}
        </p>
      )}

      {hours.length > 0 && (
        <div className="overflow-x-auto border-t-2 border-ink bg-white">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              Highest WBGT per zone per hour on {date}, Singapore time
            </caption>
            <thead className="text-left text-concrete">
              <tr className="border-b border-rule">
                <th scope="col" className="px-3 py-2 font-semibold">Hour</th>
                {zones.map((z) => (
                  <th key={z} scope="col" className="px-3 py-2 font-semibold">{z}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h} className="border-b border-rule">
                  <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums">
                    {formatSGT(h)}
                  </th>
                  {zones.map((z) => {
                    const r = cell.get(`${h}:${z}`);
                    return (
                      <td key={z} className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {r ? (
                          <>
                            <span className="font-extrabold">{r.max_wbgt.toFixed(1)}°</span>
                            {r.rest_triggered && (
                              <span className="ml-2 rounded bg-rest px-1.5 py-0.5 text-xs font-semibold text-white">
                                <span aria-hidden="true">◆ </span>Rest
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-concrete">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
