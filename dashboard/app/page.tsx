"use client";

import { useWorkers, useZones, useAlerts } from "@/lib/hooks";
import { useNow } from "@/lib/useNow";
import WorkerTable from "@/app/components/WorkerTable";
import ZoneGrid from "@/app/components/ZoneGrid";
import AlertLog from "@/app/components/AlertLog";

export default function Home() {
  const workers = useWorkers();
  const zones = useZones();
  const alerts = useAlerts();
  const now = useNow();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-4">
      <h1 className="text-2xl font-extrabold">HeatTrace</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Zones</h2>
        {zones.error && !zones.data && (
          <p className="font-semibold text-critical">
            Zones could not be loaded. Retrying every 10 s.
          </p>
        )}
        {!zones.data && !zones.error && <p className="text-concrete">Loading zones…</p>}
        {zones.data && <ZoneGrid zones={zones.data} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Workers</h2>
        {workers.error && !workers.data && (
          <p className="font-semibold text-critical">
            Workers could not be loaded. Retrying every 10 s.
          </p>
        )}
        {!workers.data && !workers.error && (
          <p className="text-concrete">Loading workers…</p>
        )}
        {workers.data && <WorkerTable workers={workers.data} now={now} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Alert log</h2>
        {alerts.error && !alerts.data && (
          <p className="font-semibold text-critical">
            Alerts could not be loaded. Retrying every 10 s.
          </p>
        )}
        {!alerts.data && !alerts.error && <p className="text-concrete">Loading alerts…</p>}
        {alerts.data && <AlertLog alerts={alerts.data} workers={workers.data} />}
      </section>
    </main>
  );
}
