import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRequest, checkQuote, outputUrl, trackJob, downloadVideo, claimRun, toVariables, submitOnce } from '../src/helpers.js';

const vehicle = JSON.parse(await readFile(new URL('../data/vehicle.json', import.meta.url), 'utf8'));
test('vehicle data becomes display variables without mutating the source', () => {
  const request = buildRequest({name:'Aster'}, vehicle);
  assert.equal(request.variables.mileage, '28,640 miles');
  assert.equal(request.variables.price, '$24,900');
  assert.equal(request.variables.photoFront, vehicle.photos[0].image);
  request.variables.photos[0].label = 'Changed';
  assert.equal(vehicle.photos[0].label, 'Front three-quarter');
  for (const project of [null, [], {payload:{}}, {template:'tpl_example'}]) assert.throws(()=>buildRequest(project, vehicle));
});
test('price switch is a boolean and hidden pricing permits an omitted amount', () => {
  assert.equal(toVariables({...vehicle, price:undefined}, true).price, '');
  assert.equal(toVariables(vehicle, true).showPrice, false);
  assert.throws(()=>toVariables({...vehicle, showPrice:'false'}), /boolean/);
  for (const patch of [{price:-1}, {price:24.5}, {mileage:-1}, {photos:[]}, {photos:[{label:'x',image:'http://example.com/x.png'}]}]) assert.throws(()=>toVariables({...vehicle,...patch}));
});
test('an uncertain submission cannot be resubmitted and accepted IDs are saved', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'car-submit-'));
  let calls=0;
  const client={renders:{create:async()=>{calls++;throw new Error('network timeout')}}};
  try {
    await assert.rejects(submitOnce(client,{}, {status:'submission-attempted'},dir),/timeout/);
    await assert.rejects(submitOnce(client,{}, {},dir),{code:'EEXIST'});
    assert.equal(calls,1);
    await rm(path.join(dir,'run.json'));
    const saved=await submitOnce({renders:{create:async()=>({jobId:'test-job',creditsReserved:13})}}, {}, {}, dir);
    assert.equal(saved.jobId,'test-job');
    assert.equal(JSON.parse(await readFile(path.join(dir,'run.json'),'utf8')).jobId,'test-job');
  } finally {
    for(const f of ['run.json','request.json','submission.json'])await rm(path.join(dir,f),{force:true});
    await rmdir(dir);
  }
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
