# HeatTrace supervisor dashboard

A phone-first board for site supervisors: who needs action now, how hot each
zone is, every worker's WBGT, the alert and escalation log, and the hourly
MOM record. Next.js 16 (App Router), React 19, Tailwind v4, SWR, recharts.

The dashboard never talks to the hats or MQTT. The browser only calls this
app's own `/api/*` routes. Those serve mock data, or proxy to the cloud read
API with the API key added on the server.

## Run it

```bash
npm install
cp .env.example .env.local   # mock mode by default
npm run dev                  # http://localhost:3000
```

`npm run build`, `npm run lint` and `npx tsc --noEmit` should all pass before
a commit. Only one `next dev` can run per folder; a second one prints the PID
of the first.

To open it on a phone over Wi-Fi, add your PC's LAN IP inside `nextConfig`
in `next.config.ts` (never as `module.exports`, which replaces the config):

```ts
allowedDevOrigins: ["192.168.0.105"],
```

## Mock or live data

| Variable | Meaning |
|---|---|
| `HT_USE_MOCK` | Anything but `false` serves `mock/*.json` and generated mocks. `false` proxies to the read API. |
| `HT_API_URL` | Base URL of the API Gateway HTTP API, no trailing slash. |
| `HT_API_KEY` | Sent as `x-api-key`. Server-side only; never add a `NEXT_PUBLIC_` prefix. |

In proxy mode, an upstream JSON 2xx or 4xx passes through. A non-JSON 4xx
(API Gateway's HTML pages) becomes a JSON error with the same status, and
anything else (timeout, 5xx, a non-JSON 200, unreachable) becomes a
`502 { "error": "..." }` that the UI shows.

Query parameters are checked before anything goes upstream: `since` is a
whole number of seconds (0 or more), `hours` a whole number from 1 to 24, and
`date` a real calendar day. Anything else gets a 400.

## Routes

| Browser calls | Read API path | Refresh | Mock source |
|---|---|---|---|
| `GET /api/workers` | `/workers` | 10 s | `mock/workers.json`, timestamps shifted to now |
| `GET /api/zones` | `/zones` | 10 s | `mock/zones.json` |
| `GET /api/alerts?since=<ts>` | `/alerts?since=` | 10 s | `mock/alerts.json` |
| `GET /api/workers/{id}/history?hours=8` | `/workers/{id}/history?hours=` | on open, then 60 s | `lib/mockHistory.ts` |
| `POST /api/alerts/{id}/ack` | `/alerts/{id}/ack` | on click | in-memory ack, worker resting 15 min (`lib/mockState.ts`) |
| `GET /api/mom-log?date=YYYY-MM-DD` | `/mom-log?date=` | 60 s | `lib/mockMom.ts` |
| `GET /api/wind` | none: NEA via data.gov.sg | 60 s | always live, cached 60 s per server |

Shapes are in `lib/types.ts` and follow the data contract in the build guide.
Timestamps are Unix seconds, UTC; the UI shows Singapore time. Worker
`status` and zone `band` come from the cloud and are never computed here.

**For the cloud team:** the guide does not name the MOM log fields. The
dashboard expects one row per zone per hour:
`{ zone, hour_ts, max_wbgt, rest_triggered }` (see `MomRow`). The ack
route should return 2xx on success and 409 if the alert already cleared.

## Layout

```
app/
  page.tsx                  the board: header, banner, needs action, zones, workers, tabs
  workers/[id]/             drill-down (server shell + WorkerDetail client view)
  api/                      route handlers (mock or proxy)
  components/               Header, EscalationBanner, NeedsAction, ZoneGrid, WorkerTable,
                            AlertLog, AckButton, Tabs, MomLog, WbgtChart, Pill, CsvButton
lib/
  types.ts                  data contract types
  hooks.ts                  SWR hooks and the shared fetcher
  upstream.ts               mock/proxy switch (server only)
  status.ts, bands.ts, alertState.ts   label, icon and colour per state
  time.ts, csv.ts, site.ts  SGT formatting, CSV export, site name and location
  mock*.ts, seeded.ts       mock generators
mock/                       seed JSON (8 workers, 4 zones, 5 alerts)
```

## Design

Safety-sign palette (ISO 7010 / ANSI Z535): green safe, yellow caution,
orange high, red critical and alert, blue resting. The colours are Tailwind
theme tokens in `app/globals.css` (`bg-critical`, `text-ink` and so on). The
board is light only, for legibility in direct sun, and set in Overpass, a
road-sign face. Every colour comes with an icon and a text label, so colour
is never the only signal.
