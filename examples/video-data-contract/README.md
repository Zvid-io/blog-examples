# Product data and video design: an architecture example

Companion to [Keep product data separate from video design](https://zvid.io/blog/engineering/json-schema-for-video-generation).

This example checks product data, prepares template values and validates render requests. It does not generate or download a finished video.

## Run the offline checks

Install Node.js 22 or newer with npm. Open a terminal in this folder:

```sh
npm ci
npm test
npm run check
```

Use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1`. No need to change execution policy.

Nine tests must pass. `npm run check` writes three request envelopes to `out/`: baseline ($24.00), price-change ($21.00), design-change ($24.00). Tests and request generation do not call Zvid. Dependency installation needs access to npm's registry.

## Files and responsibilities

- `data/product.json`: fictional Daily Face Cream, USD 2400 cents.
- `data/product-sale.json`: same product at 2100 cents.
- `data/product-invalid.json`: deliberately invalid string price, "$21".
- `input.schema.json`: application-owned Draft 2020-12 rules, not Zvid's project schema.
- `src/contract.mjs`: Ajv validation, explicit mapping and a narrow flat-template compatibility check.
- `templates/design-a.json`, `design-b.json`: complete three-second Zvid video projects with the same three placeholders. Design B changes colours and positions.
- `templates/broken-rename.json`: priceText renamed to offerPrice, retaining a $24.00 default.
- `templates/broken-removal.json`: price variable and visual removed.
- `src/check.mjs`: creates the valid request envelopes without network calls.
- `src/validate.mjs`: optional free API checks, including deliberate failures that bypass the application contract check.
- Preview images: the CDN links below show the original design, price change and redesign. `npm run check` writes request JSON, not images.

The mapper returns productName, priceText and productImage. Design defaults are overridden by those request values. The ID remains in the application. The sample rejects non-USD prices, decimals in priceCents, values outside 0..99900, extra properties, malformed/non-HTTPS URLs and blank or unsafe names. These are chosen example rules. They do not establish image reachability, media ownership, URL authorization or layout fit.

## Optional API validation

Get a key from https://app.zvid.io/api-keys. Keep it private and outside source files. The supplied commands read it from the process environment; they do not load a .env file.

PowerShell:

```powershell
$env:ZVID_API_KEY = "YOUR_API_KEY"
npm.cmd run validate
```

macOS/Linux:

```sh
export ZVID_API_KEY="YOUR_API_KEY"
npm run validate
```

The command makes seven POST requests to https://api.zvid.io/api/render/validate/api-key using x-api-key authentication. It creates no stored template, render job or credit reservation. Your account must permit the sample dimensions and duration. Responses go to `out/api-verification.json`. The script asserts observed behavior and stops if the live API differs, authentication fails, a request times out, or an account limit prevents validation. It does not automatically retry.

| Case | Expected HTTP | Resolved price |
| --- | --- | --- |
| Baseline | 200 | $24.00 |
| Price change | 200 | $21.00 |
| Design change | 200 | $24.00 |
| Rename with default, bypassing app contract check | 200 | $24.00 (wrong for sale input) |
| Remove price, bypassing app contract check | 200 | null (no price element) |
| Unresolved offerPrice placeholder | 400 | Resolution error |
| Width override -1 | 400 | Validation error |

For the supplied three-second designs, expect an estimate of 3 render credits per video. Validation does not spend those credits. Recheck the current estimate if you later render. This example contains no paid-render command.

## Limits

- Requests use the supplied design files as inline payloads. You do not need to create or update a saved template.
- The contract checker only handles the supplied flat templates. It is not a Zvid template engine and does not support scene scopes, conditions or iteration. Its exact variable-set rule is intentionally strict.
- `inspectResolved` relies on the fixture's fixed visual order. Adapt it for your own design; it is not a general semantic video validator.
- Name checks cannot prove a variable's meaning stayed stable. An approved visual review is still necessary.
- Existing MP4s do not change when the source data or design changes. Creating a replacement requires a separate render.
- The product and pricing are fictional. The image is AI-generated and has a working hosted source link.

## Further detail

- [Zvid template variables](https://docs.zvid.io/docs/templates/template-basics/#variables-and-placeholders)
- [Validate and estimate](https://docs.zvid.io/docs/validate-and-estimate/#interpret-the-result)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [Ajv schema languages](https://ajv.js.org/guide/schema-language.html)


## Preview images

| Starting point | Price change | Design change |
| --- | --- | --- |
| ![Original design at $24](https://cdn.zvid.io/blog/video-data-contract/efbad9812b67/baseline.png) | ![Same design at $21](https://cdn.zvid.io/blog/video-data-contract/9b69b7c82cc9/price-change.png) | ![New design at $24](https://cdn.zvid.io/blog/video-data-contract/a963a511c5d4/design-change.png) |

Support: https://zvid.io/contact
