"use client";

import type { Zone } from "@/lib/types";
import { BAND_META } from "@/lib/bands";

interface Props {
  zones: Zone[];
}

export default function ZoneGrid({ zones }: Props) {
  // Keep zones in a fixed order so each plate stays in the same place
  // between refreshes.
  const sorted = [...zones].sort((a, b) => a.zone.localeCompare(b.zone));

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {sorted.map((z) => {
        const meta = BAND_META[z.band];
        return (
          <li
            key={z.zone}
            className={`rounded-md border-2 border-ink p-3 ${meta.plate}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-extrabold">{z.zone}</span>
              <span className="text-sm font-semibold">
                <span aria-hidden="true">{meta.icon} </span>
                {meta.label}
              </span>
            </div>
            <div className="mt-1 text-4xl leading-none font-extrabold tabular-nums">
              {z.avg_wbgt.toFixed(1)}°
            </div>
            <div className="mt-1 text-sm">Average WBGT</div>
            <div className="mt-3 flex justify-between border-t border-current/30 pt-2 text-sm">
              <span>
                Max{" "}
                <strong className="tabular-nums">
                  {z.max_wbgt.toFixed(1)}°
                </strong>
              </span>
              <span>
                <strong className="tabular-nums">{z.worker_count}</strong>{" "}
                {z.worker_count === 1 ? "worker" : "workers"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
