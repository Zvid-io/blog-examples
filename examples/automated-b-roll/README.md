# Automate B-roll from a timed JSON cue sheet

Build a silent 12-second, 720 × 1280 coffee sequence from three approved clips. The example maps output timing and source trims into Zvid scenes, validates the request, submits one render, saves its ID and downloads the completed MP4.

Related article: https://zvid.io/blog/developer-tutorials/how-to-add-b-roll-automatically-with-json

## Setup

Use Node.js 22 or newer and npm. Open a terminal in this folder and run:

```sh
npm ci
npm run check
npm test
npm run build
```

`build` creates `out/request.json` offline. Tests use simulated API responses and do not spend credits. The media URLs are already provided in `data/cue-sheet.json`; no upload is required.

For API access, create a key at https://app.zvid.io/api-keys. Copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux or `Copy-Item .env.example .env` in PowerShell), then set:

```dotenv
ZVID_API_KEY=
MAX_RENDER_CREDITS=12
```

Paste your key after `ZVID_API_KEY=`. Commands load `.env`; existing process environment variables take precedence. Keep the file private. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`.

## Validate, render and resume

```sh
npm start
```

This calls Zvid validation without submitting a render or consuming render credits. Expect `Valid: true. Estimated credits: 12.` and `No render submitted.` Inspect `out/validation.json`. The script rejects warnings and estimates above the configured ceiling. That ceiling is a client-side check, not an atomic server billing cap.

```sh
npm run render
```

Rendering spends credits. The unchanged example is estimated at 12 credits. Validation applies your account's current limits and estimate. Submission records an attempt before the paid request; it never automatically retries the submission. The returned job ID is saved before polling. Tracking checks every five seconds for up to ten minutes and waits for `state: "completed"`, not merely 100% progress.

Success writes `out/coffee-broll.mp4`. Watch all 12 seconds: beans at 0-4, espresso at 4-8, milk at 8-12, each with a matching label. There is intentionally no sound. The three clips illustrate a coffee sequence; they do not document one continuous preparation.

```sh
npm run resume
```

Resume follows the saved job without submitting another render. After an uncertain submission without a saved ID, check Renders at https://app.zvid.io first. Recover a known ID with:

```sh
npm run resume -- --job-id YOUR_JOB_ID
```

If a job failed, inspect `failedReason` in `out/job.json` before correcting the input. Before a deliberately new render, inspect the previous job and rename `out` to preserve its records. Do not delete an uncertain attempt and blindly retry. Keep the downloaded MP4 before hosted output expires.

## What to edit

- `data/cue-sheet.json`: approved URLs, editorial intent, output intervals, source trim windows and labels.
- `data/ai-planning-prompt.txt`: optional prompt for an AI assistant to propose visual intents and search phrases. No AI service is called by this code.
- `src/project.js`: reusable scene layout and application input rules.
- `src/index.js`: API orchestration. Requests go to https://api.zvid.io with the key; media downloads receive no credential.

The builder uses `duration = end - start`, maps `sourceBegin`/`sourceEnd` to `videoBegin`/`videoEnd`, and starts each clip at zero on its own scene timeline. Scenes play in array order. Hard cuts preserve the cue sheet's total duration. `resize: "cover"` fills the vertical frame and can crop the source; `volume: 0` mutes its audio.

This example requires contiguous, approved, normal-speed shots, matching source-window lengths, unique lowercase IDs, HTTPS URLs and labels of up to 40 characters. Those are teaching-application choices, not universal Zvid restrictions. `sourceDuration` is your recorded source inspection; the builder does not probe the remote file, verify rights or judge visual relevance. Zvid validation cannot replace watching the output.

For new footage, preview the complete source and chosen crop, check usage rights and accessibility, choose a four-second action, then update its source metadata and set `approved` only after review. The approval flag records a decision; it does not enforce an organizational approval process. Do not ask an AI assistant to invent media URLs, licensing records or approval flags.

The example assembles supporting footage. It does not transcribe speech, generate video clips, add narration, insert shots into an existing talking-head video or publish to social platforms. AI planning is optional and may have separate provider costs.

## Reference

- https://docs.zvid.io/docs/structure/video-elements/
- https://docs.zvid.io/docs/structure/scenes/
- https://docs.zvid.io/docs/validate-and-estimate/
- https://docs.zvid.io/docs/operations/render-lifecycle/

Code is MIT licensed. Linked sample footage has separate rights; the code license does not relicense media. Support: https://zvid.io/contact
