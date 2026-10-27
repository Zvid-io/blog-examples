# Build a news summary video from JSON

Turn three reviewed story records into a silent, 28-second, 720 × 1280 MP4 with source and date labels. The Harbor desk example is fictional. Its `example.com` URLs demonstrate source metadata and do not verify real events.

Related article: https://zvid.io/blog/tutorials/news-summary-video-template-json

## Requirements

- Node.js 22 or newer and npm.
- A Zvid API key created at https://app.zvid.io/api-keys.
- Credits for the current render estimate. The supplied composition was estimated at 28 credits; `MAX_RENDER_CREDITS=28` prevents a higher estimate from being submitted.

Validation does not consume credits. `npm run render` submits a paid render. Offline checks and tests do not call Zvid. This example has no third-party runtime dependencies and does not require a stored Zvid template.

## Install and configure

Download the article's example ZIP and extract it, then open a terminal in the extracted `news-summary-video-template-json` folder. From a repository checkout, use `examples/news-summary-video-template-json` instead.

```sh
npm ci
```

Copy `.env.example` to `.env`. On macOS or Linux:

```sh
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` in a text editor:

```dotenv
ZVID_API_KEY=zvid_replace_with_your_key
MAX_RENDER_CREDITS=28
```

The npm commands load `.env` using Node.js's `--env-file`. Keep the key local and out of source control, browser code, screenshots and project JSON. `.env.example` intentionally has a blank key.

## Check, validate, render and download

```sh
npm run check
npm test
npm start
```

`npm start` validates `data/stories.json` locally, sends the template and mapped variables to Zvid's validation endpoint, checks the expanded story copy and timeline, and saves `out/validation.json` and `out/resolved-project.json`. It submits no render. The supplied sample prints:

```text
5 scenes, 28 seconds. Estimate: 28 credits.
Saved out/resolved-project.json. No render submitted.
```

Read the current estimate and warnings. Check that the resolved scenes are `opening`, `story-1`, `story-2`, `story-3`, `closing`, and that each story has the correct title, summary and source line. A valid response is a structural check, not a visual preview or factual verification.

When ready to spend the quoted credits:

```sh
npm run render
```

This validates again, enforces the credit ceiling, records the submission attempt before its POST, saves the returned job ID, polls for completion and downloads `out/news-brief.mp4`. Inspect the entire video before posting it. The sample is silent and uses hard cuts: a four-second opening, three seven-second stories and a three-second ending.

## Resume without submitting again

If polling or downloading stops after an ID was saved:

```sh
npm run resume
```

If submission stopped before an ID was saved, open Renders at https://app.zvid.io and check whether the job exists. A lost response does not establish that submission failed. Once you have its UUID:

```sh
npm run resume -- --job-id YOUR_JOB_ID
```

Replace `YOUR_JOB_ID` with the actual UUID. Resume only tracks and downloads an existing job. It does not submit another render. Preserve `out/run.json` and `out/job.json`; the application refuses a new render when a submission marker already exists.

After a failed job, read its `failedReason` in `out/job.json`. After an expired output, check its status in the dashboard; resume cannot recreate deleted media. Resolve the cause and decide whether a new paid job is needed. For a new edition, use a fresh copy of the example so the previous run record remains available.

## Change the stories

Edit `data/stories.json`. The application derives the display number and source label from each record:

```text
sourceName: "Library notice" + publishedAt: "2026-10-27"
→ Library notice / 27 OCT 2026
```

The source URL remains in the input file; it is not displayed or fetched. Put real source links in the caption or page accompanying a published video. Text rendered into an MP4 is not a clickable link.

This example accepts one to three stories to keep the fixed layout short. Each story requires `approved: true`, a unique slug ID, a distinct HTTPS source URL without credentials, and a real calendar date no later than the edition date. The maximum lengths are 14 characters for a tag, 48 for a title, 76 for a summary and 22 for a source name. It rejects markup, unresolved placeholder syntax and unknown fields. These are application choices, not universal Zvid limits. The approval flag does not verify facts or fetch source pages.

`data/template.json` holds the layout and safe example defaults. Its repeated scene uses `iterate: "stories"`, `iterateAs: "story"` and seven-second durations. One, two and three stories produce 14-, 21- and 28-second videos respectively. Changing scene durations also requires updating `expectedTimeline` in `src/stories.js` and its tests.

Keep the visible `FICTIONAL DEMO` label while using the supplied stories. For real reporting, replace the invented records and presentation labels only after editorial review, then validate and inspect a new render. This program does not scrape, summarize, fact-check, add narration, schedule updates or publish to social platforms.

## Troubleshooting

| Result | What to do |
| --- | --- |
| `Set ZVID_API_KEY in .env` | Create `.env` from `.env.example` and add your actual key. |
| HTTP 401 | Check that the API key is current and copied correctly. The server-side client sends it in `x-api-key`. |
| Story validation error | Correct the named input field before contacting Zvid. `approved` must be the boolean `true`, not a string. |
| API validation error or warnings | Read `out/validation.json` when available and the printed API details. Correct the input or layout before rendering. |
| Estimate exceeds `MAX_RENDER_CREDITS` | Reduce the composition or deliberately change the ceiling after reviewing the current quote. |
| `A submission is already recorded` | Resume the existing job or preserve that run and use a fresh folder for a new edition. |
| Poll timeout or download failure | Run `npm run resume`; do not resubmit a paid render. |

Documentation: [authentication](https://docs.zvid.io/docs/authentication/), [validation and estimates](https://docs.zvid.io/docs/validate-and-estimate/), [dynamic content](https://docs.zvid.io/docs/templates/dynamic-content/), [render lifecycle](https://docs.zvid.io/docs/operations/render-lifecycle/).

Support: https://zvid.io/contact
