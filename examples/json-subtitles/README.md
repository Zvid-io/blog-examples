# Add timed subtitles with Node.js

Companion to [Add timed subtitles to a video with Node.js and JSON](https://zvid.io/blog/developer-tutorials/how-to-add-subtitles-to-a-video-with-json).

This example creates an eight-second portrait MP4 with three supplied captions, then downloads it. It does not transcribe audio, publish the video or connect to an editor account.

[Watch the example output](https://cdn.zvid.io/blog/json-subtitles/9313d6db6c5a/subtitled.mp4)

![A frame from the subtitle example](https://cdn.zvid.io/blog/json-subtitles/640133905e92/subtitled-poster.jpg)

## Requirements and cost

- Node.js 22 or newer, with npm.
- A Zvid account with API access and a key from https://app.zvid.io/api-keys.
- Network access to https://api.zvid.io and the sample media host.
- An account that supports a 720 × 1280, eight-second video, with enough available render credits.

Budget 8 render credits for the supplied clip and check the current estimate before rendering. Validation does not render or reserve credits. The script defaults to validation, rejects warnings, and stops above `MAX_RENDER_CREDITS` (8 by default). Rendering spends credits.

## Run

Open a terminal in this folder, next to `package.json`.

```bash
npm ci
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` for all commands. Do not change the execution policy just to run this example.

Copy `.env.example` to `.env`: use `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux. Set `ZVID_API_KEY` to your own key in `.env`. Leave `MAX_RENDER_CREDITS=8` for this sample. Never commit the key or put it in JSON, logs or a browser application.

```bash
npm start
npm run render
```

The first command validates for free. Expect `Valid: true. Estimated credits: 8.` and `No render submitted.` Check `out/validation.json`. The second command validates again, submits one render, tracks it and saves `out/subtitled.mp4`. Success ends with `State: completed (100%)` and `Saved out/subtitled.mp4`.

Play the result. At 0.50 seconds, “Take a slow breath.” appears; at 2.66 seconds, “Notice the light on the water.” appears; at 5.14 seconds, “Stay here for a moment.” appears. Check the whole video with sound. The same footage and audio should remain, with no clipped text.

## Inputs and outputs

- [Source clip](https://cdn.zvid.io/blog/json-subtitles/7d445c404424/source.mp4): hosted sample footage, including AI-generated narration. Media is downloaded separately and is not included in this source package.
- `data/project.json`: video URL, canvas, duration and style. It points to the hosted source clip; no upload is needed.
- `data/captions.json`: three timed sentences, in seconds from the start of the finished video.
- `data/request.json`: complete initial `{ "payload": ... }` request for reference. The script instead assembles the current project/captions and saves `out/request.json` on each validation.
- `src/index.js`: runnable entry point using official `@zvid/sdk` 0.2.0.
- `src/helpers.js`: local caption/cost guards, time-bounded tracking and streaming download.
- `out/`: validation, submission, run and job records plus the downloaded video. Ignored by Git and excluded from the ZIP.
- Sample output and poster: the CDN links above. The source project is `data/project.json`.

`animation: "normal"` keeps each complete sentence visible. Font size and margins use canvas pixels. `volume: 1` preserves narration. `maxWordsPerLine` is intentionally omitted: it splits text into timed groups rather than merely wrapping a sentence onto simultaneous lines.

## Interruption and failure

```bash
npm run resume
```

This reads the saved job ID without submitting another render. It can resume tracking or repeat a failed download. A job marked `failed` remains failed; read `failedReason` in `out/job.json`. A local timeout does not cancel the server job. Hosted output can expire, so keep the downloaded MP4.

The SDK is configured with `maxRetries: 0` to avoid automatic paid POST retries. Each API request has a 30-second timeout, polling has a ten-minute deadline, and the media download has a two-minute timeout. A network error ends the current run; resume it explicitly after resolving the connection.

The script records a submission attempt before the paid POST. If the response was lost before a job ID was saved, inspect Renders at https://app.zvid.io before resubmitting. It deliberately refuses a second `--render` when `out/run.json` exists. To intentionally render a new version, check the prior job and rename `out` to preserve its record, then validate/render again. Do not run two copies of the example concurrently; the local record is not a cross-process lock.

| Failure | Next action |
| --- | --- |
| Missing key / HTTP 401 | Check `.env`, your API key and the current folder. |
| Validation error | Read `out/validation.json`. Supply inline captions or `subtitle.src`, never both. |
| Caption rejected locally | Use nonempty text and ordered, nonoverlapping times with `0 <= start < end <= duration`. This sample's nonoverlap rule is a local guard, not a claim about every API use. |
| Warning or credit ceiling | Review the quote. Change the ceiling only after deciding to spend more. |
| Failed job | Read the stored reason, fix the reported issue, then deliberately make a new render. |
| Download or polling interruption | Resume the existing job. HTTP failures and non-video responses are not saved as a finished MP4. |

For help, visit https://zvid.io/contact.

## Customize and verify

Change the public HTTPS video URL, duration and dimensions in `data/project.json`. Replace captions with text and timing reviewed against the final audio. This example does not generate a transcript or exact word timings. Obtain those separately before rendering.

```bash
npm run check
npm test
```

These checks are offline and spend no credits. Live validation/rendering are separate explicit commands. Tests cover invalid caption data, credit guards, terminal job states, output URL/expiry handling, and download failure/credential separation.

Optional references: [API key setup](https://docs.zvid.io/docs/authentication/#using-api-keys), [validation results](https://docs.zvid.io/docs/validate-and-estimate/#interpret-the-result), [render lifecycle](https://docs.zvid.io/docs/operations/render-lifecycle/#job-state-and-progress), [subtitle interface](https://docs.zvid.io/docs/structure/subtitle/#interface).
