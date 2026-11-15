"use client";

import { SITE } from "@/lib/site";
import { useWind } from "@/lib/hooks";
import { timeAgo } from "@/lib/time";

interface Props {
  activeAlerts: number | null; // null while alerts are loading
  lastUpdated: number | null; // oldest last-success across the live feeds
  stale: boolean; // the StatusBanner below explains; here it just turns yellow
  now: number | null;
}

export default function Header({ activeAlerts, lastUpdated, stale, now }: Props) {
  const wind = useWind();

  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-3">
        <div>
          <p className="text-sm text-white/70">HeatTrace heat-stress board</p>
          <h1 className="text-2xl leading-tight font-extrabold">{SITE.name}</h1>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-white/70">Active alerts</dt>
            <dd>
              {activeAlerts === null ? (
                "…"
              ) : activeAlerts > 0 ? (
                <span className="inline-block rounded bg-critical px-2 text-lg font-extrabold tabular-nums">
                  {activeAlerts}
                </span>
              ) : (
                <span className="text-lg font-extrabold">None</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-white/70">Wind (NEA)</dt>
            <dd className="text-lg font-extrabold tabular-nums">
              {wind.data ? (
                <span title={`Station ${wind.data.station}`}>{wind.data.knots.toFixed(1)} kn</span>
              ) : wind.error ? (
                <span className="text-base font-semibold text-white/70">Unavailable</span>
              ) : (
                "…"
              )}
            </dd>
          </div>

          <div>
            <dt className="text-white/70">Last update</dt>
            <dd className={`text-lg font-extrabold ${stale ? "text-caution" : ""}`}>
              {lastUpdated === null ? "…" : timeAgo(lastUpdated, now) || "…"}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
