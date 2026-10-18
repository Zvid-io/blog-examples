import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

export const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function verify(rawBody, timestamp, signature, secret, now = Date.now() / 1000) {
  if (!secret || !Buffer.isBuffer(rawBody) || !/^\d{1,12}$/.test(timestamp || '') ||
      !Number.isSafeInteger(Number(timestamp)) || Math.abs(now - Number(timestamp)) > 300 ||
      !/^sha256=[0-9a-f]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.').update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function httpsUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
}

export function validateEvent(event, headers) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !['render.completed', 'render.failed'].includes(event.event) || !JOB_ID.test(event.jobId || '') ||
      typeof event.timestamp !== 'string' || !Number.isFinite(Date.parse(event.timestamp)) ||
      !event.data || typeof event.data !== 'object' || Array.isArray(event.data) ||
      (event.test !== undefined && typeof event.test !== 'boolean')) throw new Error('invalid event envelope');
  // Event and job headers are useful consistency checks. Their bytes are not part of the HMAC.
  if (headers['x-zvid-event'] !== event.event ||
      (headers['x-zvid-job-id'] && headers['x-zvid-job-id'] !== event.jobId) ||
      (!event.test && !headers['x-zvid-job-id'])) throw new Error('event headers do not match body');
  if (!/^\d{1,40}$/.test(headers['x-zvid-delivery-id'] || '')) throw new Error('invalid delivery id');
  if (event.event === 'render.completed') {
    if (event.data.status !== 'completed' || !httpsUrl(event.data.url)) throw new Error('invalid completion data');
  } else if (event.data.status !== 'failed' || typeof event.data.error !== 'string') {
    throw new Error('invalid failure data');
  }
  return event;
}

export function receiver({ store, secret, maxBytes = 1_048_576 }) {
  if (!secret) throw new Error('Set ZVID_WEBHOOK_SECRET before starting the receiver');
  return createServer({ requestTimeout: 8000, headersTimeout: 8000 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST' || req.url !== '/hooks/zvid') { res.writeHead(404).end(); return; }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '') ||
        (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
      res.writeHead(415).end(); return;
    }
    const chunks = []; let bytes = 0;
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > maxBytes) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      if (!verify(raw, req.headers['x-zvid-timestamp'], req.headers['x-zvid-signature'], secret)) {
        res.writeHead(401).end(); return;
      }
      let event;
      try { event = validateEvent(JSON.parse(raw.toString('utf8')), req.headers); }
      catch { res.writeHead(400).end(); return; }
      try { store.accept(req.headers['x-zvid-delivery-id'], raw, event); }
      catch (error) { res.writeHead(error.code === 'DELIVERY_COLLISION' ? 409 : 503).end(); return; }
      // accept() commits to disk before returning. No external business actions run here.
      res.writeHead(204).end();
    } catch { if (!res.headersSent) res.writeHead(400).end(); }
  });
}
