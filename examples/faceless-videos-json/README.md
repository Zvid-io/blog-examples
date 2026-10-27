# Narrated faceless video from JSON

Render a 16-second vertical lesson about meeting notes. One supplied narration recording drives three scene windows and seven prepared captions. The note is fictional: send the launch draft, owned by Maya, due Friday.

Article: https://zvid.io/blog/tutorials/generate-faceless-videos-with-json

## Requirements and cost

Use Node.js 22 or newer with npm, a Zvid account, an API key from https://app.zvid.io/api-keys and enough render credits. The sample audio is already hosted. No AI account, stock footage, local video encoder or saved Zvid template is required.

The unchanged 720 × 1280, 16-second sample has a 16-credit render estimate. Building JSON and API validation do not consume render credits. `npm run render` spends credits. The script stops if the current quote exceeds `MAX_RENDER_CREDITS` or contains warnings. This client-side check is not an atomic server billing cap, and validation does not reserve credits. AI services used to prepare a replacement recording have separate costs.

## Install and run

Open a terminal in this folder, where `package.json` is located:

```bash
node --version
npm ci
npm run build
```

`build` writes `out/candidate-request.json` locally, without contacting Zvid. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`.

Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in macOS/Linux. Paste your key after `ZVID_API_KEY=` and keep `MAX_RENDER_CREDITS=16`. Do not put the key in JSON or commit `.env`. The npm commands load `.env`; existing process environment variables take precedence.

```bash
npm start
```

Expect `Valid: true. Estimated credits: 16.` and `No render submitted.` Read `out/validation.json` if there is an error or warning. The current quote is authoritative if costs change.

When the estimate is acceptable:

```bash
npm run render
```

The script validates, writes a submission marker, sends one request, saves its job ID, checks for completion and downloads `out/faceless-meeting-notes.mp4`. It checks job state every five seconds for up to ten minutes. Each API request has a 30-second timeout. `state: completed`, not progress 100, is the completion criterion. Open the MP4 and check all scenes, captions and narration. Keep your local file because hosted render outputs can expire.

## Recovery

```bash
npm run resume
```

This tracks the saved job without creating another render. If submission ended before a job ID was saved, find the existing job in Renders at https://app.zvid.io, then run:

```bash
npm run resume -- --job-id YOUR_JOB_ID
```

Do not assume a timeout means the server did not accept the request. A recorded attempt blocks another paid submission. For a deliberately new video, first inspect the previous job and rename `out` to retain its evidence. Run one copy of the example at a time.

Failed jobs stop with `failedReason`; an expired or missing output URL also stops. Fix the cause before a deliberate new submission. `resume` does not repair or rerender a failed job. Downloads do not receive the API key.

## Files and customization

- `data/story.json`: narration URL, total duration, three note fields, scene windows and captions.
- `data/narration.txt`: the exact spoken script.
- `data/ai-script-prompt.txt`: optional prompt for drafting a different script from approved facts. The code does not call an AI service.
- `src/project.js`: checks the story and constructs a complete Zvid project.
- `src/index.js` and `src/helpers.js`: validation, submission, tracking, recovery and download.

Sample narration: https://cdn.zvid.io/blog/faceless-videos-json/7fcfaad914bb/narration.mp3

The source ZIP contains code and JSON, not media binaries. The renderer downloads the public narration URL.

For a new story, finish the recording first. Listen, mark the actual caption intervals and segment boundaries, then update the recording URL, note values, captions and duration together. All times in the story are seconds from the beginning of the complete video. Scenes use each segment's `end - start`; root subtitles keep the absolute times. Hard cuts avoid transition overlaps shifting this clock.

The three-segment limit, 30-second maximum, text limits, contiguous windows and `reviewed` flag are policies of this example, not general Zvid restrictions. The builder checks these values; it cannot listen to the audio or prove that a human reviewed it. A direct HTTPS media URL is required by this example; local file paths will not work. Review the new recording's availability and rights before use.

## Tests and limits

```bash
npm run check
npm test
```

Tests are offline and never submit renders. They check timeline mapping, overlapping captions, invalid inputs, quote guards, active-at-100% handling, failed/expired jobs, uncertain submission and downloads without API credentials.

This teaching script assembles supplied media. It does not generate a voice, transcribe audio, verify claims, select B-roll or publish to social accounts. It is a local learning example, not a production scheduler or job database. Longer scripts, different languages, B-roll and animation require their own timing and layout review.

Support: https://zvid.io/contact
