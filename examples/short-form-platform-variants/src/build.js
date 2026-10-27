import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildVariants } from './project.js';
const read = async file => JSON.parse(await readFile(file,'utf8'));
for (const variant of buildVariants(await read('data/content.json'),await read('data/profiles.json'))) {
  await mkdir(`out/${variant.id}`, {recursive:true});
  await writeFile(`out/${variant.id}/request.json`,JSON.stringify(variant.request,null,2)+'\n');
  console.log(`${variant.id}: ${variant.duration} seconds. Request saved. No API call or render.`);
}
