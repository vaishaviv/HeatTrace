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
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-xl font-bold">HeatTrace</h1>

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