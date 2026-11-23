import { Suspense } from "react";
import WorkerDetail from "./WorkerDetail";

// Server shell for the drill-down. The worker id is only known at request
// time, so with Cache Components the client view streams in inside Suspense.
export default function WorkerPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-4 text-concrete">
          Loading worker…
        </main>
      }
    >
      <WorkerDetail />
    </Suspense>
  );
}
