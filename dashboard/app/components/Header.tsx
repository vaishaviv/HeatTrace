import { timeAgo } from "@/lib/time";

interface Props {
  siteName: string;
  activeAlerts: number | null; // null while loading
  windMps: number | null; // no endpoint yet, pass null
  lastUpdated: number | null;
  now: number | null;
}

export default function Header({
  siteName,
  activeAlerts,
  windMps,
  lastUpdated,
  now,
}: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-400 px-4 py-3">
      <div>
        <h1 className="text-xl font-bold">HeatTrace</h1>
        <p className="text-sm opacity-70">{siteName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          Wind{" "}
          <strong>{windMps !== null ? `${windMps.toFixed(1)} m/s` : "—"}</strong>
        </div>

        {activeAlerts === null ? (
          <span className="opacity-70">Alerts —</span>
        ) : activeAlerts === 0 ? (
          <span className="rounded-full bg-green-700 px-3 py-1 font-medium text-white">
            <span aria-hidden="true">✓ </span>No active alerts
          </span>
        ) : (
          <span className="rounded-full bg-red-700 px-3 py-1 font-medium text-white">
            <span aria-hidden="true">▲ </span>
            {activeAlerts} active {activeAlerts === 1 ? "alert" : "alerts"}
          </span>
        )}

        <div className="opacity-70">
          {lastUpdated !== null
            ? `Updated ${timeAgo(lastUpdated, now)}`
            : "Waiting for data..."}
        </div>
      </div>
    </header>
  );
}