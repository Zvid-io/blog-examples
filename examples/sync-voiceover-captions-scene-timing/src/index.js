import { ZvidClient } from '@zvid/sdk';
import {buildRequest} from './project.js';
import { checkQuote, downloadVideo, outputUrl, parseArguments, prepareOutput, readJson, readRun, recordAttempt, saveJson, timedFetch, trackJob } from './helpers.js';

async function main() {
  const { mode, jobId } = parseArguments(process.argv.slice(2));
  if (!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  await prepareOutput();
  const zvid = new ZvidClient({ apiKey: process.env.ZVID_API_KEY, baseUrl: 'https://api.zvid.io', maxRetries: 0, fetch: timedFetch });
  let run = await readRun();

  if (mode === '--resume') {
    if (jobId) {
      if (run?.jobId && run.jobId !== jobId) throw new Error('That ID differs from the saved job. Inspect and archive out/ before recovering a different job.');
      run = { ...run, jobId, status: 'recovered', recoveredAt: new Date().toISOString() };
      await saveJson('out/run.json', run);
    }
    if (!run?.jobId) throw new Error('No saved job ID. Check dashboard Renders, then run npm run resume -- --job-id YOUR_EXISTING_JOB_ID. Do not submit again while the outcome is uncertain.');
  } else {
    const project = await readJson('data/timing.json');

    const request = buildRequest(project);
    await saveJson('out/request.json', request);
    const quote = await zvid.authoring.validate(request);
    await saveJson('out/validation.json', quote);
    checkQuote(quote, Number(process.env.MAX_RENDER_CREDITS || 10));
    console.log(`Valid: true. Estimated credits: ${quote.creditsRequired}.`);
    if (mode === '--validate') { console.log('No render submitted. Run npm run render when ready.'); return; }
    if (run) throw new Error('A previous submission is recorded. Use npm run resume. For a deliberately new render, inspect and archive out/ first.');
    // Record the attempt BEFORE the paid POST. An interrupted/uncertain response must not cause an automatic second submission.
    run = { submittedAt: new Date().toISOString(), status: 'submission-attempted', creditsEstimated: quote.creditsRequired };
    await recordAttempt(run);
    const accepted = await zvid.renders.create(request);
    if (!accepted.jobId) throw new Error('Submission returned no job ID. Check dashboard Renders before trying again.');
    console.log(`Accepted job: ${accepted.jobId}.`);
    run = { ...run, status: 'accepted', jobId: accepted.jobId, creditsReserved: accepted.creditsReserved };
    await saveJson('out/run.json', run);
    await saveJson('out/submission.json', accepted);
    console.log(`Job: ${run.jobId}. Reserved credits: ${accepted.creditsReserved}.`);
  }

  const job = await trackJob(zvid, run.jobId, { save: value => saveJson('out/job.json', value) });
  await downloadVideo(outputUrl(job), 'out/timing-demo.mp4');
  console.log('Saved out/timing-demo.mp4');
}

main().catch(error => {
  console.error(error.message);
  if (error.status) console.error(`HTTP ${error.status}. Inspect out/ and the dashboard before resubmitting.`);
  process.exitCode = 1;
});
