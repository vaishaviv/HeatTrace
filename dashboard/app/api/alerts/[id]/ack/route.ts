import { connection, NextResponse } from "next/server";
import type { Alert } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { recordAck } from "@/lib/mockState";
import { mockMode, proxy } from "@/lib/upstream";
import alertsData from "@/mock/alerts.json";

// POST /api/alerts/{id}/ack: the supervisor's "Mark resting".
// The only write the dashboard makes. In the cloud, the Lambda sets ack_ts and
// tells the hat to clear its LED.
export async function POST(_req: Request, ctx: RouteContext<"/api/alerts/[id]/ack">) {
  await connection();
  const { id } = await ctx.params;
  if (!mockMode()) {
    return proxy(`/alerts/${encodeURIComponent(id)}/ack`, { method: "POST" });
  }

  const alert = rebase(alertsData as unknown as Alert[]).find((a) => a.alert_id === id);
  if (!alert) {
    return NextResponse.json({ error: `No alert with id ${id}.` }, { status: 404 });
  }
  if (alert.cleared_ts) {
    return NextResponse.json({ error: "This alert has already cleared." }, { status: 409 });
  }

  const ack_ts = alert.ack_ts ?? recordAck(id, Math.floor(Date.now() / 1000));
  return NextResponse.json({ alert_id: id, ack_ts });
}
