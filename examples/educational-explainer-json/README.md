# Educational explainer from lesson JSON

Render one silent 30-second lesson about HTTPS from a reusable JSON template. The 1280 x 720 MP4 has an opening, three teaching points, an optional worked example and a takeaway. The same design can accept another reviewed lesson without changing the scene layout.

Related article: https://zvid.io/blog/tutorials/educational-explainer-video-template-json

## Setup

Use Node.js 22 or newer with npm and a Zvid API key from https://app.zvid.io/api-keys. The sample needs 30 render credits. No media hosting, narration recording or saved template is required.

Open a terminal in this example folder:

```sh
node --version
npm ci
npm run check
npm test
```

Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux. Set `ZVID_API_KEY` to your own key and keep `MAX_RENDER_CREDITS=30`. The npm commands load `.env`; existing process environment values take precedence. Never commit or share the key. If PowerShell blocks `npm.ps1`, use `npm.cmd` for the commands.

## Validate without a paid render

```sh
npm start
```

The script reads `data/lesson.json`, maps points to numbered cards, and sends `{payload: template, variables}` to `POST https://api.zvid.io/api/render/validate/api-key`. Validation does not consume render credits or create a job. Expect:

```text
6 scenes, 30 seconds. Estimate: 30 credits.
Saved out/resolved-project.json. No render submitted.
```

Read `out/resolved-project.json` to inspect the resolved copy, scene order and durations. `out/validation.json` includes the current account's estimate and warnings. The current estimate is authoritative. The script stops on any warning, unresolved placeholder, wrong scene count, unexpected text or duration mismatch. JSON validation is not a visual preview.

## Render and download once

```sh
npm run render
```

This repeats validation, checks the estimate against the configured ceiling, submits the exact resolved snapshot once and immediately saves the returned job ID in `out/run.json`. It tracks that job for up to ten minutes and downloads `out/https-lesson.mp4` when the state is `completed`. Rendering consumes credits. The supplied sample costs 30 credits; changing its duration or dimensions can change the estimate.

Watch the entire MP4. Check the title, Encrypt, Verify, Detect changes, Secure checkout and the takeaway. The video is intentionally silent and includes no subtitles separate from the visible teaching text. Verify new lesson facts, spelling, pacing, contrast and wrapping before sharing.

## Resume and handle failures

```sh
npm run resume
```

Resume tracks the saved job without submitting another render. A timeout stops local waiting, not the server job. `progress: 100` is not enough; the job must have `state: "completed"` and an unexpired HTTPS media URL. Failed jobs stop with the failure reason. Download failures can be retried with resume while the output remains available.

If submission lost its response before saving an ID, open **Renders** at https://app.zvid.io and identify the existing job. Then use:

```sh
npm run resume -- --job-id YOUR_JOB_ID
```

The example creates a submission-attempt marker before sending the POST. It refuses another paid submission from the same output directory, including uncertain outcomes. Before deliberately rendering changed lesson data, check the old job and rename `out` to preserve its evidence. Use one working directory per run. This teaching example does not implement a durable production queue.

- HTTP 401: check the API key and its account.
- HTTP 400: read the field details and correct the request.
- HTTP 402 or estimate above the ceiling: review credits and the quote before an intentional new submission.
- Warning, text, count or duration mismatch: inspect the saved validation response and changed template.
- Network errors: retain the job ID or inspect Renders before considering a new submission. The client does not automatically retry POST requests.

## Change the lesson

Edit `data/lesson.json`. Keep a single learning objective and one claim per point. This example's layout accepts one to three points, a 56-character title, 24-character point headings and 90-character point bodies. These are application limits chosen for these cards, not Zvid-wide limits. The copy must be plain text, with no HTML or template placeholders. A missing or empty field fails locally. `showExample` must be `true` or `false`, not a string.

`variablesFor` adds `01`, `02` and `03` labels in array order. The template uses `iterate: "points"` and `iterateAs: "point"` to expand the point scene. `condition: "{{showExample}}"` removes the six-second worked example when false. Both states produce one MP4.

The design has no overlapping transitions. Its duration is `4 + 5 * pointCount + (showExample ? 6 : 0) + 5`. The default is 30 seconds; three points without the example take 24 seconds. One point without the example takes 14 seconds. If you change scene timing or layout, update `expectedTimeline` and tests, validate again, and review the result. The fixed formula is an example assertion, not a general Zvid duration formula.

To add narration later, supply a licensed reachable recording, set scene durations from the final recording and prepare caption timings. Adding narration and transcription is outside this sample. Adding scenes or transitions changes the timeline and requires new checks.

## Files

- `data/lesson.json`: the reviewable lesson facts and Boolean example flag.
- `data/template.json`: reusable design, safe defaults, iteration and condition.
- `src/lesson.js`: application constraints, numbered-card mapping and resolved-result assertions.
- `src/index.js`: validate, render and resume commands.
- `src/api.js`, `src/helpers.js`: authentication, one-time submission, tracking and download.
- `tests/`: offline behavior tests. They do not call Zvid or spend credits.

Code: MIT. Support: https://zvid.io/contact

