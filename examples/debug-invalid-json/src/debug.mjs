import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// This helper only calls the free validation endpoint. It never submits a render.
export function parseRequest(text) {
  let body;
  try { body = JSON.parse(text); }
  catch (error) { throw new Error('JSON syntax: ' + error.message); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request shape: expected a JSON object.');
  }
  const hasPayload = Object.hasOwn(body, 'payload');
  const hasTemplate = Object.hasOwn(body, 'template');
  if (hasPayload === hasTemplate) {
    throw new Error('Request shape: supply exactly one of payload or template.');
  }
  if (hasPayload && (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload))) {
    throw new Error('Request shape: payload must be an object.');
  }
  if (hasTemplate && (typeof body.template !== 'string' || !body.template.trim())) {
    throw new Error('Request shape: template must be a nonempty string.');
  }
  return body;
}

export async function validateText(text, {key, fetchImpl = fetch} = {}) {
  parseRequest(text);
  if (!key || key === 'YOUR_API_KEY') throw new Error('Set ZVID_API_KEY to your API key.');
  let response;
  try {
    response = await fetchImpl('https://api.zvid.io/api/render/validate/api-key', {
      method: 'POST', redirect: 'error',
      headers: {'Content-Type': 'application/json', 'x-api-key': key},
      body: text, signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error('Validation request did not complete. Check the connection and endpoint. No automatic retry was made.');
  }
  let raw;
  try { raw = await response.text(); }
  catch { throw new Error('Could not read the validation response. No automatic retry was made.'); }
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  const report = {
    httpStatus: response.status,
    contentType: response.headers.get('content-type'),
    requestId: response.headers.get('x-request-id') || response.headers.get('request-id'),
    response: data,
    ...(data === null ? {rawResponse: raw} : {}),
  };
  return {report, ok: response.ok && data?.valid === true};
}

export function summarize({report, ok}) {
  const data = report.response;
  const lines = ['HTTP ' + report.httpStatus, 'Content-Type: ' + (report.contentType || '(missing)')];
  if (report.requestId) lines.push('Request ID: ' + report.requestId);
  if (ok) {
    lines.push('Validation passed. No render job was created.',
      'Estimated render credits: ' + data.creditsRequired,
      'Warnings: ' + (data.warnings?.length ?? 0),
      'Inspect the resolved payload and warnings in out/validation-response.json.');
  } else if (data === null) {
    lines.push('The response was not JSON. Inspect the saved raw response privately before changing your request.');
  } else {
    lines.push('Validation did not pass. Inspect error, message and details in out/validation-response.json.');
  }
  return lines.join('\n');
}

export async function main(args = process.argv.slice(2)) {
  const files = args.filter(arg => !arg.startsWith('--'));
  if (files.length !== 1 || args.some(arg => arg.startsWith('--') && arg !== '--api')) {
    throw new Error('Usage: node debug.mjs request.json [--api]');
  }
  const text = await readFile(files[0], 'utf8');
  parseRequest(text);
  console.log('JSON syntax and request envelope: OK');
  if (!args.includes('--api')) {
    console.log('No API call made. Project fields and template values have not been validated.');
    return 0;
  }
  const result = await validateText(text, {key: process.env.ZVID_API_KEY});
  await mkdir('out', {recursive: true});
  await writeFile('out/validation-response.json', JSON.stringify(result.report, null, 2) + '\n');
  console.log(summarize(result));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
