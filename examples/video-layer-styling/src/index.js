import { ZvidClient } from '@zvid/sdk';
import { checkQuote, downloadVideo, outputUrl, prepareOutput, readJson, readRun, saveJson, timedFetch, trackJob } from './helpers.js';

async function main() {
  const mode = process.argv[2] || '--validate';
  if (!['--validate', '--render', '--resume'].includes(mode) || process.argv.length > 3)
    throw new Error('Use npm start, npm run render, or npm run resume.');
  if (!process.env.ZVID_API_KEY) throw new Error('Set ZVID_API_KEY in .env. Get a key at https://app.zvid.io/api-keys.');
  await prepareOutput();
  const zvid = new ZvidClient({ apiKey: process.env.ZVID_API_KEY, baseUrl: 'https://api.zvid.io', maxRetries: 0, fetch: timedFetch });
  let run = await readRun();

  if (mode === '--resume') {
    if (!run?.jobId) throw new Error('No saved job ID. Check the dashboard if an earlier submission had an uncertain outcome.');
  } else {
    const project = await readJson('data/project.json');
    const request = { payload: project };
    await saveJson('out/request.json', request);
    const quote = await zvid.authoring.validate(request);
    await saveJson('out/validation.json', quote);
    checkQuote(quote, Number(process.env.MAX_RENDER_CREDITS || 6));
    console.log(`Valid: true. Estimated credits: ${quote.creditsRequired}.`);
    if (mode === '--validate') { console.log('No render submitted. Run npm run render when ready.'); return; }
    if (run) throw new Error('A previous submission is recorded. Use npm run resume. For a deliberately new render, inspect and archive out/ first.');
    // Record the attempt BEFORE the paid POST. An interrupted/uncertain response must not cause an automatic second submission.
    run = { submittedAt: new Date().toISOString(), status: 'submission-attempted', creditsEstimated: quote.creditsRequired };
    await saveJson('out/run.json', run);
    const accepted = await zvid.renders.create(request);
    await saveJson('out/submission.json', accepted);
    if (!accepted.jobId) throw new Error('Submission returned no job ID. Check dashboard Renders before trying again.');
    run = { ...run, status: 'accepted', jobId: accepted.jobId, creditsReserved: accepted.creditsReserved };
    await saveJson('out/run.json', run);
    console.log(`Job: ${run.jobId}. Reserved credits: ${accepted.creditsReserved}.`);
  }

  const job = await trackJob(zvid, run.jobId, { save: value => saveJson('out/job.json', value) });
  await downloadVideo(outputUrl(job), 'out/comparison.mp4');
  console.log('Saved out/comparison.mp4');
}

main().catch(error => {
  console.error(error.message);
  if (error.status) console.error(`HTTP ${error.status}. Inspect out/ and the dashboard before resubmitting.`);
  process.exitCode = 1;
});
