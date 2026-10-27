import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {variablesFor,expectedTimeline,checkResolved,prepareLesson} from '../src/lesson.js';
import {checkQuote,outputUrl,submitOnce,trackJob} from '../src/helpers.js';
const lesson=JSON.parse(await readFile(new URL('../data/lesson.json',import.meta.url),'utf8'));
const template=JSON.parse(await readFile(new URL('../data/template.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(lesson);
function fakeResolved(v) {
  return {duration:expectedTimeline(v).duration,scenes:[{id:'opening',visuals:[{type:'TEXT',text:v.title}]},...v.points.map((p,i)=>({id:`point-${i+1}`,visuals:[p.number,p.heading,p.body].map(text=>({type:'TEXT',text}))})),...(v.showExample?[{id:'example',visuals:[v.exampleTitle,v.exampleBody].map(text=>({type:'TEXT',text}))}]:[]),{id:'takeaway',visuals:[v.takeaway,v.limitation].map(text=>({type:'TEXT',text}))}]};
}
test('maps lesson points to consecutive card labels without changing source',()=>{const source=copy();const v=variablesFor(source);assert.deepEqual(v.points.map(p=>p.number),['01','02','03']);assert.equal(source.points[0].number,undefined);assert.deepEqual(expectedTimeline(v),{sceneCount:6,duration:30});});
test('one point without an example becomes three scenes and fourteen seconds',()=>{const l=copy();l.points=l.points.slice(0,1);l.showExample=false;const v=variablesFor(l);assert.deepEqual(expectedTimeline(v),{sceneCount:3,duration:14});checkResolved(fakeResolved(v),v);});
test('rejects empty points, excessive copy, string flags and markup',()=>{for(const change of [l=>l.points=[],l=>l.points[0].body='x'.repeat(91),l=>l.showExample='false',l=>l.title='<b>HTTPS</b>',l=>l.title='{{other}}',l=>l.typo='bad']){const l=copy();change(l);assert.throws(()=>variablesFor(l));}});
test('valid JSON with wrong template content is rejected',()=>{const v=variablesFor(copy());const p=fakeResolved(v);p.scenes[1].visuals[1].text='Stale heading';assert.throws(()=>checkResolved(p,v),/point content/);});
test('valid JSON with a wrong condition or duration is rejected',()=>{const v=variablesFor(copy());for(const change of [p=>p.scenes.splice(-2,1),p=>p.duration=31,p=>p.scenes[0].visuals.push({type:'TEXT',text:'{{unresolved}}'})]){const p=fakeResolved(v);change(p);assert.throws(()=>checkResolved(p,v));}});
test('preparation validates and saves a resolved request without rendering',async()=>{const v=variablesFor(copy());const saved=[];let calls=0;const api={authoring:{validate:async request=>{calls++;assert.equal(request.payload,template);assert.equal(request.variables.points[0].number,'01');return{valid:true,payload:fakeResolved(v),creditsRequired:30,warnings:[]};}},renders:{create:()=>assert.fail('Validation must not submit')}};const result=await prepareLesson(api,template,copy(),async(...args)=>saved.push(args));assert.equal(calls,1);assert.equal(saved.length,2);assert.equal(result.request.payload.duration,30);});
test('credit ceiling and warnings prevent a render',()=>{assert.throws(()=>checkQuote({valid:true,creditsRequired:31},30),/exceeds/);assert.throws(()=>checkQuote({valid:true,creditsRequired:30,warnings:['overlap']},30),/warnings/);});
test('uncertain submission leaves an exclusive marker and cannot submit again',async()=>{const dir=await mkdtemp(join(tmpdir(),'zvid-lesson-'));try{let calls=0;const api={renders:{create:async()=>{calls++;throw new Error('network lost');}}};await assert.rejects(submitOnce(api,{}, {status:'submission-attempted'},dir),/network lost/);await assert.rejects(submitOnce(api,{}, {},dir),/EEXIST/);assert.equal(calls,1);}finally{await rm(dir,{recursive:true,force:true});}});
test('failed and expired jobs cannot yield download URLs',()=>{assert.throws(()=>outputUrl({state:'failed',failedReason:'asset unavailable'}),/asset unavailable/);assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01'}),/expired/);});
test('tracking handles completion and failure without a render submission',async()=>{const ok={state:'completed',result:{url:'https://cdn.zvid.io/example.mp4'}};const api={jobs:{get:async()=>ok},renders:{create:()=>assert.fail()}};assert.equal(await trackJob(api,'id',{log:()=>{}}),ok);await assert.rejects(trackJob({jobs:{get:async()=>({state:'failed',failedReason:'bad input'})}},'id',{log:()=>{}}),/bad input/);});
