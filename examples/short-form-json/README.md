# Short-form videos from JSON

Turn three messages into a 12-second, 1080 × 1920, 30fps MP4 using Zvid. The supplied video has three typography scenes and no audio. It creates a file for review; it does not upload to Instagram, YouTube or TikTok.

Related article: https://zvid.io/blog/developer-tutorials/generate-tiktok-reels-shorts-from-json

## Setup

Use Node.js 22.9 or newer and npm. Open a terminal in this folder and run:

```sh
node --version
npm ci
npm run check
npm test
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`. Copy `.env.example` to `.env`: run `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux. Create an API key at https://app.zvid.io/api-keys and paste it after `ZVID_API_KEY=` in `.env`. Leave `MAX_RENDER_CREDITS=12` for the supplied sample. The scripts load `.env` automatically; existing process environment variables take precedence. Keep the key private.

## Validate and render

```sh
npm start
```

This builds `out/project.json`, validates the request with Zvid and saves `out/validation.json`. Validation does not consume render credits. Expect `Valid: true. Estimated credits: 12.` for the supplied sample, followed by `No render submitted.` Read the current estimate before rendering. The script stops on warnings, invalid input or an estimate above the configured ceiling.

```sh
npm run render
```

Rendering spends credits. The script validates again, submits once, saves the job ID in `out/run.json`, waits for `state: "completed"` and downloads `out/short-form.mp4`. It checks every two seconds for up to ten minutes. An `active` job at 100% is not yet complete. Job failures stop the script and remain in `out/job.json`.

If tracking or download is interrupted:

```sh
npm run resume
```

Resume uses the saved job ID and never submits a render. A submission attempt is recorded before the request, and automatic submission retries are disabled. If the request outcome is uncertain and no job ID was returned, inspect Renders at https://app.zvid.io before doing anything that might create a second job. Before a deliberately new render, inspect the previous job and rename `out/` to preserve its record. A finished output can expire, so download it promptly.

## Change the video

Edit `data/content.json`. `series` labels the video; `beats` supplies three title/detail pairs; `secondsPerScene` sets each scene's duration. This teaching layout accepts exactly three beats, titles up to 40 characters, details up to 64, and scene durations from 3 to 8 seconds. These are example rules for keeping the layout readable, not general Zvid restrictions.

`src/project.js` maps the content into Zvid `TEXT` elements. It keeps text in an inset region from x=120 to x=900 and y=380 to y=1520. This is a starting layout, not an official or guaranteed platform safe area. Review each destination app's upload preview for overlays and cropping. Longer text can shrink through `fitToBox`; always review readability. Increasing the duration can raise the credit estimate and may require a deliberate change to the ceiling.

The three scenes use hard cuts, so 4 + 4 + 4 = 12 seconds. No footage, music, transcription or social-publishing integration is included. The files contain no large media or credentials. The project is generated from the content file on every validation/render run; `out/project.json` is useful for inspection, not the maintained input.

## Offline tests

`npm test` checks content mapping, layout bounds, invalid inputs, credit ceilings, completed/failed states, download behavior and duplicate submission protection. It uses mocks for API behavior, requires no credentials and spends no credits.

Support: https://zvid.io/contact
