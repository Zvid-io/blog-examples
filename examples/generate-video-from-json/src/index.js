import { createHash } from 'node:crypto';
import { ZvidClient } from '@zvid/sdk';
import { buildRequest, checkQuote, claimRun, downloadVideo, outputUrl, prepareOutput, readJson, readRun, saveJson, timedFetch, trackJob } from './helpers.js';

async function main() {
  const mode = process.argv[2] || '--validate';
  if (!['--validate', '--render', '--resume'].includes(mode) || process.argv.length > 3)
    throw new Error('Use npm start, npm run render, or npm run resume.');
  if (!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  await prepareOutput();
  const zvid = new ZvidClient({ apiKey: process.env.ZVID_API_KEY, baseUrl: 'https://api.zvid.io', maxRetries: 0, fetch: timedFetch });
  let run = await readRun();
  if (mode === '--resume') {
    if (!run?.jobId) throw new Error('No saved job ID. Check Renders at https://app.zvid.io if a previous submission had an uncertain outcome.');
  } else {
    if (mode === '--render' && run) throw new Error('A submission is already recorded. Use npm run resume. Before a deliberately new render, inspect the previous job and rename out/ to keep its record.');
    const request = buildRequest(await readJson('data/project.json'));
    const quote = await zvid.authoring.validate(request);
    await saveJson('out/validation.json', quote);
    checkQuote(quote, Number(process.env.MAX_RENDER_CREDITS || 6));
    console.log(`Valid: true. Estimated credits: ${quote.creditsRequired}.`);
    if (mode === '--validate') { console.log('No render submitted. Run npm run render when ready.'); return; }
    run = { submittedAt: new Date().toISOString(), status: 'submission-attempted', creditsEstimated: quote.creditsRequired,
      requestSha256: createHash('sha256').update(JSON.stringify(request)).digest('hex') };
    await claimRun(run);
    await saveJson('out/request.json', request);
    const accepted = await zvid.renders.create(request);
    await saveJson('out/submission.json', accepted);
    if (!accepted.jobId) throw new Error('Submission returned no job ID. Check dashboard Renders before trying again.');
    run = { ...run, status: 'accepted', jobId: accepted.jobId, creditsReserved: accepted.creditsReserved };
    await saveJson('out/run.json', run);
    console.log(`Job: ${run.jobId}. Reserved credits: ${accepted.creditsReserved}.`);
  }
  const job = await trackJob(zvid, run.jobId, { save: value => saveJson('out/job.json', value) });
  await downloadVideo(outputUrl(job), 'out/first-json-video.mp4');
  console.log('Saved out/first-json-video.mp4');
}

main().catch(error => {
  console.error(error.message);
  if (error.status) console.error(`HTTP ${error.status}. Inspect out/ and the dashboard before resubmitting.`);
  process.exitCode = 1;
});
