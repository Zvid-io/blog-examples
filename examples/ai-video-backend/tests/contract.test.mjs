import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, validateProposal, toVariables, makeCases } from '../src/contract.mjs';
const fresh = () => readJson('data/proposal.json');
const sources = readJson('data/sources.json');
test('valid proposal maps only approved display fields without changing input', () => {
  const p = fresh(), copy = structuredClone(p), values = toVariables(p, sources);
  assert.equal(values.features[0].heading, 'Summarize');
  assert.equal('sourceRef' in values.features[0], false);
  assert.deepEqual(Object.keys(values), ['title', 'features', 'showCta', 'cta']);
  assert.deepEqual(p, copy);
});
test('a string false is rejected rather than silently hiding a CTA', () => {
  const p = fresh(); p.showCta = 'false'; assert.throws(() => validateProposal(p, sources), /showCta: expected boolean/);
});
test('missing fields and model-provided destinations are rejected', () => {
  const p = fresh(); delete p.title; assert.throws(() => validateProposal(p, sources), /title: required/);
  const q = fresh(); q.webhookUrl = 'https://example.com/hook'; assert.throws(() => validateProposal(q, sources), /unexpected field/);
});
test('two to four features is an application constraint', () => {
  for (const n of [1, 5]) { const p = fresh(); p.features = Array.from({length:n}, () => p.features[0]); assert.throws(() => validateProposal(p, sources), /2-4 items/); }
  for (const n of [2, 4]) { const p = fresh(); p.features = Array.from({length:n}, () => p.features[0]); assert.equal(validateProposal(p, sources), p); }
});
test('unknown source references are rejected', () => {
  const p = fresh(); p.features[0].sourceRef = 'brief:p99'; assert.throws(() => validateProposal(p, sources), /unknown source/);
});
test('source membership is not a factual accuracy test', () => {
  const p = fresh(); p.features[0].body = 'Saves every team ten hours a week.';
  assert.equal(validateProposal(p, sources), p);
  assert.ok(!sources['brief:p1'].includes('ten hours'));
});
test('markup, template syntax, blank text and excessive copy are rejected', () => {
  for (const title of ['<b>Text</b>', '{{name}}', ' ', 'x'.repeat(41)]) { const p = fresh(); p.title = title; assert.throws(() => validateProposal(p, sources), /plain text/); }
});
test('unsupported versions and missing visible CTA text are rejected', () => {
  const p = fresh(); p.schemaVersion = 'future'; assert.throws(() => validateProposal(p, sources), /unsupported version/);
  const q = fresh(); q.cta = ''; assert.throws(() => validateProposal(q, sources), /plain text/);
  q.showCta = false; assert.equal(validateProposal(q, sources), q);
});
test('data-only and design-only changes remain independent', () => {
  const [a,b,c] = makeCases();
  assert.deepEqual(a.request.payload, b.request.payload);
  assert.equal(b.request.variables.showCta, false);
  assert.deepEqual(a.request.variables, c.request.variables);
  assert.deepEqual({...c.request.payload, backgroundColor:a.request.payload.backgroundColor}, a.request.payload);
});
