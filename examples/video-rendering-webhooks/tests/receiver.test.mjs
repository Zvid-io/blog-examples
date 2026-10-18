import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { receiver, verify } from '../src/receiver.mjs';
import { openStore } from '../src/store.mjs';
import { sample, signedRequest } from '../src/demo.mjs';
const secret='test-only-secret';
const raw=e=>Buffer.from(JSON.stringify(e));
const failed={...sample,event:'render.failed',data:{status:'failed',error:'Source unavailable'}};

async function fixture(t,override) {
  const dir=mkdtempSync(join(tmpdir(),'zvid-webhooks-'));const filename=join(dir,'receiver.sqlite');
  const store=openStore(filename);const server=receiver({store:override||store,secret});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const post=(event=sample,id='1001')=>fetch(`http://127.0.0.1:${server.address().port}/hooks/zvid`,signedRequest(event,id,secret));
  t.after(async()=>{server.close();server.closeAllConnections();await once(server,'close');store.close();rmSync(dir,{recursive:true,force:true});});
  return {store,post,filename,url:`http://127.0.0.1:${server.address().port}/hooks/zvid`};
}

test('raw bytes, fresh timestamp and equal length signature are required',()=>{
  const r=signedRequest(sample,'1',secret,'1000');
  const v=(body=r.body,time='1000',sig=r.headers['x-zvid-signature'])=>verify(body,time,sig,secret,1000);
  assert.ok(v());assert.ok(v(r.body,'1000',r.headers['x-zvid-signature'].toUpperCase().replace('SHA256','sha256')));
  assert.equal(v(Buffer.concat([r.body,Buffer.from(' ')])),false);
  assert.equal(v(r.body,'699'),false);assert.equal(v(r.body,'1301'),false);
  assert.equal(v(r.body,'invalid'),false);assert.equal(v(r.body,'1000','sha256=00'),false);
});
test('receipt survives another database connection before worker execution',async t=>{
  const {post,filename}=await fixture(t);assert.equal((await post()).status,204);
  const second=openStore(filename);assert.equal(second.snapshot().inbox.length,1);
  assert.equal(second.snapshot().inbox[0].processed_at,null);second.close();
});
test('automatic attempts and separate deliveries create only one business action',async t=>{
  const {post,store}=await fixture(t);store.track(sample.jobId,'cream-01');
  for(const id of ['1','1','2'])assert.equal((await post(sample,id)).status,204);
  assert.deepEqual(store.process(),{processed:2,deferred:0});store.process();
  assert.equal(store.snapshot().outbox.length,1);assert.equal(store.snapshot().renders[0].state,'completed');
});
test('unknown job remains pending until its submission identity is recorded',async t=>{
  const {post,store}=await fixture(t);await post();assert.deepEqual(store.process(),{processed:0,deferred:1});
  store.track(sample.jobId,'cream-01');assert.deepEqual(store.process(),{processed:1,deferred:0});
});
test('dashboard test without job header is acknowledged without business work',async t=>{
  const {post,store}=await fixture(t);assert.equal((await post({...sample,test:true})).status,204);
  assert.deepEqual(store.process(),{processed:1,deferred:0});assert.equal(store.snapshot().outbox.length,0);
});
test('failure event stores the error and a single failure action',async t=>{
  const {post,store}=await fixture(t);store.track(sample.jobId,'cream-01');await post(failed);
  store.process();const s=store.snapshot();assert.equal(s.renders[0].error,'Source unavailable');
  assert.equal(s.outbox[0].topic,'render.failed');assert.equal(s.renders[0].output_url,null);
});
test('malformed, unsigned, tampered and mismatched requests fail before persistence',async t=>{
  const {url,store}=await fixture(t);
  const requests=[
    [signedRequest(sample,'1',secret),401,'unsigned'],
    [signedRequest(sample,'1',secret),401,'tamper'],
    [signedRequest({...sample,data:{status:'completed'}},'1',secret),400,'shape'],
    [signedRequest(sample,'1',secret),400,'header'],
    [signedRequest(sample,'1',secret,'1'),401,'stale'],
  ];
  for(const [r,status,kind] of requests){
    if(kind==='unsigned')delete r.headers['x-zvid-signature'];
    if(kind==='tamper')r.body=Buffer.concat([r.body,Buffer.from(' ')]);
    if(kind==='header')r.headers['x-zvid-job-id']='different';
    assert.equal((await fetch(url,r)).status,status);
  }
  assert.equal(store.snapshot().inbox.length,0);
});
test('receipt failure returns 503 and never acknowledges success',async t=>{
  const {post}=await fixture(t,{accept(){throw new Error('disk unavailable');}});
  assert.equal((await post()).status,503);
});
test('delivery id reused with different signed content returns conflict',async t=>{
  const {post}=await fixture(t);assert.equal((await post()).status,204);
  assert.equal((await post(failed)).status,409);
});
test('outbox write failure rolls back state and leaves receipt pending',async t=>{
  const {post,store,filename}=await fixture(t);store.track(sample.jobId,'cream-01');await post();
  const second=new DatabaseSync(filename);second.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;");
  assert.deepEqual(store.process(),{processed:0,deferred:1});
  assert.equal(store.snapshot().renders[0].state,'waiting');assert.equal(store.snapshot().outbox.length,0);
  second.exec('DROP TRIGGER fail_outbox');second.close();
  assert.deepEqual(store.process(),{processed:1,deferred:0});
});
test('conflicting terminal events are retained for investigation',async t=>{
  const {post,store}=await fixture(t);store.track(sample.jobId,'cream-01');await post();store.process();
  await post(failed,'2');assert.deepEqual(store.process(),{processed:0,deferred:1});
  assert.equal(store.snapshot().outbox.length,1);assert.match(store.snapshot().inbox.find(i=>i.delivery_id==='2').problem,/conflicting/);
});
test('reconciliation accepts both API result shapes and shares the idempotent transition',()=>{
  for(const result of [sample.data.url,{url:sample.data.url}]){
    const s=openStore(':memory:');s.track(sample.jobId,'cream-01');
    assert.ok(s.reconcile(sample.jobId,{id:sample.jobId,state:'completed',result}));
    s.accept('1',raw(sample),sample);s.process();assert.equal(s.snapshot().outbox.length,1);s.close();
  }
});
test('reconciliation refuses unknown identity, expired output and missing result',()=>{
  const s=openStore(':memory:');s.track(sample.jobId,'cream-01');
  for(const job of [{id:'wrong',state:'completed',result:sample.data.url},
    {id:sample.jobId,state:'completed',result:null},
    {id:sample.jobId,state:'completed',result:sample.data.url,outputExpiresAt:'2000-01-01T00:00:00Z'}])
    assert.throws(()=>s.reconcile(sample.jobId,job));
  assert.equal(s.snapshot().outbox.length,0);s.close();
});
