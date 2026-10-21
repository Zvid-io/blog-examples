# Generate video from JSON

Create a six-second, 1280 × 720 MP4: “JSON in.” for three seconds, then “Video out.” for three seconds. The text-only project needs no image, video or audio inputs. It has no sound.

[Read the tutorial](https://zvid.io/blog/developer-tutorials/how-to-generate-a-video-from-json).

## Setup

Use Node.js 22.9 or newer (or Node.js 24), npm and a Zvid API key from https://app.zvid.io/api-keys. Open a terminal in this example folder, where package.json is located.

```sh
node --version
npm ci
```

Copy `.env.example` to `.env`: use `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS/Linux. Paste your key after `ZVID_API_KEY=` and keep `MAX_RENDER_CREDITS=6`. The commands load `.env` if present; existing process environment variables take precedence. Never share or commit `.env`. If PowerShell blocks npm.ps1, use `npm.cmd` instead of `npm`.

```sh
npm start
```

This calls Zvid API validation and prints the current estimate. Validation does not consume render credits. For the supplied request, the expected estimate is 6 credits. It stops on validation warnings or an estimate above your configured limit. Validation is not a reservation: keep enough credits available for submission.

## Render and download

```sh
npm run render
```

**Rendering spends credits.** This command validates again, records a submission attempt before the paid request, submits once, saves the job ID, polls every two seconds and downloads `out/first-json-video.mp4` when `state` is `completed`. It waits up to ten minutes, with a separate timeout for each request. Progress at 100% is not completion.

Open the MP4 and watch both messages. The complete submitted request is in `out/request.json`, the job ID in `out/run.json`, and the latest status in `out/job.json`. A failed job stops with `failedReason`. The API key is sent only to the API, never with the media download.

## Recover without another submission

```sh
npm run resume
```

Resume follows the saved job and downloads its output. A client timeout does not cancel the server job. If no job ID was saved, inspect **Renders** at https://app.zvid.io before submitting again: a missing response does not mean the request was rejected. The attempt record blocks another render in this folder, including concurrent processes. Do not erase it to retry blindly.

For a deliberately new render, inspect the previous job, rename `out` to preserve its record, edit `data/project.json`, validate and explicitly render again. Run one copy at a time so status/download files stay clear. There is no automatic resubmission, durable scheduler, webhook receiver or remote cancellation. The API estimate limit is a preflight check, not a server-side billing cap. Hosted output may expire; retain the downloaded file.

## Understand and change the files

- `data/project.json`: canvas and two sequential scenes. Change text or colors here.
- `data/request.json`: reference request containing the same project under `payload`. The script builds the envelope from project.json, so this reference is not an extra input to edit.
- `src/index.js`: validate, submit, save and resume the job.
- `src/helpers.js`: bounded polling, quote checks and downloading.

Each scene uses seconds. There are no transitions, so the two three-second scenes total six seconds. The `hd` preset determines 1280 × 720 dimensions. This renders an explicit composition; it does not synthesize footage from a text prompt.

## Offline checks

```sh
npm run check
npm test
```

These require no key, network or credits. They test request-envelope mistakes, credit limits, active-at-100% status, failed/expired jobs, downloads without credentials and duplicate-submission prevention. Mocked tests do not create a real video.

Support: https://zvid.io/contact
