import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRequest, validateText, summarize} from '../debug.mjs';
const text = await readFile(new URL('../request.json', import.meta.url), 'utf8');
test('valid fixture passes local checks and remains unchanged', () => {
  const request = parseRequest(text);
  assert.equal(request.payload.visuals[0].text, 'JSON fixed');
  assert.equal(request.payload.duration, 3);
});
test('syntax and envelope errors stop before the network', async () => {
  for (const file of ['trailing-comma', 'wrong-envelope']) {
    const fixture = await readFile(new URL('../fixtures/' + file + '.json', import.meta.url), 'utf8');
    let calls = 0;
    await assert.rejects(validateText(fixture, {key:'test', fetchImpl:async()=>{calls++;}}));
    assert.equal(calls, 0);
  }
  for (const input of ['[]', 'null', '{"payload":null}', '{"payload":{},"template":"tpl_x"}']) {
    assert.throws(() => parseRequest(input));
  }
});
test('API uses exact file bytes and only the validation route', async () => {
  const result = await validateText(text, {key:'test-key', fetchImpl:async(url,options) => {
    assert.equal(url, 'https://api.zvid.io/api/render/validate/api-key');
    assert.equal(options.body, text);
    assert.equal(options.headers['x-api-key'], 'test-key');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({valid:true, creditsRequired:3, payload:JSON.parse(text).payload, warnings:[]}), {headers:{'content-type':'application/json'}});
  }});
  assert.equal(result.ok, true);
  assert.match(summarize(result), /No render job/);
});
test('HTTP validation errors remain actionable', async () => {
  const result = await validateText(text, {key:'test', fetchImpl:async()=>new Response(JSON.stringify({
    error:'Validation failed', details:[{field:'duration',message:'Duration must be at least 0.1 seconds'}]
  }),{status:400,headers:{'content-type':'application/json','x-request-id':'example-request'}})});
  assert.equal(result.ok, false);
  assert.equal(result.report.response.details[0].field, 'duration');
  assert.equal(result.report.requestId, 'example-request');
});
test('HTML response is captured without a second parser exception', async () => {
  const result = await validateText(text, {key:'test', fetchImpl:async()=>new Response('<html>Unavailable</html>',{status:502,headers:{'content-type':'text/html'}})});
  assert.equal(result.ok, false);
  assert.equal(result.report.response, null);
  assert.equal(result.report.rawResponse, '<html>Unavailable</html>');
  assert.match(summarize(result), /not JSON/);
});
test('network failures do not retry or leak credentials', async () => {
  let calls=0;
  await assert.rejects(validateText(text,{key:'private-key',fetchImpl:async()=>{calls++;throw new Error('private-key');}}),
    error => /No automatic retry/.test(error.message) && !error.message.includes('private-key'));
  assert.equal(calls,1);
});
test('HTTP 200 without valid true is not success',async()=>{
  const result=await validateText(text,{key:'test',fetchImpl:async()=>new Response('{}')});
  assert.equal(result.ok,false);
});
test('missing key stops before the network',async()=>{
  await assert.rejects(validateText(text,{fetchImpl:()=>{throw new Error('network should not run');}}),/Set ZVID_API_KEY/);
});
