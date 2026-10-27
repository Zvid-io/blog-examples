import {createApi} from './api.js';
import {prepareStories} from './stories.js';
import {checkQuote,downloadVideo,outputUrl,prepareOutput,readJson,readRun,saveJson,submitOnce,trackJob} from './helpers.js';

async function main() {
  const args=process.argv.slice(2),mode=args.shift()||'--validate';
  if(!['--validate','--render','--resume'].includes(mode)) throw new Error('Use npm start, npm run render or npm run resume.');
  let suppliedJobId;
  if(mode==='--resume' && args[0]==='--job-id' && args.length===2) {
    suppliedJobId=args[1]; args.splice(0);
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(suppliedJobId)) throw new Error('--job-id must be a render UUID.');
  }
  if(args.length) throw new Error('Unexpected arguments. Resume accepts --job-id UUID.');
  if(!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Create a key at https://app.zvid.io/api-keys.');
  await prepareOutput();
  const api=createApi(process.env.ZVID_API_KEY);
  let run=await readRun();
  if(mode==='--resume') {
    if(suppliedJobId) {
      if(run?.jobId && run.jobId!==suppliedJobId) throw new Error('out/ already records another job. Preserve it first.');
      run={...run,status:'tracking-existing',jobId:suppliedJobId}; await saveJson('out/run.json',run);
    }
    if(!run?.jobId) throw new Error('No saved job ID. Check Renders at https://app.zvid.io, then use npm run resume -- --job-id YOUR_JOB_ID.');
  } else {
    if(mode==='--render' && run) throw new Error('A submission is already recorded. Use npm run resume.');
    const {request,quote,expected}=await prepareStories(api,await readJson('data/template.json'),await readJson('data/stories.json'),saveJson);
    console.log(`${expected.sceneCount} scenes, ${expected.duration} seconds. Estimate: ${quote.creditsRequired} credits.`);
    if(quote.warnings?.length) throw new Error('Read out/validation.json and resolve its warnings before rendering.');
    if(mode==='--validate') {console.log('Saved out/resolved-project.json. No render submitted.');return;}
    checkQuote(quote,Number(process.env.MAX_RENDER_CREDITS||28));
    run=await submitOnce(api,request,{status:'submission-attempted',submittedAt:new Date().toISOString(),creditsEstimated:quote.creditsRequired},'out');
    console.log(`Job: ${run.jobId}. Reserved credits: ${run.creditsReserved}.`);
  }
  const job=await trackJob(api,run.jobId,{intervalMs:5000,save:value=>saveJson('out/job.json',value)});
  await downloadVideo(outputUrl(job),'out/news-brief.mp4');
  console.log('Saved out/news-brief.mp4');
}
main().catch(error=>{console.error(error.message);if(error.body?.details)console.error(JSON.stringify(error.body.details,null,2));process.exitCode=1;});
