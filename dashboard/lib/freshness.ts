"use client";

import { useSyncExternalStore } from "react";

// Remembers when each live feed last succeeded (Unix seconds).
export const LIVE_FEEDS = ["workers", "zones", "alerts"] as const;
export type LiveFeed = (typeof LIVE_FEEDS)[number];
type Snapshot = Partial<Record<LiveFeed, number>>;

export const STALE_AFTER_S = 30; // three missed 10 s polls

let snapshot: Snapshot = {};
const EMPTY: Snapshot = {};
const listeners = new Set<() => void>();

// Called from SWR's onSuccess, never during render.
export function markFresh(feed: LiveFeed) {
  snapshot = { ...snapshot, [feed]: Math.floor(Date.now() / 1000) };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFreshness(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

// The oldest last-success across all live feeds, so one stuck feed shows up.
// Null until every feed has succeeded at least once.
export function oldestFresh(s: Snapshot): number | null {
  const times = LIVE_FEEDS.map((f) => s[f]);
  return times.every((t) => t !== undefined) ? Math.min(...(times as number[])) : null;
}
