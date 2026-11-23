import { timeAgo } from "@/lib/time";

interface Props {
  hasError: boolean; // any live feed's last request failed
  stale: boolean; // the oldest live feed is past STALE_AFTER_S
  lastUpdated: number | null;
  now: number | null;
}

// Full-width caution bar under the header when the board cannot be trusted:
// a live feed is failing, or one has not refreshed for 30 s. Safety-sign
// yellow with black text, like a warning sign.
export default function StatusBanner({ hasError, stale, lastUpdated, now }: Props) {
  if (!hasError && !stale) return null;

  return (
    <div role="alert" className="border-b-4 border-ink bg-caution text-ink">
      <p className="mx-auto w-full max-w-5xl px-4 py-3 font-semibold">
        <span aria-hidden="true">⚠ </span>
        Live data unavailable.{" "}
        {lastUpdated !== null ? `Showing data from ${timeAgo(lastUpdated, now)}. ` : ""}
        Do not rely on this screen until it recovers.
      </p>
    </div>
  );
}
