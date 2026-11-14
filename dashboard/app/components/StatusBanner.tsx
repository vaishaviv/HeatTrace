import { timeAgo } from "@/lib/time";

interface Props {
  hasError: boolean;
  stale: boolean;
  lastUpdated: number | null;
  now: number | null;
}

export default function StatusBanner({
  hasError,
  stale,
  lastUpdated,
  now,
}: Props) {
  if (!hasError && !stale) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-amber-500 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950"
    >
      <span aria-hidden="true">⚠ </span>
      Live data unavailable.{" "}
      {lastUpdated !== null
        ? `Showing data from ${timeAgo(lastUpdated, now)}. `
        : ""}
      Do not rely on this screen until it recovers.
    </div>
  );
}