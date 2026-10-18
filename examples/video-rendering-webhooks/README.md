# Reliable Zvid webhook receiver

Companion to [Video Rendering Webhooks](https://zvid.io/blog/engineering/video-rendering-webhooks). Run a signed HTTP receiver, save events before acknowledging them, and turn repeated notifications into one durable application action.

This is a compact teaching implementation for **one Zvid account and one registered endpoint**. It does not submit renders, download videos, send notifications or publish content. The outbox is a table of work for your application, not an implemented delivery service.

## Run the offline example

Use Node.js **22.13 or newer** and npm. Node's built-in SQLite module may print an experimental warning on these versions. No dependencies, account or API key are required for these commands. Open a terminal in this folder:

```sh
npm ci
npm run check
npm test
npm run demo
```

In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. Expect 13 passing tests. The demo starts a loopback receiver on a temporary port, sends three locally signed synthetic completion events and processes them. It prints:

```text
HTTP responses: 204, 204, 204
Processing: {"processed":2,"deferred":0}
Source cream-01: completed
Inbox deliveries: 2; outbox actions: 1
```

Each run retains a fresh database under `out/demo-*/`. The sample associates source `cream-01` with an illustrative job UUID and an existing Zvid CDN video. No new video is created, fetched or verified by the demo. Offline commands do not consume Zvid credits.

## Connect a registered endpoint

1. Prepare a public HTTPS reverse proxy or development tunnel forwarding `/hooks/zvid` to `http://127.0.0.1:8787/hooks/zvid`. Keep the request body unchanged, do not redirect, and retain the proxy's own request-size and connection limits. Zvid cannot deliver directly to localhost or private addresses.
2. Open https://app.zvid.io/webhooks. Click **Add webhook**, enter your HTTPS **Endpoint URL**, select **Render completed** and **Render failed**, then **Add webhook**. In **Webhook Created**, click **Copy secret**. Endpoint availability depends on the allowance shown on this page; disabled endpoints still use a slot.
3. Copy `.env.example` to `.env`. Set `ZVID_WEBHOOK_SECRET` to that signing secret. Keep the file private. The CLI automatically loads `.env` in the current folder; process variables take precedence. The secret is not an API key.
4. Start the receiver:

```sh
npm start
```

5. In the dashboard, click **Send test**, then **Deliveries**. Queued means submitted, not delivered. Expect a success record with HTTP 204. In another terminal in this same folder, run:

```sh
npm run process
npm run status
```

The synthetic test carries `test: true`. It is recorded and marked processed without producing an outbox action, even when no job header is present. Sending this dashboard test does not create a video or consume render credits; its payload's URLs and credit amounts are illustrative.

## Connect your existing render-submission code

This example starts at receiving events. Use your existing render submission and save the returned job ID against your own source ID immediately. The [render lifecycle guide](https://docs.zvid.io/docs/operations/render-lifecycle/) covers submission. Rendering consumes credits; this example contains no render command.

For a manual integration check, replace `YOUR_JOB_UUID` with a real returned ID:

```sh
npm run track -- YOUR_JOB_UUID cream-01
npm run process
npm run status
```

`track` is a local database write, not an API call. A real completion stores `data.url`; failure stores `data.error`. Unknown jobs remain pending with `job not tracked yet`; record the mapping and rerun `process`. The worker handles up to 100 pending deliveries per invocation. Schedule it repeatedly and alert on growing pending rows. The demo's database is separate from the receiver database at `out/receiver.sqlite`.

`renders` holds your source/job mapping. `inbox` is the durable receipt log. `outbox` stores a single intent keyed by job ID and terminal state. An external dispatcher must use this action key as its downstream idempotency key and implement retries and durable delivery acknowledgement. Without downstream idempotency, a crash after sending but before marking sent can repeat an external action.

## Recover a missed event

Create an API key at https://app.zvid.io/api-keys and set `ZVID_API_KEY` in `.env`. Run:

```sh
npm run reconcile
npm run status
```

This makes one sequential lookup for each tracked, nonterminal job using `GET https://api.zvid.io/api/jobs/{id}`. It uses the same database transition as the worker. It accepts both a URL string and `{ "url": "..." }` under `result`; it reads failure details from `failedReason`. It does not create renders or consume render credits. A missing/expired completed output stops with an error instead of creating a ready action.

Schedule bounded reconciliation for aged jobs and add rate-limit backoff to your scheduler. The small CLI is one pass, stops on the first API error, and does not provide a scheduler. Do not submit another render to repair a missing notification. For terminal conflicts, inspect the authoritative job and existing business effects before any manual repair.

## How the receiver behaves

- Verify HMAC-SHA256 over `<header timestamp>.<raw bytes>` before parsing JSON. Require a signing timestamp within five minutes of the receiver's clock, including future skew. This window is application policy; keep clocks synchronized.
- Accept only JSON, a one-megabyte body, a supported event envelope and consistent event/job headers. The signature authenticates the timestamp and body, not the delivery ID. Business deduplication therefore also uses the job identity in the signed body.
- Commit the inbox before HTTP 204. SQLite uses WAL and full synchronous writes; production durability still depends on persistent storage and backups.
- Repeated delivery IDs are no-ops when the raw-body digest matches. A differing body for the same ID returns 409 for investigation. Distinct delivery IDs for the same job do not repeat the outbox action.
- Process job state, outbox intent and inbox completion in one transaction. Unknown jobs, conflicts and failed writes retain pending receipts with a diagnostic problem.
- Return 401 for signature errors, 400 for malformed events, 413 for excessive bodies, 415 for unsupported content and 503 when storage fails. **Zvid retries all non-2xx responses**, including 4xx, within its finite attempt budget.

Zvid currently makes at most five total delivery attempts: the first plus retries after approximately 30 seconds, 60 seconds, 2 minutes and 4 minutes. Attempts time out after 10 seconds. After 20 consecutive deliveries exhaust retries, a registered endpoint is disabled. Repair it and use **Enable**, then **Send test**. Enabling does not replay missed events.

## Before deployment

Supply HTTPS termination, process supervision, persistent local storage, backups, an outbox dispatcher, a worker schedule, inbox retention, alerts and operational repair procedures. The synchronous SQLite sample is for a single host. It is not a throughput benchmark or a distributed deployment; move the same uniqueness constraints and transaction boundaries to your shared database before scaling horizontally. Bound retry age and quarantine repeated worker failures so a backlog does not starve newer work. Add output retention and download authorization before publishing links to users. The receiver records URLs; it does not fetch them or extend Zvid output expiry.

Unsigned per-request `webhookUrl` callbacks intentionally fail this receiver's signature check. Use a registered signed endpoint, or implement a separate unsigned-hint path that retrieves jobs with your own credentials before acting. For multiple accounts, isolate secrets and namespace inbox/job/action keys by account and endpoint.

## Files

- `src/receiver.mjs`: raw-body HTTP route, signature and envelope checks.
- `src/store.mjs`: inbox, render ledger, transactional worker and outbox intent.
- `src/cli.mjs`: receiver, local tracking, worker, status and API reconciliation commands.
- `src/demo.mjs`: signed synthetic requests and a local demonstration.
- `tests/receiver.test.mjs`: offline HTTP, persistence, failure and reconciliation checks.

Code: MIT. Linked media is separate from this code license.

Support: https://zvid.io/contact
