import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script=fileURLToPath(new URL('../src/index.js',import.meta.url));
const fixture=new URL('./mock-fetch.js',import.meta.url).href;
async function setup(){const dir=await mkdtemp(join(tmpdir(),'zvid-variants-cli-'));await cp(new URL('../data/',import.meta.url),join(dir,'data'),{recursive:true});return dir;}
function run(dir,mode,scenario='normal'){return spawnSync(process.execPath,['--import',fixture,script,mode],{cwd:dir,env:{...process.env,ZVID_API_KEY:'offline-placeholder',MAX_RENDER_CREDITS:'40',FIXTURE:scenario},encoding:'utf8',windowsHide:true});}
async function calls(dir){return (await readFile(join(dir,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);}
test('default validation makes no paid submissions; combined ceiling stops render',async()=>{const dir=await setup();try{assert.equal(run(dir,'--validate').status,0);assert.ok((await calls(dir)).every(c=>c.url.includes('/validate/')));const fail=run(dir,'--render','over-budget');assert.equal(fail.status,1);assert.ok(!(await calls(dir)).some(c=>c.url.endsWith('/render/api-key')));}finally{await rm(dir,{recursive:true});}});
test('CLI saves all IDs, downloads without API credentials, and resumes without submitting',async()=>{const dir=await setup();try{const result=run(dir,'--render');assert.equal(result.status,0,result.stderr);for(const id of ['tiktok','reels','shorts']){assert.ok(JSON.parse(await readFile(join(dir,'out',id,'run.json'))).jobId);assert.equal((await readFile(join(dir,'out',id,'video.mp4'))).length,4);}assert.equal(run(dir,'--resume').status,0);assert.equal(run(dir,'--render').status,1);const log=await calls(dir);assert.equal(log.filter(c=>c.url.endsWith('/render/api-key')).length,3);assert.ok(log.filter(c=>c.url.startsWith('https://cdn.')).every(c=>!c.headers));}finally{await rm(dir,{recursive:true});}});
test('a lost submission response keeps its attempt record and cannot be blindly retried',async()=>{const dir=await setup();try{assert.equal(run(dir,'--render','lost-response').status,1);const record=JSON.parse(await readFile(join(dir,'out/tiktok/run.json')));assert.ok(record.submissionAttemptedAt);assert.equal(record.jobId,undefined);assert.equal(run(dir,'--resume').status,1);assert.equal(run(dir,'--render').status,1);assert.equal((await calls(dir)).filter(c=>c.url.endsWith('/render/api-key')).length,1);}finally{await rm(dir,{recursive:true});}});
