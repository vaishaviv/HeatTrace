"use client";

import type { Zone } from "@/lib/types";
import { BAND_META } from "@/lib/bands";

interface Props {
  zones: Zone[];
}

export default function ZoneGrid({ zones }: Props) {
  // Keep zones in a fixed order so each card stays in the same place
  // between refreshes.
  const sorted = [...zones].sort((a, b) => a.zone.localeCompare(b.zone));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {sorted.map((z) => {
        const meta = BAND_META[z.band];
        return (
          <div
            key={z.zone}
            className={`rounded-lg border-2 p-3 ${meta.card}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{z.zone}</span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold">
                <span aria-hidden="true">{meta.icon} </span>
                {meta.label}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums">
              {z.avg_wbgt.toFixed(1)}°C
            </div>
            <div className="text-xs">avg est. WBGT</div>
            <div className="mt-2 flex justify-between text-sm">
              <span>
                Max <strong className="tabular-nums">{z.max_wbgt.toFixed(1)}°C</strong>
              </span>
              <span>
                <strong className="tabular-nums">{z.worker_count}</strong>{" "}
                {z.worker_count === 1 ? "worker" : "workers"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}