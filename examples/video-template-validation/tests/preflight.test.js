import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkInput, checkResolved, runMatrix} from '../src/preflight.js';
import {checkQuote, outputUrl, trackJob, submitOnce, readRun, downloadVideo} from '../src/helpers.js';
import {createApi} from '../src/api.js';
const cases = JSON.parse(await readFile(new URL('../data/cases.json', import.meta.url), 'utf8'));
const project = JSON.parse(await readFile(new URL('../data/template.json', import.meta.url), 'utf8'));
const typical = cases[0];
const resolved = () => ({duration:10.5, scenes:[
  {id:'intro', visuals:[{type:'TEXT', text:typical.variables.title}]},
  ...typical.variables.items.map((item,i) => ({id:`status-${i+1}`, visuals:[{type:'TEXT',text:item.label},{type:'TEXT',text:item.value}]})),
  {id:'cta', visuals:[{type:'TEXT',text:typical.variables.cta}]},
]});

test('six valid inputs and four application failures have intentional boundaries', () => {
  for (const c of cases.filter(c => !c.rejectAt)) checkInput(c.variables);
  for (const c of cases.filter(c => c.rejectAt === 'input')) assert.throws(() => checkInput(c.variables), new RegExp(c.expectedError));
  assert.throws(() => checkInput({...typical.variables, items:[{label:'API',value:'<b>Ready</b>'}]}), /plain text/);
});
test('content checks catch valid-looking defaults, missing CTA, wrong order and changed duration', () => {
  checkResolved(resolved(), typical);
  for (const change of [p => p.scenes[0].visuals[0].text='Old default', p => p.scenes.pop(), p => p.scenes.reverse(), p => p.duration=12]) {
    const p=resolved(); change(p); assert.throws(() => checkResolved(p, typical));
  }
});
test('matrix sends inline template and variables and returns the resolved snapshot for rendering', async () => {
  const requests=[];
  const api={authoring:{validate:async request => {requests.push(request); return {valid:true,payload:resolved(),warnings:[],creditsRequired:11};}}};
  const result=await runMatrix(api, project, [typical], {save:async()=>{},log:()=>{}});
  assert.deepEqual(requests[0], {payload:project,variables:typical.variables});
  assert.deepEqual(result.request, {payload:resolved()});
  assert.equal(result.request.payload.variables, undefined);
});
test('an expected bad API case cannot hide an authentication error or network failure', async () => {
  const fixture=cases.find(c => c.name==='wrong-items-type');
  for (const error of [Object.assign(Error('auth'),{status:401}), Error('network')]) {
    await assert.rejects(runMatrix({authoring:{validate:async()=>{throw error;}}},project,[fixture],{save:async()=>{},log:()=>{}}), /expected HTTP 400/);
  }
});
test('warnings stop the matrix and no render occurs', async () => {
  const api={authoring:{validate:async()=>({valid:true,payload:resolved(),warnings:['text overflows'],creditsRequired:11})}};
  await assert.rejects(runMatrix(api,project,[typical],{save:async()=>{},log:()=>{}}), /warnings/);
});
test('credit ceiling, missing estimate and invalid validation all stop a paid render', () => {
  checkQuote({valid:true,creditsRequired:11,warnings:[]},11);
  for (const q of [{valid:true,creditsRequired:12},{valid:true},{valid:false},{valid:true,creditsRequired:11,warnings:['layout']}]) assert.throws(()=>checkQuote(q,11));
});
test('100 percent active is not completion; failed, missing and expired outputs are rejected', async () => {
  const jobs=[{state:'active',progress:100},{state:'completed',result:{url:'https://example.com/video.mp4'}}];let calls=0;
  await trackJob({jobs:{get:async()=>{calls++;return jobs.shift();}}},'id',{intervalMs:0,log:()=>{}});assert.equal(calls,2);
  assert.throws(()=>outputUrl({state:'failed',failedReason:'Source missing'}),/Source missing/);
  assert.throws(()=>outputUrl({state:'completed',outputExpiredAt:'2020-01-01'}),/expired/);
  assert.throws(()=>outputUrl({state:'completed',result:{}}),/no HTTPS/);
});
test('uncertain submission preserves its marker and blocks a second paid POST', async () => {
  const d=await mkdtemp(join(tmpdir(),'zvid-preflight-'));let calls=0;
  const api={renders:{create:async()=>{calls++;throw Error('timeout');}}};
  await assert.rejects(submitOnce(api,{payload:resolved()},{status:'submission-attempted'},d),/timeout/);
  await assert.rejects(submitOnce(api,{payload:resolved()},{},d),/EEXIST/);
  assert.equal(calls,1);assert.equal((await readRun(d+'/run.json')).status,'submission-attempted');
});
test('saved ID supports resume and media downloads never receive API credentials', async () => {
  const d=await mkdtemp(join(tmpdir(),'zvid-preflight-'));
  await submitOnce({renders:{create:async()=>({jobId:'saved',creditsReserved:11})}},{payload:resolved()},{},d);
  assert.equal((await readRun(d+'/run.json')).jobId,'saved');
  await downloadVideo('https://example.com/video.mp4',d+'/video.mp4',async(_url,init)=>{
    assert.equal(init.headers,undefined);return new Response(new Uint8Array([0,1]),{headers:{'Content-Type':'video/mp4'}});
  });
  await assert.rejects(downloadVideo('https://example.com/video.mp4',d+'/bad.mp4',async()=>new Response('error',{headers:{'Content-Type':'text/html'}})),/video media/);
});
test('API wrapper preserves field errors and rejects non-JSON responses', async () => {
  const api=createApi('illustrative-key',async(url,init)=>{
    assert.equal(url,'https://api.zvid.io/api/render/validate/api-key');
    assert.equal(init.headers['x-api-key'],'illustrative-key');
    return new Response(JSON.stringify({error:'Template resolution failed',details:[{field:'scenes[1].iterate',message:'array required'}]}),{status:400});
  });
  await assert.rejects(api.authoring.validate({}),error=>error.status===400 && error.body.details[0].field==='scenes[1].iterate');
  await assert.rejects(createApi('key',async()=>new Response('<html>error</html>',{status:502})).authoring.validate({}),/HTTP 502: expected JSON/);
});
