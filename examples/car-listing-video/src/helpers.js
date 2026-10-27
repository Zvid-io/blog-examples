import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export const saveJson = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export function buildRequest(project, vehicle, hidePrice = false) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('project.json must contain a project object.');
  if ('payload' in project || 'template' in project) throw new Error('project.json contains a request envelope. Keep only the project in this file.');
  return { payload: structuredClone(project), variables: toVariables(vehicle, hidePrice) };
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

export async function readRun(file = 'out/run.json') {
  try { return await readJson(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function prepareOutput() { await mkdir('out', { recursive: true }); }

// Exclusive creation prevents two local processes from submitting the same run directory.
export async function claimRun(run, file = 'out/run.json') {
  await writeFile(file, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
}

// These are sample application rules, not universal Zvid field requirements.
export function toVariables(vehicle, hidePrice = false) {
  if (!vehicle || typeof vehicle !== 'object') throw new Error('vehicle.json must be an object.');
  for (const name of ['dealerName', 'vehicleName', 'stockNumber']) {
    if (typeof vehicle[name] !== 'string' || !vehicle[name].trim()) throw new Error(name + ' must be non-empty text.');
  }
  if (!Number.isSafeInteger(vehicle.mileage) || vehicle.mileage < 0) throw new Error('mileage must be a non-negative whole number.');
  if (typeof vehicle.showPrice !== 'boolean') throw new Error('showPrice must be a JSON boolean.');
  const showPrice = hidePrice ? false : vehicle.showPrice;
  if (showPrice && (!Number.isSafeInteger(vehicle.price) || vehicle.price < 0)) throw new Error('A shown price must be non-negative whole US dollars.');
  if (!Array.isArray(vehicle.photos) || !vehicle.photos.length) throw new Error('This example requires at least one photo.');
  for (const photo of vehicle.photos) {
    if (!photo || typeof photo.label !== 'string' || !photo.label.trim()) throw new Error('Every photo needs a label.');
    let url; try { url = new URL(photo.image); } catch { throw new Error('Every photo needs an HTTPS image URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Every photo needs a public HTTPS image URL without credentials.');
  }
  return {
    dealerName: vehicle.dealerName, vehicleName: vehicle.vehicleName, stockNumber: vehicle.stockNumber,
    mileage: new Intl.NumberFormat('en-US').format(vehicle.mileage) + ' miles',
    price: showPrice ? new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(vehicle.price) : '',
    showPrice, photoFront: vehicle.photos[0].image, photos: structuredClone(vehicle.photos)
  };
}

export async function submitOnce(client, request, run, directory) {
  await claimRun(run, directory + '/run.json');
  await saveJson(directory + '/request.json', request);
  // A timeout leaves the attempted marker in place. Never automatically retry this POST.
  const accepted = await client.renders.create(request);
  if (!accepted.jobId) throw new Error('Submission returned no job ID. Check dashboard Renders before trying again.');
  const saved = { ...run, status:'accepted', jobId:accepted.jobId, creditsReserved:accepted.creditsReserved };
  // Persist the ID before writing supplementary responses or polling.
  await saveJson(directory + '/run.json', saved);
  await saveJson(directory + '/submission.json', accepted);
  return saved;
}
