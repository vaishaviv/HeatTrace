"use client";

import { useEffect, useState } from "react";

// Current time in Unix seconds, ticking every second so "12 s ago"
// labels keep moving between the 10 s data polls.
// Starts as null and is set in an effect: calling Date.now() while
// rendering can error under Cache Components and cause hydration mismatches.
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}