# Style a video layer

Render a six-second, 1280 × 720 comparison: the same water clip appears unstyled, with rounded corners, with rotation added, and with desaturation added. Changes accumulate from left to right. All four copies are muted and use the same source interval. This example adds no narration or subtitles.

Related article: https://zvid.io/blog/tutorials/video-layer-rounded-corners-rotation-filters

## Requirements

Use Node.js 22 or newer with npm, a Zvid account with API access and a key from https://app.zvid.io/api-keys. The sample needs four VIDEO elements and an account allowing a six-second 1280 × 720 output. The estimate is 6 render credits. Validation is free; always check its current estimate.

## Run

Open a terminal in this folder and run `npm ci`. Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux. Add your API key after `ZVID_API_KEY=`. Keep `MAX_RENDER_CREDITS=6` unless you deliberately approve a larger quote. If PowerShell blocks npm.ps1, use npm.cmd instead of npm.

```sh
npm run check
npm test
npm start
```

The first two commands run offline. `npm start` validates `data/project.json` through the API, saves `out/validation.json`, prints the credit estimate and submits no render. Resolve errors or warnings before proceeding.

To spend the quoted credits and generate the comparison:

```sh
npm run render
```

The script validates again, records the submission attempt before the paid request, saves the returned job ID, waits for `state: completed`, then downloads `out/comparison.mp4`. An active job at 100% is still not complete. The expected video shows four moving water cards, rounded corners on cards 2 to 4, a slight tilt on cards 3 and 4, and grayscale water on card 4.

If the command stops after saving a job ID:

```sh
npm run resume
```

This tracks the existing job without submitting another. If submission was interrupted before its ID was saved, check Renders at https://app.zvid.io before doing anything that could resubmit. A failed job remains failed when resumed. Inspect `out/job.json` and its `failedReason`, correct the cause, and archive the old `out` folder before intentionally starting a new render. API requests time out after 30 seconds and tracking after ten minutes; a local timeout does not cancel the server job.

## Files and styling

- `data/project.json`: complete composition, source URL, four cards and labels.
- `src/index.js`: validation, one submission, completion tracking and download.
- `src/helpers.js`: budget checks, safe completion handling and download helpers.
- `tests/`: offline checks; these do not prove a hosted render succeeds.

The [source clip](https://cdn.zvid.io/blog/json-subtitles/7d445c404424/source.mp4) is hosted separately, not bundled in the ZIP. It contains AI-generated narration, muted by this comparison's `volume: 0` settings. The code license does not relicense linked media.

Each card is 224 × 398 pixels and uses `position: "custom"` with `anchor: "center-center"`. Cards 2 to 4 use `radius: {"tl":28,"tr":28,"bl":28,"br":28}`. Cards 3 and 4 add `angle: -6`. Card 4 adds `filter: {"saturate":-100}`. Label text is a separate layer and is not filtered.

The recorded output shows a thin colored fringe along the filtered card's left edge. This sample demonstrates the controls but should not be treated as a guarantee of artifact-free combined effects. Inspect edges at your delivery size. Color differences are clearest in the warm highlights near the beginning; dark portions of the source already have little saturation.

To customize, replace all four source URLs with one direct HTTPS video URL, keep the four source intervals identical, and update labels to match your settings. `cover` may crop a different aspect ratio. Update duration, source trim and layer timing together. `radius` is an object; `angle` is numeric; brightness, contrast and saturation use zero as neutral. Use custom positioning for exact coordinates and margins. Review corners, framing, contrast and the first and last frames after changes.

Your key is loaded from `.env` by Node and sent only to https://api.zvid.io using the SDK. Do not commit `.env` or `out/`. The downloaded MP4 receives no API key. Keep the local result because hosted outputs can expire.

Support: https://zvid.io/contact
