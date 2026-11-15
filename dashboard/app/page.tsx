"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkers, useZones, useAlerts } from "@/lib/hooks";
import { useNow } from "@/lib/useNow";
import Header from "@/app/components/Header";
import NeedsAction from "@/app/components/NeedsAction";
import WorkerTable from "@/app/components/WorkerTable";
import ZoneGrid from "@/app/components/ZoneGrid";
import AlertLog from "@/app/components/AlertLog";

export default function Home() {
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const workers = useWorkers(() => setUpdatedAt(Math.floor(Date.now() / 1000)));
  const zones = useZones();
  const alerts = useAlerts();
  const now = useNow();
  const router = useRouter();
  const openWorker = (id: string) => router.push(`/workers/${encodeURIComponent(id)}`);

  // Active = not cleared yet (raised, acknowledged or escalated).
  const activeAlerts = alerts.data
    ? alerts.data.filter((a) => !(a.cleared_ts && a.cleared_ts > 0)).length
    : null;

  return (
    <>
      <Header activeAlerts={activeAlerts} updatedAt={updatedAt} now={now} />

      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-4">
        {workers.data && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">Needs action</h2>
            <NeedsAction workers={workers.data} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Zones</h2>
          {zones.error && !zones.data && (
            <p className="font-semibold text-critical">
              Zones could not be loaded: {zones.error.message}. Retrying every 10 s.
            </p>
          )}
          {!zones.data && !zones.error && <p className="text-concrete">Loading zones…</p>}
          {zones.data && <ZoneGrid zones={zones.data} />}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Workers</h2>
          {workers.error && !workers.data && (
            <p className="font-semibold text-critical">
              Workers could not be loaded: {workers.error.message}. Retrying every 10 s.
            </p>
          )}
          {!workers.data && !workers.error && (
            <p className="text-concrete">Loading workers…</p>
          )}
          {workers.data && (
            <WorkerTable workers={workers.data} now={now} onSelect={openWorker} />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Alert log</h2>
          {alerts.error && !alerts.data && (
            <p className="font-semibold text-critical">
              Alerts could not be loaded: {alerts.error.message}. Retrying every 10 s.
            </p>
          )}
          {!alerts.data && !alerts.error && <p className="text-concrete">Loading alerts…</p>}
          {alerts.data && <AlertLog alerts={alerts.data} workers={workers.data} />}
        </section>
      </main>
    </>
  );
}
