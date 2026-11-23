import { connection, NextRequest, NextResponse } from "next/server";
import type { Worker } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { mockHistory } from "@/lib/mockHistory";
import { intParam } from "@/lib/params";
import { mockMode, proxy } from "@/lib/upstream";
import workersData from "@/mock/workers.json";

// GET /api/workers/{id}/history?hours=8  ->  [{ ts, wbgt, t_air, rh }]
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/workers/[id]/history">
) {
  await connection();
  const { id } = await ctx.params;
  const hours = intParam(req.nextUrl.searchParams.get("hours"), {
    fallback: 8,
    min: 1,
    max: 24,
  });
  if (hours === null) {
    return NextResponse.json(
      { error: "hours must be a whole number from 1 to 24." },
      { status: 400 }
    );
  }

  if (!mockMode()) {
    return proxy(`/workers/${encodeURIComponent(id)}/history?hours=${hours}`);
  }

  const worker = rebase(workersData as unknown as Worker[]).find(
    (w) => w.worker_id === id
  );
  if (!worker) {
    return NextResponse.json({ error: `No worker with id ${id}.` }, { status: 404 });
  }
  return NextResponse.json(mockHistory(worker, hours));
}
