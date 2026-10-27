import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildVariants } from '../src/project.js';
import { checkBatch } from '../src/index.js';
const content=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url)));
const profiles=JSON.parse(await readFile(new URL('../data/profiles.json',import.meta.url)));
test('three variants preserve the same story but vary positions and endings',()=>{
 const v=buildVariants(content,profiles);assert.deepEqual(v.map(x=>x.duration),[12,14,14]);
 for(const x of v) assert.deepEqual(x.request.payload.scenes.slice(0,3).map(s=>s.visuals[2].text),content.beats.map(b=>b.title));
 assert.deepEqual(v.map(x=>x.request.payload.scenes[0].visuals[2].y),[690,650,610]);
 assert.equal(v[0].request.payload.scenes.length,3);assert.equal(v[1].request.payload.scenes[3].visuals[1].text,'Save this checklist');
});
test('changing copy changes all variants without mutating source',()=>{const c=structuredClone(content);c.beats[0].title='Capture the decision';const v=buildVariants(c,profiles);assert.ok(v.every(x=>x.request.payload.scenes[0].visuals[2].text==='Capture the decision'));assert.equal(content.beats[0].title,'Summarize the call');});
test('rejects too many beats and long copy before API calls',()=>{assert.throws(()=>buildVariants({...content,beats:[...content.beats,content.beats[0]]},profiles),/three beats/);const c=structuredClone(content);c.beats[0].title='x'.repeat(41);assert.throws(()=>buildVariants(c,profiles),/1-40/);});
test('rejects duplicate ids and off-canvas profiles',()=>{assert.throws(()=>buildVariants(content,[profiles[0],profiles[0],profiles[2]]),/once/);const p=structuredClone(profiles);p[0].textX=500;assert.throws(()=>buildVariants(content,p),/layout/);});
test('rejects bad duration and unreviewable markup',()=>{assert.throws(()=>buildVariants({...content,secondsPerBeat:0},profiles),/between/);assert.throws(()=>buildVariants({...content,series:'<script>'},profiles),/angle/);});
test('credit ceiling applies to combined batch before any submission',()=>{const q=[12,14,14].map(creditsRequired=>({valid:true,creditsRequired,warnings:[]}));assert.equal(checkBatch(q,40),40);assert.throws(()=>checkBatch(q,39),/Combined/);assert.throws(()=>checkBatch([{valid:true,creditsRequired:12,warnings:['overlap']}],40),/warnings/);});
