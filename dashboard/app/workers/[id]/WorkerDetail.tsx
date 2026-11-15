"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useHistory, useWorkers } from "@/lib/hooks";
import { useNow } from "@/lib/useNow";
import { STATUS_META } from "@/lib/status";
import { timeAgo } from "@/lib/time";
import Pill from "@/app/components/Pill";
import WbgtChart, { WBGT_LIMIT } from "@/app/components/WbgtChart";

const HOURS = 8;

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const workers = useWorkers();
  const history = useHistory(id, HOURS);
  const now = useNow();

  const worker = workers.data?.find((w) => w.worker_id === id);
  const buddy = worker?.buddy_id
    ? workers.data?.find((w) => w.worker_id === worker.buddy_id)
    : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4">
      <Link href="/" className="inline-block font-semibold underline underline-offset-4">
        Back to all workers
      </Link>

      {workers.error && !workers.data && (
        <p className="font-semibold text-critical">
          Worker details could not be loaded: {workers.error.message}
        </p>
      )}
      {!workers.data && !workers.error && <p className="text-concrete">Loading worker…</p>}
      {workers.data && !worker && (
        <p className="font-semibold">
          No worker with id {id}. Check the link, or go back to the full list.
        </p>
      )}

      {worker && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold">{worker.name}</h1>
              <p className="text-concrete">
                {worker.worker_id} in zone {worker.zone}
                {buddy ? `, buddy ${buddy.name}` : worker.buddy_id ? `, buddy ${worker.buddy_id}` : ""}
              </p>
            </div>
            <Pill
              icon={STATUS_META[worker.status].icon}
              label={STATUS_META[worker.status].label}
              className={`text-sm ${STATUS_META[worker.status].pill}`}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-ink py-3 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-concrete">WBGT</dt>
              <dd className="text-4xl leading-none font-extrabold tabular-nums">
                {worker.wbgt.toFixed(1)}°
              </dd>
            </div>
            <div>
              <dt className="text-sm text-concrete">Air temperature</dt>
              <dd className="text-2xl font-semibold tabular-nums">{worker.t_air.toFixed(1)}°</dd>
            </div>
            <div>
              <dt className="text-sm text-concrete">Humidity</dt>
              <dd className="text-2xl font-semibold tabular-nums">{worker.rh}%</dd>
            </div>
            <div>
              <dt className="text-sm text-concrete">Last reading</dt>
              <dd className="text-2xl font-semibold">{timeAgo(worker.last_seen, now) || "…"}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-extrabold">WBGT over the last {HOURS} hours</h2>
        <p className="text-sm text-concrete">
          The dashed red line marks {WBGT_LIMIT} °C. Times are Singapore time.
        </p>
        {history.error && (
          <p className="font-semibold text-critical">
            History could not be loaded: {history.error.message}
          </p>
        )}
        {!history.data && !history.error && <p className="text-concrete">Loading history…</p>}
        {history.data && history.data.length === 0 && (
          <p className="text-concrete">No readings in the last {HOURS} hours.</p>
        )}
        {history.data && history.data.length > 0 && <WbgtChart points={history.data} />}
      </section>
    </main>
  );
}
