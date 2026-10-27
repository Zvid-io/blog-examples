# Zvid blog examples

Small, runnable code examples that accompany the [Zvid blog](https://zvid.io/blog). Each example has its own instructions, dependencies, sample inputs and offline tests.

## Examples

| Example | What you learn | Default behavior | Download |
| --- | --- | --- | --- |
| [Educational explainer template](examples/educational-explainer-json/) | Map reviewed lesson data into repeated teaching scenes and an optional worked example | API validation consumes no render credits; rendering is explicit | See the example README |
| [Narrated faceless video](examples/faceless-videos-json/) | Combine prepared narration, timed captions and a controlled visual design | Offline build and tests; validation and rendering are separate commands | See the example README |
| [One story, three social variants](examples/short-form-platform-variants/) | Keep shared copy while changing layout and endings across three vertical profiles | Offline build; API validation consumes no render credits; batch rendering is explicit | See the example README |
| [AI video backend contract](examples/ai-video-backend/) | Constrain proposed copy, map it to a controlled design, and separate structural validity from factual accuracy | Offline checks; optional API validation consumes no render credits | See the example README |
| [Video template validation](examples/video-template-validation/) | Test variable states, expected scene structure and content before rendering one sample | API validation consumes no render credits; rendering is explicit | See the example README |
| [Short-form videos from JSON](examples/short-form-json/) | Map three messages into a 12-second vertical video with editable timing and text placement | API validation consumes no render credits; rendering is explicit | See the example README |
| [Your first JSON video](examples/generate-video-from-json/) | Validate, render, track and download one six-second MP4 | API validation consumes no render credits; rendering is explicit | [ZIP](https://cdn.zvid.io/blog/generate-video-from-json/54fa50930515/generate-video-from-json-example.zip) |
| [Timed subtitles](examples/json-subtitles/) | Add prepared captions, track one render and download the result | Free API validation; rendering is explicit | [ZIP](https://cdn.zvid.io/blog/json-subtitles/2d3d887d1fe8/json-subtitles-example.zip) |
| [Product data and video design](examples/video-data-contract/) | Validate product data and map it into interchangeable designs | Offline checks and request generation | [ZIP](https://cdn.zvid.io/blog/video-data-contract/17fbeafa00ef/video-data-contract-example.zip) |
| [Debug invalid JSON](examples/debug-invalid-json/) | Separate syntax, request-envelope and API validation failures | Offline request checks | [ZIP](https://cdn.zvid.io/blog/debug-invalid-json/784de4644f77/debug-invalid-json-example.zip) |
| [Video layer styling](examples/video-layer-styling/) | Round, rotate and desaturate matching video cards | API validation consumes no credits; rendering is explicit | [ZIP](https://cdn.zvid.io/blog/video-layer-styling/3e38992928e6/video-layer-styling-example.zip) |
| [Reliable webhooks](examples/video-rendering-webhooks/) | Verify signed events, persist an inbox and deduplicate business work | Offline HTTP demonstration; no rendering | [ZIP](https://cdn.zvid.io/blog/video-rendering-webhooks/d10ec6aef17f/video-rendering-webhooks-example.zip) |
| [Car listing video](examples/car-listing-video/) | Map a vehicle record into a repeated photo gallery with optional pricing | API validation consumes no credits; rendering is explicit | [ZIP](https://cdn.zvid.io/blog/automated-car-listing-videos/3d9c4b540940/car-listing-video-example.zip) |
| [Automated B-roll](examples/automated-b-roll/) | Map approved shots and source trims to a timed video | API validation consumes no render credits; rendering is explicit | See example README |

## Get started

Install Node.js 22 or newer. Choose an example and follow its README. You can clone the repository or download an individual example ZIP linked from its article.

```sh
git clone https://github.com/Zvid-io/blog-examples.git
cd blog-examples/examples/json-subtitles
npm ci
npm run check
npm test
```

Examples install independently. Root scripts only check repository structure and build downloads; they do not install or run the examples for you. The debugging example also supports direct Node.js commands without an install.

## API access and costs

Create API keys at https://app.zvid.io/api-keys. Follow the chosen README for configuration. Offline tests require no API key and spend no credits. Optional API validation makes network requests but does not submit renders. The subtitles example has an explicit paid-render command; inspect the validation estimate and its credit ceiling before using it.

## Downloads and media

Reader downloads, sample videos and preview images are served through https://cdn.zvid.io. Source packages contain runnable code and small inputs; large media is linked separately. ZIPs are built from a recorded Git commit. Publication records in `releases/` identify the source commit and ZIP checksum.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Use one stable folder under `examples/` per teaching example. Complete automation workflows continue in [Zvid workflow examples](https://github.com/Zvid-io/workflow-examples).

Code is provided under [MIT](LICENSE). Linked media has its own rights and is not relicensed by the code license.

Support: https://zvid.io/contact
