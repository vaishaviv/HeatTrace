"use client";

import useSWR from "swr";
import type { Worker, Zone, Alert } from "@/lib/types";
import { markFresh } from "@/lib/freshness";

const REFRESH_MS = 10_000; // poll every 10 s, per the guide

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

const options = (key: string) => ({
  refreshInterval: REFRESH_MS,
  keepPreviousData: true, // keep showing old data while a refresh is in flight
  onSuccess: () => markFresh(key), // record the last good fetch
});

export function useWorkers() {
  return useSWR<Worker[]>("/api/workers", fetcher, options("workers"));
}

export function useZones() {
  return useSWR<Zone[]>("/api/zones", fetcher, options("zones"));
}

export function useAlerts(since = 0) {
  return useSWR<Alert[]>(
    `/api/alerts?since=${since}`,
    fetcher,
    options("alerts")
  );
}