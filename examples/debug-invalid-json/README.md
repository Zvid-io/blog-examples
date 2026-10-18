# Debug a Zvid JSON request

Companion to [Debug Invalid JSON in the Zvid Video API](https://zvid.io/blog/troubleshooting/debug-invalid-json-video-api).

Requires Node.js 22 or newer. There are no dependencies to install.
Open a terminal in this extracted folder, beside debug.mjs.

Check syntax and the outer request shape without contacting Zvid:

```bash
node debug.mjs request.json
```

This is a small request precheck, not a complete Zvid schema validator.
For account-aware validation, get a key at https://app.zvid.io/api-keys.

PowerShell:

```powershell
$env:ZVID_API_KEY = "YOUR_API_KEY"
node debug.mjs request.json --api
```

macOS/Linux:

```bash
export ZVID_API_KEY="YOUR_API_KEY"
node debug.mjs request.json --api
```

The helper sends the exact file text to
https://api.zvid.io/api/render/validate/api-key. It writes
out/validation-response.json and exits with code 0 only when validation succeeds.
Exit code 1 means a local check, network request or remote validation failed.
It waits at most 30 seconds for the HTTP exchange and does not retry.
It never submits a render, creates a template or reserves render credits.
Read the resolved payload and warnings even after a successful validation.

The report may contain your supplied text, URLs, or an upstream HTML response.
Keep it private and redact it before sharing. The helper never prints your key or
the full response. Do not put credentials in request files or browser code.

## Independent failure cases

Each fixture changes one factor from request.json:

- fixtures/trailing-comma.json: invalid JSON syntax.
- fixtures/wrong-envelope.json: project without the required payload wrapper.
- fixtures/invalid-duration.json: duration 0; only the remote project validator rejects this.
- fixtures/missing-variable.json: text uses {{title}} without a value.
- fixtures/resolved-variable.json: the same placeholder with request variables.title = "JSON fixed".

Run any fixture by replacing request.json in the command. The first two stop
before any API call. Add --api for the schema and variable cases.
The example's explicit duration is three seconds. Its quoted render cost is
an estimate; validation is free and does not produce a video.

Run the offline tests:

```bash
node --test tests/debug.test.mjs
```

Tests simulate HTTP responses; they do not contact Zvid or prove media rendering.
To investigate your own request, save a copy as my-request.json and run the same commands.
The API can apply defaults or normalize fields; compare the resolved payload
with your intended text and settings.

Support: https://zvid.io/contact

The root `debug.mjs` command delegates to `src/debug.mjs`. Optional npm shortcuts are `npm start`, `npm run check`, `npm test`, and `npm run validate`. The direct Node.js commands above work without installing dependencies.
