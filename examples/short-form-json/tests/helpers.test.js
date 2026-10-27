import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRequest, checkQuote, outputUrl, trackJob, downloadVideo, claimRun } from '../src/helpers.js';

test('project stays separate from its request envelope', () => {
  const project = { scenes: [{ duration: 3 }], name: 'first-json-video' };
  const request = buildRequest(project);
  assert.deepEqual(request, { payload: project });
  request.payload.name = 'changed';
  assert.equal(project.name, 'first-json-video');
  for (const value of [null, [], {payload: project}, {template: 'tpl_example'}]) assert.throws(() => buildRequest(value));
});
test('cost guard rejects invalid quotes, unexpected warnings and estimates above the ceiling',()=>{
  checkQuote({valid:true,creditsRequired:8,warnings:[]},8);
  for(const quote of [{valid:false},{valid:true,creditsRequired:9},{valid:true},{valid:true,creditsRequired:8,warnings:['warning']}]) assert.throws(()=>checkQuote(quote,8));
});
test('only completed jobs with unexpired output can be downloaded',()=>{
  assert.equal(outputUrl({state:'completed',result:'https://cdn.zvid.io/example.mp4'}),'https://cdn.zvid.io/example.mp4');
  assert.equal(outputUrl({state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'}}),'https://cdn.zvid.io/example.mp4');
  for(const job of [{state:'active',progress:100},{state:'failed',failedReason:'Asset unavailable'},{state:'completed',result:{}},{state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'},outputExpiredAt:'2020-01-01'}]) assert.throws(()=>outputUrl(job));
});
test('tracking continues through active at 100%, stops on completion, and preserves failures',async()=>{
  const states=[{state:'active',progress:100},{state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'}}];
  const saved=[];
  const job=await trackJob({jobs:{get:async()=>states.shift()}},'test',{intervalMs:1,save:async j=>saved.push(j.state),log:()=>{}});
  assert.equal(job.state,'completed');assert.deepEqual(saved,['active','completed']);
  await assert.rejects(trackJob({jobs:{get:async()=>({state:'failed',failedReason:'Asset unavailable'})}},'test',{log:()=>{}}),/Asset unavailable/);
});
test('download checks HTTP status and never sends API credentials to the media host',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zvid-subtitles-'));
  try {
    let init;const destination=path.join(dir,'result.mp4');
    await downloadVideo('https://cdn.zvid.io/example.mp4',destination,async(_url,options)=>{init=options;return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'video/mp4'}})});
    assert.equal(init.headers,undefined);assert.equal((await readFile(destination)).length,3);
    await assert.rejects(downloadVideo('https://cdn.zvid.io/example.mp4',destination,async()=>new Response('Missing',{status:404})),/HTTP 404/);
  } finally {
    await rm(path.join(dir,'result.mp4'),{force:true});
    await rm(path.join(dir,'result.mp4.part'),{force:true});
    await rmdir(dir);
  }
});

test('an uncertain submission record blocks a second process', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zvid-first-render-'));
  const file = path.join(directory, 'run.json');
  try {
    await claimRun({ status: 'submission-attempted' }, file);
    await assert.rejects(claimRun({ status: 'second-attempt' }, file), { code: 'EEXIST' });
    assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'submission-attempted');
  } finally { await rm(file); await rmdir(directory); }
});
