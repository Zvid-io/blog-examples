# Zvid blog examples

Small, runnable code examples that accompany the [Zvid blog](https://zvid.io/blog). Each example has its own instructions, dependencies, sample inputs and offline tests.

## Examples

| Example | What you learn | Default behavior |
| --- | --- | --- |
| [Timed subtitles](examples/json-subtitles/) | Add prepared captions, track one render and download the result | Free API validation; rendering is explicit |
| [Product data and video design](examples/video-data-contract/) | Validate product data and map it into interchangeable designs | Offline checks and request generation |
| [Debug invalid JSON](examples/debug-invalid-json/) | Separate syntax, request-envelope and API validation failures | Offline request checks |

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
