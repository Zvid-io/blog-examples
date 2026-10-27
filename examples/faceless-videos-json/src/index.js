import {createHash} from 'node:crypto';
import {ZvidClient} from '@zvid/sdk';
import {buildRequest} from './project.js';
import {checkQuote,downloadVideo,outputUrl,prepareOutput,readJson,readRun,saveJson,submitOnce,timedFetch,trackJob} from './helpers.js';
async function main() {
  const args=process.argv.slice(2), mode=args.shift()||'--validate';
  if (!['--validate','--render','--resume'].includes(mode)) throw new Error('Use npm start, npm run render or npm run resume.');
  let suppliedJobId;
  if (mode==='--resume' && args[0]==='--job-id' && args.length===2) {
    suppliedJobId=args[1]; args.splice(0);
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(suppliedJobId)) throw new Error('--job-id must be a render UUID.');
  }
  if (args.length) throw new Error('Unexpected arguments. Resume accepts --job-id UUID.');
  if (!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  await prepareOutput();
  const client=new ZvidClient({apiKey:process.env.ZVID_API_KEY,baseUrl:'https://api.zvid.io',maxRetries:0,fetch:timedFetch});
  let run=await readRun();
  if (mode==='--resume') {
    if (suppliedJobId) {
      if (run?.jobId && run.jobId!==suppliedJobId) throw new Error('out/ already records a different job. Preserve it first.');
      run={...run,status:'tracking-existing',jobId:suppliedJobId};await saveJson('out/run.json',run);
    }
    if (!run?.jobId) throw new Error('No saved job ID. Check dashboard Renders, then use npm run resume -- --job-id YOUR_JOB_ID.');
  } else {
    if (mode==='--render' && run) throw new Error('A submission is already recorded. Use npm run resume. Inspect the job and preserve out/ before a deliberately new render.');
    const request=buildRequest(await readJson('data/story.json'));
    await saveJson('out/candidate-request.json',request);
    const quote=await client.authoring.validate(request);
    await saveJson('out/validation.json',quote);
    checkQuote(quote,Number(process.env.MAX_RENDER_CREDITS||16));
    console.log(`Valid: true. Estimated credits: ${quote.creditsRequired}.`);
    if (mode==='--validate') {console.log('No render submitted.');return;}
    run=await submitOnce(client,request,{submittedAt:new Date().toISOString(),status:'submission-attempted',creditsEstimated:quote.creditsRequired,requestSha256:createHash('sha256').update(JSON.stringify(request)).digest('hex')},'out');
    console.log(`Job: ${run.jobId}. Reserved credits: ${run.creditsReserved}.`);
  }
  const job=await trackJob(client,run.jobId,{intervalMs:5000,save:value=>saveJson('out/job.json',value)});
  await downloadVideo(outputUrl(job),'out/faceless-meeting-notes.mp4');
  console.log('Saved out/faceless-meeting-notes.mp4');
}
main().catch(error=>{console.error(error.message);if(error.status)console.error(`HTTP ${error.status}. Inspect out/ before resubmitting.`);process.exitCode=1;});

