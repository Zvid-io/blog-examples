# Video template validation

Run a matrix of input states against one release-status template, then explicitly render the representative video. The result is a silent 1280 x 720 MP4 with four scenes and a 10.5-second timeline.

Related article: https://zvid.io/blog/developer-tutorials/video-template-validation

## Setup

Use Node.js 22 or newer with npm, a Zvid account and an API key from https://app.zvid.io/api-keys. Your account must allow the supplied dimensions and durations. No saved template slot or hosted source media is needed. The template file is submitted inline as `payload`; request-level `variables` select each case.

Open a terminal in this folder:

```sh
node --version
npm ci
npm run check
npm test
```

Copy `.env.example` to `.env`: use `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS/Linux. Set `ZVID_API_KEY` to your key. Keep `MAX_RENDER_CREDITS=11`. Node loads `.env` through the npm commands; existing process environment values take precedence. Never commit or share the key. In PowerShell, use `npm.cmd` if your policy blocks `npm.ps1`.

## Check without rendering

```sh
npm start
```

This calls `POST https://api.zvid.io/api/render/validate/api-key`. It creates no saved template or render job and consumes no render credits. Expect 12 PASS lines, an 11-credit estimate for the representative video, and `Matrix passed. No render submitted.` Current account validation and its estimate are authoritative.

| Case | Scenes | Seconds |
| --- | --- | --- |
| representative | 4 | 10.5 |
| long-copy | 4 | 10.5 |
| empty-items | 2 | 5.5 |
| cta-off | 3 | 8 |
| minimum | 1 | 3 |
| maximum-items | 5 | 13 |

The two API-negative cases deliberately bypass the sample input checks: a string in `items` and a missing `item.value` must produce HTTP 400 with resolution field details. Four other cases must be rejected locally: a string Boolean, an unknown variable, four items, and a 65-character title. Authentication/network errors do not count as expected data failures.

The sample's policy allows at most three items, title up to 64 characters, label up to 28, value up to 20 and CTA up to 48. Text must be nonempty and contain no HTML or template braces. `showCta` must be Boolean. These are example application rules, not Zvid-wide limits or a guarantee of text fit.

Open `out/matrix.json` for the summary and `out/<case>-validation.json` for each resolved `payload`, estimate and warnings. The script checks exact title/status/CTA text, scene order, count and duration. The current example stops on every warning. Review the warning's meaning before changing this policy. Files are replaced by another validation run; preserve them if you want comparisons. Keep output logs private when using real business data.

## Render once and download

```sh
npm run render
```

Rendering spends credits. This command reruns the full matrix, checks the representative estimate against the 11-credit ceiling, submits its resolved snapshot once, saves `out/run.json`, polls the job for at most ten minutes and downloads `out/release-status.mp4`. It renders only the representative case, not all six valid cases. Increase the ceiling only after reviewing a changed estimate and intentionally approving the additional cost.

The submitted request is saved in `out/request.json`. Rendering the resolved inline snapshot keeps the approved values and design together. The `requestSha256` in the run record identifies those submitted bytes in canonical form.

Watch the entire video: title, API Ready, Editor Ready, and Review the final render. Check transitions, text wrapping, contrast and the final frame. Schema checks do not prove layout quality. The long-copy case is structurally tested but is not rendered by this command; inspect or render changed visual states before approving your own design.

## Resume and failures

```sh
npm run resume
```

Resume tracks the saved job and downloads its result without another submission. Success requires `state: "completed"` and an unexpired HTTPS output URL. `progress: 100` is insufficient. `failed` stops with `failedReason`; a timeout stops local waiting without cancelling the server job. A download failure can be retried with resume.

If submission lost its response before saving an ID, check **Renders** at https://app.zvid.io. Once you identify the existing job, use:

```sh
npm run resume -- --job-id YOUR_JOB_ID
```

A submission-attempt marker blocks accidental reruns, including uncertain outcomes. Before deliberately making a new video, inspect the old job and rename `out` to preserve it. Do not delete a marker just to retry. Use one working directory per run; this is a small local example, not a durable production job system.

- HTTP 401: check the key. No input case should pass by producing an authentication error.
- HTTP 400: read the field and message. Only the two named negative fixtures expect this response.
- Warning/count/duration/content mismatch: inspect that case's saved validation response and the changed design.
- HTTP 402 or estimate above the ceiling: review available credits and the current quote before a new submission.
- HTTP errors/HTML responses/timeouts: the client makes no automatic POST retries; retain any saved job ID.

## Files and customization

- `data/template.json`: one design with defaults, `iterate` and `condition`.
- `data/cases.json`: supplied input states and expected outcomes.
- `src/preflight.js`: application rules, structural/content assertions and matrix execution.
- `src/api.js`: the REST paths and JSON/error handling.
- `src/helpers.js`: one-time submission, polling, expiry and download handling.
- `tests/`: offline behavior checks; no credentials or paid requests.

Edit the template and fixtures together. Keep independent cases for each boundary instead of changing several unrelated properties in one test. Add actual visual review for long copy, different scripts/fonts, altered layouts and changed conditional structure. If you add external media, check its availability, format and crop separately; submission validation is not a complete remote-media download or visual test.

For an existing stored template, `POST /api/templates/{id}/preview` with `{ "variables": {...} }` returns HTTP 200 `{project, stats}` without credits, a job ID or media. Check that project, then validate it under `{payload: project}` for warnings and an estimate. This example uses the inline validation route so it runs without creating a stored template.

Code: MIT. Support: https://zvid.io/contact
