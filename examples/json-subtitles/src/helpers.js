import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export const saveJson = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export function buildRequest(project, captions) {
  if (!Array.isArray(captions) || !captions.length) throw new Error('captions.json must contain at least one caption.');
  let previousEnd = 0;
  for (const [index, caption] of captions.entries()) {
    const { start, end, text } = caption;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.duration)
      throw new Error(`Caption ${index + 1}: use seconds with 0 <= start < end <= ${project.duration}.`);
    if (start < previousEnd) throw new Error(`Caption ${index + 1}: captions must be ordered and must not overlap in this example.`);
    if (typeof text !== 'string' || !text.trim()) throw new Error(`Caption ${index + 1}: text is required.`);
    previousEnd = end;
  }
  if (project.subtitle?.src) throw new Error('Remove subtitle.src when using captions.json.');
  return { payload: { ...project, subtitle: { ...project.subtitle, captions } } };
}

export function checkQuote(quote, maximum) {
  if (!quote.valid) throw new Error(`Validation failed: ${JSON.stringify(quote.details || quote.errors || quote.message || quote.error)}`);
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error('MAX_RENDER_CREDITS must be a positive number.');
  if (!Number.isFinite(quote.creditsRequired)) throw new Error('Validation did not return a credit estimate.');
  if (quote.creditsRequired > maximum) throw new Error(`Estimate ${quote.creditsRequired} exceeds MAX_RENDER_CREDITS=${maximum}.`);
  if (quote.warnings?.length) throw new Error('Read out/validation.json and resolve its warnings before rendering.');
}

export function outputUrl(job) {
  if (job.state === 'failed') throw new Error(`Render failed: ${job.failedReason || 'See out/job.json.'}`);
  if (job.state !== 'completed') throw new Error('The video is not complete yet.');
  if (job.outputExpiredAt || (job.outputExpiresAt && Date.parse(job.outputExpiresAt) <= Date.now())) throw new Error('The hosted output has expired.');
  const url = typeof job.result === 'string' ? job.result : job.result?.url;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Completed job has no HTTPS output URL. Keep the job ID for support.');
  return url;
}

// Bound each API request, including a stalled response body. Do not retry submissions.
export function timedFetch(url, init = {}) {
  return fetch(url, { ...init, signal: init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000) });
}

export async function trackJob(client, jobId, { timeoutMs = 600_000, intervalMs = 2_000, save = async () => {}, log = console.log } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await client.jobs.get(jobId, { signal: AbortSignal.timeout(Math.max(1, Math.min(30_000, deadline - Date.now()))) });
    await save(job);
    const progress = typeof job.progress === 'number' ? job.progress : job.progress?.percentage;
    log(`State: ${job.state}${Number.isFinite(progress) ? ` (${progress}%)` : ''}`);
    if (job.state === 'failed' || job.state === 'completed') { outputUrl(job); return job; }
    await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new Error('Stopped waiting after 10 minutes. Run npm run resume to track the same job.');
}

export async function downloadVideo(url, destination, fetcher = fetch) {
  // The API key belongs on Zvid API requests only. Never forward it to media hosts.
  const response = await fetcher(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Video download failed (HTTP ${response.status}). Run npm run resume.`);
  if (!(response.headers.get('content-type') || '').includes('video/')) throw new Error('Download did not return video media.');
  const temporary = destination + '.part';
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, destination);
}

export async function readRun() {
  try { return await readJson('out/run.json'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function prepareOutput() { await mkdir('out', { recursive: true }); }
