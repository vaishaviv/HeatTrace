"use client";

import { useWorkers, useZones, useAlerts } from "@/lib/hooks";
import { useNow } from "@/lib/useNow";
import { oldestFresh, STALE_AFTER_S, useFreshness } from "@/lib/freshness";
import { isActive } from "@/lib/alertState";
import Header from "@/app/components/Header";
import StatusBanner from "@/app/components/StatusBanner";
import EscalationBanner from "@/app/components/EscalationBanner";
import NeedsAction from "@/app/components/NeedsAction";
import WorkerTable from "@/app/components/WorkerTable";
import ZoneGrid from "@/app/components/ZoneGrid";
import AlertLog from "@/app/components/AlertLog";
import MomLog from "@/app/components/MomLog";
import Tabs from "@/app/components/Tabs";

export default function Home() {
  const workers = useWorkers();
  const zones = useZones();
  const alerts = useAlerts();
  const now = useNow();
  const fresh = useFreshness();

  // Freshness is judged by the oldest of the three live feeds, so one stuck
  // feed is enough to warn the supervisor.
  const lastUpdated = oldestFresh(fresh);
  const stale = now !== null && lastUpdated !== null && now - lastUpdated > STALE_AFTER_S;
  const hasError = Boolean(workers.error || zones.error || alerts.error);
  const activeAlerts = alerts.data ? alerts.data.filter(isActive).length : null;

  return (
    <>
      <Header activeAlerts={activeAlerts} lastUpdated={lastUpdated} stale={stale} now={now} />
      <StatusBanner hasError={hasError} stale={stale} lastUpdated={lastUpdated} now={now} />
      {alerts.data && <EscalationBanner alerts={alerts.data} workers={workers.data} />}

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
            <WorkerTable
              workers={workers.data}
              now={now}
              hrefFor={(id) => `/workers/${encodeURIComponent(id)}`}
            />
          )}
        </section>

        <section aria-label="Records">
          <Tabs
            label="Records"
            tabs={[
              {
                id: "alerts",
                label: "Alert log",
                render: () => (
                  <>
                    {alerts.error && !alerts.data && (
                      <p className="font-semibold text-critical">
                        Alerts could not be loaded: {alerts.error.message}. Retrying every 10 s.
                      </p>
                    )}
                    {!alerts.data && !alerts.error && (
                      <p className="text-concrete">Loading alerts…</p>
                    )}
                    {alerts.data && <AlertLog alerts={alerts.data} workers={workers.data} />}
                  </>
                ),
              },
              { id: "mom", label: "MOM log", render: () => <MomLog /> },
            ]}
          />
        </section>
      </main>
    </>
  );
}
