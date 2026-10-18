import fs from 'node:fs/promises';
import { readJson, buildRequest } from './contract.mjs';
const out = new URL('../out/', import.meta.url);
await fs.mkdir(out, { recursive: true });
for (const [name, product, design] of [
  ['baseline', 'product.json', 'design-a.json'],
  ['price-change', 'product-sale.json', 'design-a.json'],
  ['design-change', 'product.json', 'design-b.json'],
]) {
  const request = buildRequest(readJson('data/' + product), readJson('templates/' + design));
  await fs.writeFile(new URL(name + '.request.json', out), JSON.stringify(request, null, 2) + '\n');
  console.log(`${name}: ${request.variables.productName}, ${request.variables.priceText}`);
}
console.log('Wrote 3 requests to out/. No network calls or renders.');
