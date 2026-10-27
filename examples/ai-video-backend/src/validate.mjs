import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { makeCases } from './contract.mjs';
const key = process.env.ZVID_API_KEY;
if (!key) throw Error('Set ZVID_API_KEY in your process environment. This command validates only.');
const records = [];
for (const item of makeCases()) {
  const response = await fetch('https://api.zvid.io/api/render/validate/api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify(item.request), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`${item.name}: validation HTTP ${response.status}; no render submitted. Check account limits, authentication and the request.`);
  const result = await response.json();
  assert.equal(result.valid, true);
  assert.equal(result.payload.scenes.length, item.scenes);
  assert.equal(result.payload.duration, item.seconds);
  const texts = result.payload.scenes.flatMap(scene => scene.visuals.map(visual => visual.text));
  if (item.name === 'unsupported-claim') assert.ok(texts.includes('Saves every team ten hours a week.'));
  const record = { name: item.name, scenes: result.payload.scenes.length, seconds: result.payload.duration, creditsRequired: result.creditsRequired, warnings: result.warnings, texts };
  records.push(record);
  console.log(`${item.name}: valid, ${record.scenes} scenes, ${record.seconds}s, estimate ${record.creditsRequired} credits`);
}
const out = new URL('../out/', import.meta.url);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(new URL('validation-results.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), records }, null, 2) + '\n');
console.log('Validation completed. No render job created and no render credits reserved.');
