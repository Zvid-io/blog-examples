import fs from 'node:fs/promises';
import { makeCases } from './contract.mjs';
const out = new URL('../out/', import.meta.url);
await fs.mkdir(out, { recursive: true });
for (const item of makeCases()) {
  await fs.writeFile(new URL(item.name + '.request.json', out), JSON.stringify(item.request, null, 2) + '\n');
  console.log(`${item.name}: request prepared; expected ${item.scenes} scenes, ${item.seconds} seconds`);
}
console.log('The unsupported claim passes structural checks. Source accuracy still needs review.');
console.log('Wrote four requests to out/. No model or Zvid API called; no video rendered.');
