import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRequest,timingSummary} from '../src/project.js';
import {checkQuote,outputUrl,trackJob,downloadVideo,parseArguments,recordAttempt} from '../src/helpers.js';
const record=()=>JSON.parse(readFileSync(new URL('../data/timing.json',import.meta.url)));
test('overlaps preserve intended global starts and final duration',()=>{
 const r=record(),q=buildRequest(r),t=timingSummary(r);
 assert.deepEqual(t.scenes.map(s=>s.globalStart),[0,2.72,5.6]);
 assert.deepEqual(t.scenes.map(s=>s.duration),[3.12,3.28,4.4]);
 assert.equal(t.duration,10);
 assert.equal(q.payload.scenes[1].visuals[3].enterBegin,1.04);
 assert.equal(q.payload.subtitle.captions[1].words[3].start,3.76);
 assert.equal(q.payload.audios[0].enter,0);
 assert.equal(q.payload.audios[0].exit,9.24);
 assert.equal(q.payload.audios[0].audioEnd,9.24);
});
test('manual recovery only tracks an existing job',()=>{
 assert.deepEqual(parseArguments(['--resume','--job-id','render_existing-123']),{mode:'--resume',jobId:'render_existing-123'});
 assert.deepEqual(parseArguments([]),{mode:'--validate'});
 for(const args of [['--render','--job-id','123'],['--resume','--job-id'],['--resume','--job-id','../bad'],['--render','extra']])assert.throws(()=>parseArguments(args));
});
test('concurrent submissions cannot replace the first recorded attempt',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'zvid-timing-')),file=join(directory,'run.json');
 try {
   const attempts=await Promise.allSettled([recordAttempt({attempt:1},file),recordAttempt({attempt:2},file)]);
   assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
   assert.match(attempts.find(r=>r.status==='rejected').reason.message,/already recorded/);
   assert.ok([1,2].includes(JSON.parse(await readFile(file,'utf8')).attempt));
 } finally {await unlink(file);await rmdir(directory);}
});
test('hard cuts keep the same word and scene boundaries',()=>{
 const r=record();for(const s of r.segments)s.overlap=0;
 assert.deepEqual(timingSummary(r).scenes.map(s=>s.globalStart),[0,2.72,5.6]);
 assert.deepEqual(buildRequest(r).payload.scenes.map(s=>s.duration),[2.72,2.88,4.4]);
});
test('reject timing errors before networking',()=>{
 const mutations=[r=>r.segments[1].start=2.7,r=>r.segments[0].overlap=8,r=>r.segments[2].overlap=.4,r=>r.segments[1].cue.start=2,r=>r.segments[0].captions[0].words[0].end=4,r=>r.segments[2].end=9,r=>r.segments[1].id='narration',r=>r.segments[0].captions[0].text='wrong',r=>r.reviewed=false,r=>r.segments[1].start=2.721,r=>r.audioEnd=12,r=>r.audioEnd=8];
 for(const mutate of mutations){const r=record();mutate(r);assert.throws(()=>buildRequest(r));}
});
test('credit guard rejects invalid, unknown, over-budget and warned requests',()=>{
 assert.doesNotThrow(()=>checkQuote({valid:true,creditsRequired:10,warnings:[]},10));
 for(const q of [{valid:false},{valid:true},{valid:true,creditsRequired:11},{valid:true,creditsRequired:10,warnings:['test']}])assert.throws(()=>checkQuote(q,10));
});
test('100 percent active is not completion; failed jobs stop',async()=>{
 const states=[{state:'active',progress:100},{state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'}}];let calls=0;
 const job=await trackJob({jobs:{get:async()=>{calls++;return states.shift();}}},'fixture',{intervalMs:0,log:()=>{}});assert.equal(calls,2);assert.equal(job.state,'completed');
 await assert.rejects(()=>trackJob({jobs:{get:async()=>({state:'failed',failedReason:'fixture failure'})}},'fixture',{log:()=>{}}),/fixture failure/);
 assert.throws(()=>outputUrl({state:'active',progress:100}));
 assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01',result:{url:'https://cdn.zvid.io/example.mp4'}}));
});
test('reject nonvideo download and never send API credentials to media hosts',async()=>{
 await assert.rejects(()=>downloadVideo('https://cdn.zvid.io/test','out/unused',async(_url,init)=>{assert.equal(init.headers,undefined);return new Response('oops',{headers:{'content-type':'text/plain'}});}),/video media/);
});
