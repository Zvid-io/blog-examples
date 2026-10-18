import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { JOB_ID, httpsUrl } from './receiver.mjs';

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
    CREATE TABLE IF NOT EXISTS inbox (
      delivery_id TEXT PRIMARY KEY, digest TEXT NOT NULL, body TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT, problem TEXT);
    CREATE TABLE IF NOT EXISTS renders (
      job_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'waiting',
      output_url TEXT, error TEXT, resolved_by TEXT);
    CREATE TABLE IF NOT EXISTS outbox (
      action_key TEXT PRIMARY KEY, job_id TEXT NOT NULL, topic TEXT NOT NULL, body TEXT NOT NULL);
  `);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  // Called inside one transaction with either inbox acknowledgement or API reconciliation.
  function apply(jobId, state, outputUrl, error, resolvedBy) {
    const current = db.prepare('SELECT * FROM renders WHERE job_id=?').get(jobId);
    if (!current) throw new Error('job not tracked yet');
    if (['completed', 'failed'].includes(current.state)) {
      if (current.state !== state || (state === 'completed' && current.output_url !== outputUrl))
        throw new Error('conflicting terminal state; investigate job status');
      return false;
    }
    db.prepare('UPDATE renders SET state=?, output_url=?, error=?, resolved_by=? WHERE job_id=?')
      .run(state, outputUrl, error, resolvedBy, jobId);
    db.prepare('INSERT INTO outbox (action_key,job_id,topic,body) VALUES (?,?,?,?)')
      .run(`render:${jobId}:${state}`, jobId, `render.${state}`, JSON.stringify({
        sourceId: current.source_id, jobId, state, outputUrl, error,
      }));
    return true;
  }
  return {
    close: () => db.close(),
    track(jobId, sourceId) {
      if (!JOB_ID.test(jobId || '') || !sourceId || sourceId.length > 200) throw new Error('Supply a job UUID and source ID');
      transaction(() => {
        const row = db.prepare('SELECT source_id FROM renders WHERE job_id=?').get(jobId);
        if (row && row.source_id !== sourceId) throw new Error('job already belongs to another source');
        db.prepare('INSERT OR IGNORE INTO renders (job_id,source_id) VALUES (?,?)').run(jobId, sourceId);
      });
    },
    accept(deliveryId, raw, event) {
      const digest = createHash('sha256').update(raw).digest('hex');
      return transaction(() => {
        const row = db.prepare('SELECT digest FROM inbox WHERE delivery_id=?').get(deliveryId);
        if (row && row.digest !== digest) throw Object.assign(new Error('delivery id reused with another body'), {code:'DELIVERY_COLLISION'});
        if (!row) db.prepare('INSERT INTO inbox (delivery_id,digest,body) VALUES (?,?,?)')
          .run(deliveryId, digest, JSON.stringify(event));
        return !row;
      });
    },
    process() {
      const counts = { processed: 0, deferred: 0 };
      const rows = db.prepare('SELECT delivery_id,body FROM inbox WHERE processed_at IS NULL ORDER BY received_at,delivery_id LIMIT 100').all();
      for (const row of rows) {
        try {
          const didProcess = transaction(() => {
            if (db.prepare('SELECT processed_at FROM inbox WHERE delivery_id=?').get(row.delivery_id).processed_at) return false;
            const e = JSON.parse(row.body);
            if (!e.test) apply(e.jobId, e.data.status,
              e.event === 'render.completed' ? e.data.url : null,
              e.event === 'render.failed' ? e.data.error : null, 'webhook');
            db.prepare('UPDATE inbox SET processed_at=CURRENT_TIMESTAMP, problem=NULL WHERE delivery_id=?').run(row.delivery_id);
            return true;
          });
          if (didProcess) counts.processed++;
        } catch (error) {
          db.prepare('UPDATE inbox SET problem=? WHERE delivery_id=?').run(error.message, row.delivery_id);
          counts.deferred++;
        }
      }
      return counts;
    },
    reconcile(jobId, job) {
      if (job.id !== jobId) throw new Error('job API returned a different identity');
      if (!['completed','failed'].includes(job.state)) return false;
      const output = typeof job.result === 'string' ? job.result : job.result?.url;
      if (job.state === 'completed' && (!httpsUrl(output) || job.outputExpiredAt ||
          (job.outputExpiresAt && Date.parse(job.outputExpiresAt) <= Date.now())))
        throw new Error('completed output unavailable or expired; no ready action created');
      return transaction(() => apply(jobId, job.state, output || null,
        job.state === 'failed' ? String(job.failedReason || 'Render failed') : null, 'reconciliation'));
    },
    snapshot() {
      return {
        renders: db.prepare('SELECT * FROM renders ORDER BY job_id').all(),
        inbox: db.prepare('SELECT delivery_id,processed_at,problem FROM inbox ORDER BY delivery_id').all(),
        outbox: db.prepare('SELECT * FROM outbox ORDER BY action_key').all(),
      };
    },
  };
}
