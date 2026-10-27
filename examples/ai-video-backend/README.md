# Validate AI content before video rendering

Check a narrow proposal for a fictional call-notes explainer, then map it into a controlled Zvid design. This is a teaching example for [Build an AI video rendering backend with Zvid](https://zvid.io/blog/engineering/ai-video-rendering-backend).

It prepares and optionally validates render requests. It does not call an AI model, create a saved template, render a video, verify factual claims, run a web service or publish anything.

## Run locally

Use Node.js 22 or newer and npm. Extract the individual ZIP and open a terminal in `ai-video-backend`, beside `package.json`. From a repository clone, use `examples/ai-video-backend`.

```sh
npm ci
npm test
npm run check
```

Expect nine passing tests. The check command writes four request files under `out/`:

| File | Change | Expected resolved project |
| --- | --- | --- |
| `baseline.request.json` | Three features and a CTA | Five scenes, 13 seconds |
| `no-cta.request.json` | Only `showCta` changes to `false` | Four scenes, 11 seconds |
| `design-change.request.json` | Only the background changes | Five scenes, 13 seconds; original text |
| `unsupported-claim.request.json` | One unsupported time-saving claim | Structurally valid, but requires rejection in content review |

The local command prepares requests; it does not resolve the template or prove those scene counts through Zvid. Optional API validation below checks the resolved counts and durations. All local commands run without credentials or render credits. In PowerShell, use `npm.cmd` if script policy blocks `npm.ps1`.

## Optional API validation

Create a key at https://app.zvid.io/api-keys. The script reads `ZVID_API_KEY` from the process environment; `.env.example` documents the name and is not loaded automatically.

PowerShell:

```powershell
$env:ZVID_API_KEY = "YOUR_API_KEY"
npm.cmd run validate
```

macOS or Linux:

```sh
export ZVID_API_KEY="YOUR_API_KEY"
npm run validate
```

This sends the four prepared requests to `POST https://api.zvid.io/api/render/validate/api-key`, checks the returned scene counts and durations, and writes a small report to `out/validation-results.json`. It never calls a render endpoint and does not reserve render credits. The expected credit estimates are 13, 11, 13 and 13 for these 1280 by 720 projects. Estimates are not charges; your account limits must permit the projects.

A missing key stops before network access. HTTP errors or unexpected results stop validation. Fix the cause rather than treating a failure as a reason to submit a render. Requests have a 30-second timeout and are not automatically retried. No job ID exists because this example never creates a job.

## What the checks prove

`src/contract.mjs` checks exact fields, types, bounded strings, two to four feature items, and membership in the supplied source records. These are application choices, not Zvid platform limits. The validator rejects markup and template delimiters for this plain-text design; it is not a universal HTML or URL sanitizer.

`sourceRef` stays with the application record. Only title, feature heading/body, the CTA flag and CTA text become template variables. No model-supplied template ID, callback URL, canvas dimensions, styling or executable content is accepted.

The deliberately unsupported sentence “Saves every team ten hours a week.” refers to a real source ID but is not supported by that source. It passes structural checks and can pass Zvid validation. Neither check is a fact checker. Do not render or publish that fixture as a real claim.

`templates/explainer.json` uses an intro, an iterated feature scene and a conditional CTA. Explicit durations and hard cuts make the example's timing easy to inspect. This uses an inline `payload`, so there is no account template to create or clean up. Inline payloads still resolve template variables. A saved-template integration would use an owned `template` ID instead of `payload`.

## Before using this design in a product

Add tenant authorization, source verification, review records, budget enforcement, durable submission state, recovery and output review. Keep media selection and publishing credentials on the server. Test actual visual output before using the design; validation does not prove text fit or playback quality. This package includes no finished media or paid-render command.

Support: https://zvid.io/contact
