// Types for the HeatTrace dashboard, matching the data contract.
// All timestamps are Unix seconds, UTC.

export type WorkerStatus =
  | "ok"
  | "alert"
  | "resting"
  | "escalated"
  | "offline";

export type ZoneBand = "safe" | "caution" | "high" | "critical";

// GET /workers (one row per worker)
export interface Worker {
  worker_id: string; // e.g. "W01"
  name: string;
  zone: string; // e.g. "Z3"
  buddy_id: string | null; // null if unpaired
  wbgt: number; // estimated WBGT, °C
  t_air: number; // air temperature, °C
  rh: number; // relative humidity, %
  status: WorkerStatus; // computed by the cloud, never by the dashboard
  last_seen: number; // Unix seconds
}

// GET /zones (one row per zone)
export interface Zone {
  zone: string;
  avg_wbgt: number;
  max_wbgt: number;
  worker_count: number;
  band: ZoneBand; // computed by the cloud
}

// GET /alerts?since=<ts>
export interface Alert {
  alert_id: string;
  worker_id: string;
  zone: string;
  wbgt: number;
  raised_ts: number;
  ack_ts: number | null;
  escalated_ts: number | null;
  cleared_ts: number | null;
}

// GET /api/wind (dashboard-only, from NEA via data.gov.sg)
export interface Wind {
  knots: number;
  station: string; // NEA station name, e.g. "Changi"
  ts: number; // Unix seconds of the NEA reading
}

// GET /workers/{id}/history?hours=8
export interface HistoryPoint {
  ts: number;
  wbgt: number;
  t_air: number;
  rh: number;
}