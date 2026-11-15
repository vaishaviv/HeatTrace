"use client";

import { useSyncExternalStore } from "react";

// Remembers when each endpoint last succeeded (Unix seconds).
type Snapshot = Record<string, number>;

let snapshot: Snapshot = {};
const EMPTY: Snapshot = {};
const listeners = new Set<() => void>();

export function markFresh(key: string) {
  snapshot = { ...snapshot, [key]: Math.floor(Date.now() / 1000) };
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