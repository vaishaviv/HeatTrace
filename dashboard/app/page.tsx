"use client";

import { useWorkers, useZones, useAlerts } from "@/lib/hooks";
import { useNow } from "@/lib/useNow";
import { useFreshness } from "@/lib/freshness";
import { isActive } from "@/lib/alertState";
import Header from "@/app/components/Header";
import StatusBanner from "@/app/components/StatusBanner";
import WorkerTable from "@/app/components/WorkerTable";
import ZoneGrid from "@/app/components/ZoneGrid";
import AlertLog from "@/app/components/AlertLog";

const SITE_NAME = "Demo site";
const STALE_AFTER_SEC = 30; // three missed 10 s polls
const FEEDS = ["workers", "zones", "alerts"] as const;

export default function Home() {
  const workers = useWorkers();
  const zones = useZones();
  const alerts = useAlerts();
  const now = useNow();
  const fresh = useFreshness();

  // Oldest last-success across all three feeds, so one stuck feed shows up.
  const times = FEEDS.map((k) => fresh[k]);
  const lastUpdated = times.every((t) => t !== undefined)
    ? Math.min(...(times as number[]))
    : null;

  const stale =
    now !== null && lastUpdated !== null && now - lastUpdated > STALE_AFTER_SEC;
  const hasError = Boolean(workers.error || zones.error || alerts.error);
  const activeAlerts = alerts.data
    ? alerts.data.filter(isActive).length
    : null;

  return (
    <main className="w-full space-y-6 p-4 lg:px-8">
      <Header
        siteName={SITE_NAME}
        activeAlerts={activeAlerts}
        windMps={null}
        lastUpdated={lastUpdated}
        now={now}
      />

      <StatusBanner
        hasError={hasError}
        stale={stale}
        lastUpdated={lastUpdated}
        now={now}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Zones</h2>
        {zones.error && !zones.data && (
          <p className="text-red-400">Could not load zones.</p>
        )}
        {!zones.data && !zones.error && <p>Loading zones...</p>}
        {zones.data && <ZoneGrid zones={zones.data} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Workers</h2>
        {workers.error && !workers.data && (
          <p className="text-red-400">Could not load workers.</p>
        )}
        {!workers.data && !workers.error && <p>Loading workers...</p>}
        {workers.data && <WorkerTable workers={workers.data} now={now} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Alert log</h2>
        {alerts.error && !alerts.data && (
          <p className="text-red-400">Could not load alerts.</p>
        )}
        {!alerts.data && !alerts.error && <p>Loading alerts...</p>}
        {alerts.data && (
          <AlertLog alerts={alerts.data} workers={workers.data} />
        )}
      </section>
    </main>
  );
}