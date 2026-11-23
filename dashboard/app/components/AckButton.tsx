"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";

interface Props {
  alertId: string;
  workerName: string;
}

// "Mark resting": acknowledges the alert, which starts the worker's 15 min
// rest. Afterwards the alerts and workers lists refresh at once instead of
// waiting for the next 10 s poll.
export default function AckButton({ alertId, workerName }: Props) {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markResting() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/ack`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status}).`);
      }
      await mutate(
        (key) =>
          typeof key === "string" &&
          (key === "/api/workers" || key.startsWith("/api/alerts"))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={markResting}
        disabled={pending}
        aria-label={`Mark ${workerName} resting`}
        className="rounded border-2 border-ink bg-white px-3 py-1.5 font-semibold whitespace-nowrap hover:bg-rest hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Marking…" : "Mark resting"}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-48 text-xs font-semibold text-critical">
          Not marked: {error}
        </p>
      )}
    </div>
  );
}
