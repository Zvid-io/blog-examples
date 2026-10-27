import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimRun, outputUrl, trackJob } from '../src/helpers.js';
test('claiming the same record twice prevents a second submission',async()=>{const dir=await mkdtemp(join(tmpdir(),'zvid-variant-test-'));try{await claimRun({attempt:true},join(dir,'run.json'));await assert.rejects(claimRun({attempt:true},join(dir,'run.json')),{code:'EEXIST'});}finally{await rm(dir,{recursive:true});}});
test('100 percent progress does not mean completion',async()=>{let calls=0;const client={jobs:{get:async()=>++calls===1?{state:'active',progress:100}:{state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'}}}};await trackJob(client,'saved-id',{intervalMs:0,log:()=>{}});assert.equal(calls,2);});
test('failed and expired jobs do not yield downloadable URLs',()=>{assert.throws(()=>outputUrl({state:'failed',failedReason:'media unavailable'}),/media unavailable/);assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01',result:'https://cdn.zvid.io/old.mp4'}),/expired/);});
