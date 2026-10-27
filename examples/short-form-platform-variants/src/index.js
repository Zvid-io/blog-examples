import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { ZvidClient } from '@zvid/sdk';
import { buildVariants } from './project.js';
import { readJson, saveJson, checkQuote, claimRun, downloadVideo, outputUrl, timedFetch, trackJob } from './helpers.js';

async function existsRun(file) { try { return await readJson(file); } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
export function checkBatch(quotes, maximum) {
  if (!Number.isFinite(maximum) || maximum<=0) throw new Error('MAX_RENDER_CREDITS must be a positive number.');
  for(const quote of quotes) checkQuote(quote, maximum);
  const total=quotes.reduce((sum,q)=>sum+q.creditsRequired,0);
  if(total>maximum) throw new Error(`Combined estimate ${total} exceeds MAX_RENDER_CREDITS=${maximum}.`);
  return total;
}
async function main() {
  const mode=process.argv[2] || '--validate';
  if(!['--validate','--render','--resume'].includes(mode) || process.argv.length>3) throw new Error('Use npm start, npm run render, or npm run resume.');
  if(!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  const client=new ZvidClient({apiKey:process.env.ZVID_API_KEY,baseUrl:'https://api.zvid.io',maxRetries:0,fetch:timedFetch});
  const variants=buildVariants(await readJson('data/content.json'),await readJson('data/profiles.json'));
  await mkdir('out',{recursive:true});
  if(mode==='--resume') {
    let found=0;
    for(const id of ['tiktok','reels','shorts']) {
      const run=await existsRun(`out/${id}/run.json`);
      if(!run) { console.log(`${id}: no submission record; nothing submitted by resume.`); continue; }
      found++;
      if(!run.jobId) { console.error(`${id}: submission outcome unknown. Check Renders at https://app.zvid.io before any new submission.`); process.exitCode=1; continue; }
      try { await finish(client,id,run); } catch(error) { console.error(`${id}: ${error.message}`); process.exitCode=1; }
    }
    if(!found) throw new Error('No saved submissions. Run npm start to validate.');
    return;
  }
  if(mode==='--render' && await existsRun('out/batch.json')) throw new Error('This batch already has a submission attempt. Run npm run resume. Inspect all previous jobs before deliberately starting a new batch in a new output folder.');
  const quotes=[];
  for(const v of variants) {
    await mkdir(`out/${v.id}`,{recursive:true});
    await saveJson(`out/${v.id}/request.json`,v.request);
    const quote=await client.authoring.validate(v.request);
    await saveJson(`out/${v.id}/validation.json`,quote);
    quotes.push(quote);
  }
  const total=checkBatch(quotes,Number(process.env.MAX_RENDER_CREDITS || 40));
  console.log(`All three valid. Combined estimate: ${total} credits.`);
  if(mode==='--validate') { console.log('No renders submitted. Run npm run render when ready.'); return; }
  // The exclusive batch record prevents a second local process or blind rerun.
  await claimRun({startedAt:new Date().toISOString(),estimatedCredits:total,variants:variants.map(v=>v.id)},'out/batch.json');
  for(const v of variants) {
    const run={id:v.id,contentId:v.contentId,profileRevision:v.profileRevision,requestSha256:createHash('sha256').update(JSON.stringify(v.request)).digest('hex'),submissionAttemptedAt:new Date().toISOString()};
    await claimRun(run,`out/${v.id}/run.json`);
    // Do not retry this POST: a lost response can still mean a paid job was accepted.
    const accepted=await client.renders.create(v.request);
    if(!accepted.jobId) throw new Error(`${v.id}: no job ID returned. Check Renders before retrying.`);
    run.jobId=accepted.jobId; await saveJson(`out/${v.id}/run.json`,run);
    console.log(`${v.id}: saved job ${run.jobId}`);
  }
  for(const v of variants) { try { await finish(client,v.id,await readJson(`out/${v.id}/run.json`)); } catch(error) { console.error(`${v.id}: ${error.message}`); process.exitCode=1; } }
}
async function finish(client,id,run) {
  const job=await trackJob(client,run.jobId,{save:j=>saveJson(`out/${id}/job.json`,j),log:message=>console.log(`${id}: ${message}`)});
  await downloadVideo(outputUrl(job),`out/${id}/video.mp4`);
  console.log(`Saved out/${id}/video.mp4`);
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/src/index.js')) main().catch(error=>{console.error(error.message);process.exitCode=1;});
