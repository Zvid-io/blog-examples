import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { ZvidClient } from '@zvid/sdk';
import { buildRequest, checkQuote, downloadVideo, outputUrl, readJson, readRun, saveJson, submitOnce, timedFetch, trackJob } from './helpers.js';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0]?.startsWith('--') && ['--validate','--render','--resume'].includes(args[0]) ? args.shift() : '--validate';
  const hidePrice = args.includes('--hide-price');
  if (hidePrice) args.splice(args.indexOf('--hide-price'), 1);
  let suppliedJobId;
  if (args[0] === '--job-id' && args.length === 2 && mode === '--resume') {
    suppliedJobId = args[1]; args.splice(0);
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(suppliedJobId)) throw new Error('--job-id must be a UUID from your Renders page.');
  }
  if (args.length) throw new Error('Use npm start, npm run render, or npm run resume. Optional: --hide-price. Resume also accepts --job-id UUID.');
  if (!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  const directory = `out/price-${hidePrice ? 'hidden' : 'shown'}`;
  await mkdir(directory, {recursive:true});
  const client = new ZvidClient({apiKey:process.env.ZVID_API_KEY,baseUrl:'https://api.zvid.io',maxRetries:0,fetch:timedFetch});
  let run = await readRun(directory + '/run.json');
  if (mode === '--resume') {
    if (suppliedJobId) {
      if (run?.jobId && run.jobId !== suppliedJobId) throw new Error('This output directory already records a different job. Preserve it before tracking another.');
      run = {...run,status:'tracking-existing',jobId:suppliedJobId};
      await saveJson(directory + '/run.json', run);
    }
    if (!run?.jobId) throw new Error('No saved job ID. Check dashboard Renders after an uncertain submission, then use npm run resume -- --job-id YOUR_JOB_ID.');
  } else {
    if (mode === '--render' && run) throw new Error('A submission is already recorded. Use npm run resume. Before a deliberately new render, inspect the job and rename this output directory to preserve its record.');
    const request = buildRequest(await readJson('data/project.json'), await readJson('data/vehicle.json'), hidePrice);
    const quote = await client.authoring.validate(request);
    await saveJson(directory + '/validation.json', quote);
    checkQuote(quote, Number(process.env.MAX_RENDER_CREDITS || 13));
    console.log(`Valid: true. Estimated credits: ${quote.creditsRequired}.`);
    if (mode === '--validate') {console.log('No render submitted.');return;}
    run = await submitOnce(client, request, {
      submittedAt:new Date().toISOString(),status:'submission-attempted',creditsEstimated:quote.creditsRequired,
      requestSha256:createHash('sha256').update(JSON.stringify(request)).digest('hex')
    }, directory);
    console.log(`Job: ${run.jobId}. Reserved credits: ${run.creditsReserved}.`);
  }
  const job = await trackJob(client, run.jobId, {save:value=>saveJson(directory + '/job.json',value)});
  await downloadVideo(outputUrl(job), directory + '/listing.mp4');
  console.log(`Saved ${directory}/listing.mp4`);
}
main().catch(error=>{console.error(error.message);if(error.status)console.error(`HTTP ${error.status}. Inspect out/ and the dashboard before resubmitting.`);process.exitCode=1;});
