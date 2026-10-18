import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { receiver } from './receiver.mjs';
import { openStore } from './store.mjs';
import { mkdirSync } from 'node:fs';

export const sample = {
  event:'render.completed',jobId:'550e8400-e29b-41d4-a716-446655440000',
  timestamp:'2026-10-18T12:00:00.000Z',
  data:{status:'completed',url:'https://cdn.zvid.io/blog/csv-product-videos/21a92337fadc/daily-face-cream.mp4'},
};
export function signedRequest(event, deliveryId, secret, timestamp=String(Math.floor(Date.now()/1000))) {
  const body=Buffer.from(JSON.stringify(event));
  const headers={ 'content-type':'application/json','x-zvid-timestamp':timestamp,
    'x-zvid-signature':'sha256='+createHmac('sha256',secret).update(timestamp+'.').update(body).digest('hex'),
    'x-zvid-event':event.event,'x-zvid-delivery-id':deliveryId,
    ...(!event.test?{'x-zvid-job-id':event.jobId}:{}),
  };
  return {method:'POST',headers,body};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  mkdirSync('out',{recursive:true});
  const directory=mkdtempSync('out/demo-');
  const filename=join(directory,'receiver.sqlite');
  const store=openStore(filename);const secret='local-demo-secret';
  const server=receiver({store,secret});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/hooks/zvid`;
  try {
    store.track(sample.jobId,'cream-01');
    const first=await fetch(url,signedRequest(sample,'1001',secret));
    const duplicate=await fetch(url,signedRequest(sample,'1001',secret));
    const another=await fetch(url,signedRequest(sample,'1002',secret));
    console.log(`HTTP responses: ${first.status}, ${duplicate.status}, ${another.status}`);
    console.log('Processing:',JSON.stringify(store.process()));
    const state=store.snapshot();
    console.log(`Source cream-01: ${state.renders[0].state}`);
    console.log(`Inbox deliveries: ${state.inbox.length}; outbox actions: ${state.outbox.length}`);
    console.log('Database:',filename);
    console.log('Synthetic events only. The linked video already exists; this command does not render or download it.');
    if([first.status,duplicate.status,another.status].some(s=>s!==204)||state.outbox.length!==1)throw new Error('Unexpected demo result');
  } finally {server.close();server.closeAllConnections();await once(server,'close');store.close();}
}
