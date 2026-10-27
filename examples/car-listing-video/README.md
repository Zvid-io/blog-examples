# Build a car listing video

Turn one vehicle record and two photos into a 12.3-second, 1280 × 720 silent MP4 with a repeated photo gallery and optional price. The 2023 Aster Touring, River Lane Motors and listing facts are fictional. Illustrative sample photos are already hosted on the Zvid CDN.

Article: https://zvid.io/blog/automotive-automation/automated-car-listing-videos

## Prerequisites and setup

Use Node.js 22.9 or newer with npm, a Zvid account, and an API key from https://app.zvid.io/api-keys. Run the code on your own computer or server. The sample uses the official @zvid/sdk 0.2.0 package. Your account must allow the sample dimensions and duration.

Open a terminal in this folder (the ZIP extracts to `car-listing-video/`). Run:

```sh
node --version
npm ci
npm run check
npm test
```

PowerShell users can use `npm.cmd` if `npm.ps1` is blocked. Copy `.env.example` to `.env` with `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS/Linux. Fill in `ZVID_API_KEY` in that local file. Keep `MAX_RENDER_CREDITS=13`. Node loads `.env` for every start/render/resume command. An existing process environment value takes precedence.

The API key is sent only to https://api.zvid.io in `x-api-key`. Never put it in project JSON, a browser application or Git. Downloads do not receive the key. Offline checks and tests need no credentials and submit no jobs.

## Validate and render

```sh
npm start
```

Expect `Valid: true. Estimated credits: 13.` and `No render submitted.` Validation does not consume render credits. Inspect `out/price-shown/validation.json`. The script rejects warnings, invalid responses and estimates above the configured ceiling.

When ready, submit one paid render:

```sh
npm run render
```

Expected result: `out/price-shown/listing.mp4`, four resolved scenes and 12.3 seconds. Budget 13 credits for this output. Rendering both versions costs 26 credits. Changing photo count, timing or dimensions changes the estimate. Credits: https://docs.zvid.io/docs/credits-and-plans/

To validate and render a separate version with the price label and amount removed:

```sh
npm start -- --hide-price
npm run render -- --hide-price
```

Its files are in `out/price-hidden/`. `--hide-price` overrides the vehicle's `showPrice` boolean. It does not edit the input file or resubmit an existing job.

## Resume without a second submission

Each output folder records the attempted submission before its POST, then immediately stores an accepted job ID. The program never automatically retries a submission. Polling stops after ten minutes; a local timeout does not cancel the hosted job.

```sh
npm run resume
npm run resume -- --hide-price
```

These commands only track and download the previously recorded job. A failed or expired job stops with an error. An active job at 100% is still active; only `completed` can be downloaded. Files download to `.part` first, then rename on completion.

If submission timed out before the job ID was received, check https://app.zvid.io/videos. Copy the matching job's UUID and recover it with:

```sh
npm run resume -- --job-id YOUR_JOB_ID
```

Add `--hide-price` for the hidden-price output folder. This is also a way to download an already completed dashboard render without spending credits. It will not validate that a supplied job was made with these inputs. Do not guess a job ID or blindly repeat the paid command. See https://docs.zvid.io/docs/operations/errors-and-retries/.

A deliberate new render in the same price mode requires inspecting the prior job and renaming that mode's output folder to retain its record. Editing input alone never updates an existing MP4. Fix the underlying error before any paid retry.

## Files and data rules

- `data/vehicle.json`: listing facts and photo list. Mileage is a non-negative whole number; shown price is whole US dollars; `showPrice` is a JSON boolean. At least one labeled HTTPS image is required by this example.
- `data/project.json`: the complete editor-importable design, including safe defaults. Three raw scenes resolve to four because the gallery repeats twice.
- `src/helpers.js`: converts `28640` to `28,640 miles` and `24900` to `$24,900`, validates application inputs, builds the request, guards credits and tracks/downloads jobs.
- `src/index.js`: executable command entry point.
- `tests/`: offline checks for mapping, invalid inputs, warnings and costs, uncertain submissions, terminal job states and downloads.

These field restrictions belong to this application, not all Zvid projects. `photoFront` comes from the first photo. Both price elements have `condition: "{{showPrice}}"`; the gallery uses `iterate: "photos"` and `iterateAs: "item"`. Request-time variables override project defaults.

The code submits `{ payload: project, variables }`. The editor/dashboard route in the article saves the same design as an account template. A stored-template request instead uses `{ template: "YOUR_TEMPLATE_ID", variables }`; use exactly one of `payload` and `template`. The runnable example intentionally needs no template ID.

For your own record, replace every photo with an approved image of that exact vehicle, keep its URL reachable by the render service, and review the output. Whole-dollar formatting, US locale and the landscape design are sample choices. No stock feed integration, publishing, vehicle identification or automatic price refresh is included. The ZIP contains code and JSON, not images or MP4s. Linked media is not relicensed by the MIT source-code license.

API lifecycle: https://docs.zvid.io/docs/operations/render-lifecycle/

Support: https://zvid.io/contact
