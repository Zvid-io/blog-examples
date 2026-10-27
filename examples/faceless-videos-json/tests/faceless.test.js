import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRequest} from '../src/project.js';
import {checkQuote,outputUrl,trackJob,submitOnce,readRun,downloadVideo} from '../src/helpers.js';
const story=JSON.parse(await readFile(new URL('../data/story.json',import.meta.url),'utf8'));
test('one timing record controls scene durations and absolute caption positions',()=>{
 const {payload}=buildRequest(story);assert.deepEqual(payload.scenes.map(s=>s.duration),[6.56,2.84,6.6]);
 assert.equal(payload.duration,16);assert.equal(payload.audios[0].exit,16);assert.equal(payload.subtitle.captions[3].start,6.56);
 assert.ok(Math.abs(payload.scenes.reduce((n,s)=>n+s.duration,0)-16)<0.0001);
 assert.equal(payload.scenes[0].visuals.filter(v=>v.text==='Maya').length,0);
 assert.equal(payload.scenes[1].visuals.filter(v=>v.text==='Maya').length,1);
 assert.equal(payload.scenes[2].visuals.filter(v=>v.text==='Friday').length,1);
});
test('rejects unreviewed data, gaps, overlapping captions and audio-independent timing errors',()=>{
 for(const [change,message] of [
 [s=>s.reviewed=false,/Review/],[s=>s.segments[1].start=6.7,/contiguous/],
 [s=>s.segments[1].id='decision',/unique/],[s=>s.segments[2].end=15.9,/inside|final/],
 [s=>s.segments[0].captions[1].start=2,/nonoverlapping/],
 [s=>s.segments[1].captions[0].start=0,/inside/],
 [s=>s.narrationUrl='http://example.com/voice.mp3',/HTTPS/],
 [s=>s.segments[0].value='x'.repeat(33),/1-32/]
 ]){const copy=structuredClone(story);change(copy);assert.throws(()=>buildRequest(copy),message);}
});
test('a changed final duration propagates to audio and scene without changing earlier global cues',()=>{
 const changed=structuredClone(story);changed.duration=17;changed.segments[2].end=17;
 const {payload}=buildRequest(changed);assert.equal(payload.scenes[2].duration,7.6);assert.equal(payload.audios[0].exit,17);assert.equal(payload.subtitle.captions[3].start,6.56);
});
test('fails closed on price, missing estimate and warnings',()=>{
 checkQuote({valid:true,creditsRequired:16,warnings:[]},16);
 for(const q of [{valid:true,creditsRequired:17},{valid:true},{valid:true,creditsRequired:16,warnings:['layout']}])assert.throws(()=>checkQuote(q,16));
});
test('active at 100% is not completed; failure and expired output are rejected',async()=>{
 const jobs=[{state:'active',progress:100},{state:'completed',result:{url:'https://example.com/video.mp4'}}];let calls=0;
 const result=await trackJob({jobs:{get:async()=>{calls++;return jobs.shift();}}},'saved-id',{intervalMs:0,log:()=>{}});
 assert.equal(calls,2);assert.equal(result.state,'completed');assert.throws(()=>outputUrl({state:'failed',failedReason:'Audio unavailable'}),/Audio unavailable/);
 assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01'}),/expired/);
});
test('uncertain submission retains marker and prevents a second paid POST',async()=>{
 const d=await mkdtemp(join(tmpdir(),'zvid-faceless-'));let calls=0;
 const client={renders:{create:async()=>{calls++;throw Error('network interrupted');}}};
 await assert.rejects(submitOnce(client,buildRequest(story),{status:'submission-attempted'},d),/interrupted/);
 assert.equal((await readRun(d+'/run.json')).status,'submission-attempted');
 await assert.rejects(submitOnce(client,buildRequest(story),{},d),/EEXIST/);assert.equal(calls,1);
});
test('persists ID before tracking and never forwards API credentials to a media download',async()=>{
 const d=await mkdtemp(join(tmpdir(),'zvid-faceless-'));
 await submitOnce({renders:{create:async()=>({jobId:'saved-job',creditsReserved:16})}},buildRequest(story),{},d);
 assert.equal((await readRun(d+'/run.json')).jobId,'saved-job');
 await downloadVideo('https://example.com/video.mp4',d+'/video.mp4',async(_url,init)=>{
 assert.equal(init.headers,undefined);return new Response(new Uint8Array([0,1,2]),{headers:{'Content-Type':'video/mp4'}});
 });
 await assert.rejects(downloadVideo('https://example.com/video.mp4',d+'/bad.mp4',async()=>new Response('error',{headers:{'Content-Type':'text/html'}})),/video media/);
});
