# One story, three short-form video variants

Build TikTok, Instagram Reels and YouTube Shorts review files from one JSON content record and three explicit layout profiles. This example creates silent 1080 × 1920 H.264 MP4s at 30fps: 12 seconds for the `tiktok` profile, and 14 seconds for `reels` and `shorts` with distinct two-second endings.

Article: https://zvid.io/blog/tutorials/generate-tiktok-reels-shorts-from-json

The profile names identify intended destinations. Their coordinates and endings are demonstration choices, not official platform safe areas, upload guarantees or current platform specifications. Review actual files in each native upload preview before publishing. No social posting, AI model call, transcription, stock media or narration is included.

## Requirements and setup

Use Node.js 22.9 or newer, npm, and a Zvid API key from https://app.zvid.io/api-keys. Keep the key on your computer or server.

```sh
npm ci
```

Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS/Linux. Put your key after `ZVID_API_KEY=`. The npm commands load `.env` automatically. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`.

```dotenv
ZVID_API_KEY=
MAX_RENDER_CREDITS=40
```

## Build, validate, render and recover

`data/content.json` contains the shared checklist. `data/profiles.json` controls text-box width, vertical position and the optional end card. `src/project.js` builds complete inline Zvid projects. No stored template is created.

```sh
npm run build
npm start
```

Build only writes three requests under `out/<profile>/request.json`; it needs no key or API access. `npm start` authenticates to Zvid and validates all three requests without submitting a render. The supplied set estimates 40 render credits in total. Validation does not consume render credits. The program refuses invalid requests, warnings, missing estimates or a combined estimate above `MAX_RENDER_CREDITS`.

```sh
npm run render
```

Rendering spends credits. This command validates again, submits three individual jobs, saves each job ID before continuing, waits for completion, and downloads:

- `out/tiktok/video.mp4`
- `out/reels/video.mp4`
- `out/shorts/video.mp4`

The example records the batch before the first submission and each attempt before its POST. It does not retry render submissions. A lost response may still mean the job was accepted. If any submission fails, later variants may be unsubmitted; inspect the saved records rather than assuming all three exist.

```sh
npm run resume
```

Resume tracks and downloads saved job IDs without submitting any new job. An unknown submission result is reported and left for investigation in **Renders** at https://app.zvid.io. Tracking has a ten-minute deadline per job; reaching the deadline does not cancel the remote render. A job at 100% progress can still be active. Only `state: "completed"` permits downloading. Failures are in `out/<profile>/job.json`.

Download completed output promptly because hosted URLs expire. After checking every existing job, a deliberately new batch needs a new output folder: rename `out` to preserve its records, then run again. This submits all three variants and spends credits again. This teaching example does not provide automatic partial resubmission or queue reconciliation.

## Customize deliberately

Keep the supplied files for your first run. Then edit the three titles/details in `data/content.json`. The limits of three beats, 40-character titles, 64-character details and 3–8 seconds per beat belong to this compact layout, not to Zvid generally. Text is kept on one line in JSON, but the renderer wraps it inside its box.

AI can help draft copy outside this program. Review facts and lengths, then place the approved values in the supplied schema. Never put API keys or private client notes in a prompt. Zvid renders the provided project; it does not write the script in this example.

Change `data/profiles.json` only after inspecting the intended destination. These profiles demonstrate content/layout separation. They are not endorsements of one ending or margin for a given platform. Add post captions and clickable destination links in the publishing interface; text in an MP4 is not clickable.

## Offline checks

```sh
npm run check
npm test
```

Tests cover the shared story, profile differences, input constraints, aggregate credit ceiling, saved job identifiers, lost submission responses, completion handling and media downloads without API credentials. CLI tests use mocked HTTP responses and do not contact Zvid or spend credits.

Support: https://zvid.io/contact
