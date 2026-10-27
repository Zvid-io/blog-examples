import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRequest} from '../src/project.js';
import {checkQuote,outputUrl,trackJob,submitOnce,readRun,downloadVideo} from '../src/helpers.js';
const cue=JSON.parse(await readFile(new URL('../data/cue-sheet.json',import.meta.url),'utf8'));
test('cue sheet maps output intervals to scene-local time and source trims',()=>{
 const {payload}=buildRequest(cue);assert.deepEqual(payload.scenes.map(s=>s.duration),[4,4,4]);
 assert.deepEqual(payload.scenes.map(s=>[s.visuals[0].videoBegin,s.visuals[0].videoEnd]),[[2,6],[1,5],[4,8]]);
 assert.equal(payload.scenes.reduce((n,s)=>n+s.duration,0),12);
 for(const s of payload.scenes){assert.equal(s.visuals[0].enterBegin,0);assert.equal(s.visuals[0].volume,0);assert.equal(s.transition,undefined);}
});
test('rejects unapproved shots, timing gaps, duplicate IDs and short source windows',()=>{
 for(const [change,message] of [
 [c=>c.segments[0].approved=false,/review the footage/],
 [c=>c.segments[1].start=4.1,/contiguous/],
 [c=>c.segments[1].id='beans',/unique/],
 [c=>c.segments[1].sourceEnd=4,/source trim/],
 [c=>c.segments[1].sourceDuration=3,/source trim/],
 [c=>c.segments[0].clipUrl='http://example.com/clip.mp4',/HTTPS/]
 ]){const copy=structuredClone(cue);change(copy);assert.throws(()=>buildRequest(copy),message);}
});
test('fails closed on price, missing estimate and warnings',()=>{
 checkQuote({valid:true,creditsRequired:12,warnings:[]},12);
 for(const q of [{valid:true,creditsRequired:13},{valid:true},{valid:true,creditsRequired:12,warnings:['crop']}])assert.throws(()=>checkQuote(q,12));
});
test('100% active is not completed; failure and expired output are rejected',async()=>{
 const jobs=[{state:'active',progress:100},{state:'completed',result:{url:'https://example.com/video.mp4'}}];let calls=0;
 const result=await trackJob({jobs:{get:async()=>{calls++;return jobs.shift();}}},'saved-id',{intervalMs:0,log:()=>{}});
 assert.equal(calls,2);assert.equal(result.state,'completed');
 assert.throws(()=>outputUrl({state:'failed',failedReason:'Media unavailable'}),/Media unavailable/);
 assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01'}),/expired/);
});
test('uncertain submission retains a marker and cannot submit twice',async()=>{
 const d=await mkdtemp(join(tmpdir(),'zvid-broll-'));let calls=0;
 const client={renders:{create:async()=>{calls++;throw Error('network interrupted');}}};
 await assert.rejects(submitOnce(client,buildRequest(cue),{status:'submission-attempted'},d),/interrupted/);
 assert.equal((await readRun(d+'/run.json')).status,'submission-attempted');
 await assert.rejects(submitOnce(client,buildRequest(cue),{},d),/EEXIST/);assert.equal(calls,1);
});
test('saves accepted ID before tracking; media download has no API credential',async()=>{
 const d=await mkdtemp(join(tmpdir(),'zvid-broll-'));
 await submitOnce({renders:{create:async()=>({jobId:'saved-job',creditsReserved:12})}},buildRequest(cue),{},d);
 assert.equal((await readRun(d+'/run.json')).jobId,'saved-job');
 await downloadVideo('https://example.com/video.mp4',d+'/video.mp4',async(_url,init)=>{
 assert.equal(init.headers,undefined);return new Response(new Uint8Array([0,1,2]),{headers:{'Content-Type':'video/mp4'}});
 });
 await assert.rejects(downloadVideo('https://example.com/video.mp4',d+'/bad.mp4',async()=>new Response('error',{headers:{'Content-Type':'text/html'}})),/video media/);
});
