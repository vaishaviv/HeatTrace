"use client";

import useSWR from "swr";
import type { Worker, Zone, Alert, HistoryPoint } from "@/lib/types";

const REFRESH_MS = 10_000; // poll every 10 s, per the guide

// Throws with the route's own { error } message when there is one, so the UI
// can say what went wrong.
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // body was not JSON; keep the status code
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const live = {
  refreshInterval: REFRESH_MS,
  keepPreviousData: true, // keep showing old data while a refresh is in flight
};

// Loaded once when a view opens; no polling.
const onOpen = {
  revalidateOnFocus: false,
  keepPreviousData: true,
};

export function useWorkers() {
  return useSWR<Worker[]>("/api/workers", fetcher, live);
}

export function useZones() {
  return useSWR<Zone[]>("/api/zones", fetcher, live);
}

export function useAlerts(since = 0) {
  return useSWR<Alert[]>(`/api/alerts?since=${since}`, fetcher, live);
}

export function useHistory(workerId: string, hours = 8) {
  return useSWR<HistoryPoint[]>(
    `/api/workers/${encodeURIComponent(workerId)}/history?hours=${hours}`,
    fetcher,
    onOpen
  );
}
