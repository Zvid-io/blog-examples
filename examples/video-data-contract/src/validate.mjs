import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readJson, buildRequest, toTemplateValues, inspectResolved } from './contract.mjs';

const key = process.env.ZVID_API_KEY;
if (!key) throw new Error('Set ZVID_API_KEY in your environment. This command only validates, never renders.');
const product = readJson('data/product.json');
const sale = readJson('data/product-sale.json');
const a = readJson('templates/design-a.json');
const b = readJson('templates/design-b.json');
const missing = readJson('templates/broken-rename.json');
delete missing.variables.offerPrice;
// Deliberately bypass our contract check in the failure cases to observe Zvid.
const cases = [
  ['baseline', buildRequest(product, a), 200, '$24.00'],
  ['price-change', buildRequest(sale, a), 200, '$21.00'],
  ['design-change', buildRequest(product, b), 200, '$24.00'],
  ['rename-with-default', { payload: readJson('templates/broken-rename.json'), variables: toTemplateValues(sale) }, 200, '$24.00'],
  ['removed-price', { payload: readJson('templates/broken-removal.json'), variables: toTemplateValues(sale) }, 200, null],
  ['unresolved-placeholder', { payload: missing, variables: toTemplateValues(sale) }, 400],
  ['invalid-output-width', { payload: a, overrides: { width: -1 } }, 400],
];
const records = [];
for (const [name, body, expectedStatus, expectedPrice] of cases) {
  const response = await fetch('https://api.zvid.io/api/render/validate/api-key', {
    method: 'POST', headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  const resolved = result.payload ? inspectResolved(result.payload) : null;
  records.push({ name, status: response.status, result, resolved });
  console.log(`${name}: HTTP ${response.status}${resolved ? ', priceText=' + JSON.stringify(resolved.priceText) : ''}`);
  if (response.status !== expectedStatus) console.error(JSON.stringify(result));
  assert.equal(response.status, expectedStatus, `${name}: API behavior changed`);
  if (response.ok) {
    assert.equal(result.valid, true);
    assert.equal(resolved.priceText, expectedPrice);
    assert.equal(resolved.productName, product.name);
    assert.equal(resolved.productImage, product.imageUrl);
  }
}
const out = new URL('../out/', import.meta.url);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(new URL('api-verification.json', out), JSON.stringify({ verifiedAt: new Date().toISOString(), scope: 'Free inline-payload validation only; no template saved and no render submitted', records }, null, 2) + '\n');
console.log('Verified 7 API cases. Saved out/api-verification.json. No render credits reserved.');
