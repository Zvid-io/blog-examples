import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRequest, checkQuote, outputUrl, trackJob, downloadVideo } from '../src/helpers.js';

test('caption preparation preserves audio and rejects milliseconds, empty text, reversal and overlap', () => {
  const project = { duration: 8, visuals: [{type:'VIDEO',volume:1}], subtitle: {animation:'normal'} };
  const good = [{start:.5,end:2.25,text:'Take a slow breath.'}];
  assert.equal(buildRequest(project,good).payload.visuals[0].volume,1);
  assert.equal(project.subtitle.captions,undefined);
  for(const bad of [[{start:500,end:2250,text:'Wrong units'}],[{start:2,end:1,text:'Backwards'}],[{start:0,end:1,text:''}],[...good,{start:2,end:3,text:'Overlap'}]]) assert.throws(()=>buildRequest(project,bad));
  assert.throws(()=>buildRequest({...project,subtitle:{src:'https://example.com/a.vtt'}},good));
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
