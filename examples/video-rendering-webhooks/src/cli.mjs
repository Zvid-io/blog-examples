import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { receiver } from './receiver.mjs';
import { openStore } from './store.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const [command, jobId, sourceId] = process.argv.slice(2);
const store = openStore(resolve('out/receiver.sqlite'));
let server;
try {
  switch (command) {
    case 'serve': {
      server = receiver({store, secret:process.env.ZVID_WEBHOOK_SECRET});
      server.listen(8787, '127.0.0.1', () => console.log('Listening on http://127.0.0.1:8787/hooks/zvid'));
      for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close(() => {store.close(); process.exit(0);}));
      server.once('error', error => {console.error(error.message); store.close(); process.exitCode=1;});
      break;
    }
    case 'track': store.track(jobId,sourceId); console.log('Tracked job:',jobId); break;
    case 'process': console.log(JSON.stringify(store.process(),null,2)); break;
    case 'status': console.log(JSON.stringify(store.snapshot(),null,2)); break;
    case 'reconcile': {
      const key=process.env.ZVID_API_KEY;
      if (!key) throw new Error('Set ZVID_API_KEY');
      const jobs=store.snapshot().renders.filter(r=>!['completed','failed'].includes(r.state));
      // One bounded pass. Scheduling and backoff belong to the application.
      for (const row of jobs) {
        const r=await fetch(`https://api.zvid.io/api/jobs/${row.job_id}`,{
          headers:{'x-api-key':key},redirect:'error',signal:AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new Error(`Job lookup HTTP ${r.status}; inspect before retrying reconciliation`);
        console.log(JSON.stringify({jobId:row.job_id,changed:store.reconcile(row.job_id,await r.json())}));
      }
      break;
    }
    default: throw new Error('Use serve, track JOB_ID SOURCE_ID, process, status or reconcile');
  }
} catch (error) {console.error(error.message); process.exitCode=1;}
finally {if(!server) store.close();}
