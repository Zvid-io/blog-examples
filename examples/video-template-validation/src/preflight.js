import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {saveJson} from './helpers.js';

const keys = ['title', 'items', 'showCta', 'cta'];
export function checkInput(v) {
  assert.ok(v && typeof v === 'object' && !Array.isArray(v), 'Variables must be an object.');
  assert.ok(Object.keys(v).every(key => keys.includes(key)), 'Unknown variable name.');
  const text = (value, max, field) => assert.ok(typeof value === 'string' && value.trim() && value.length <= max && !/[<>{}]/.test(value), `${field} must be nonempty plain text, at most ${max} characters.`);
  text(v.title, 64, 'title'); text(v.cta, 48, 'cta');
  assert.equal(typeof v.showCta, 'boolean', 'showCta must be a Boolean, not a string.');
  assert.ok(Array.isArray(v.items) && v.items.length <= 3, 'items must be an array of at most three entries.');
  for (const item of v.items) {
    assert.ok(item && typeof item === 'object' && !Array.isArray(item), 'Each item must be an object.');
    assert.ok(Object.keys(item).every(key => ['label', 'value'].includes(key)), 'Unknown item field.');
    text(item.label, 28, 'item.label'); text(item.value, 20, 'item.value');
  }
}

// Compare structure AND content. A valid default can hide a renamed placeholder.
export function checkResolved(project, fixture, stats) {
  const {variables: v, expected} = fixture;
  assert.equal(project.scenes?.length, expected.sceneCount, `${fixture.name}: scene count changed.`);
  assert.ok(Math.abs(project.duration - expected.duration) < 0.001, `${fixture.name}: duration changed.`);
  if (stats) {
    assert.equal(stats.sceneCount, expected.sceneCount, `${fixture.name}: preview stats disagree.`);
    assert.ok(Math.abs(stats.totalDuration - expected.duration) < 0.001, `${fixture.name}: stats duration changed.`);
  }
  const ids = ['intro', ...v.items.map((_, i) => `status-${i + 1}`), ...(v.showCta ? ['cta'] : [])];
  assert.deepEqual(project.scenes.map(s => s.id), ids, `${fixture.name}: order or condition changed.`);
  const sceneText = scene => scene.visuals.filter(e => e.type === 'TEXT').map(e => e.text);
  assert.ok(sceneText(project.scenes[0]).includes(v.title), `${fixture.name}: title is wrong.`);
  v.items.forEach((item, index) => assert.deepEqual(sceneText(project.scenes[index + 1]), [item.label, item.value], `${fixture.name}: status content changed.`));
  if (v.showCta) assert.ok(sceneText(project.scenes.at(-1)).includes(v.cta), `${fixture.name}: CTA is wrong.`);
  assert.ok(!JSON.stringify(project).includes('{{'), `${fixture.name}: unresolved placeholder.`);
}

export function stableHash(value) {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export async function runMatrix(api, template, fixtures, {save = saveJson, log = console.log} = {}) {
  const summary = [];
  let representative;
  for (const fixture of fixtures) {
    const prefix = `out/${fixture.name}`;
    if (fixture.rejectAt === 'input') {
      assert.throws(() => checkInput(fixture.variables), new RegExp(fixture.expectedError));
      summary.push({name:fixture.name, result:'rejected as expected', stage:'input'});
      log(`PASS ${fixture.name}: rejected by sample input rules`);
      continue;
    }
    if (fixture.rejectAt === 'api') {
      // Deliberate diagnostic bypass; normal inputs always pass checkInput first.
      let error;
      try { await api.authoring.validate({payload:template, variables:fixture.variables}); } catch (e) { error = e; }
      assert.equal(error?.status, 400, `${fixture.name}: expected HTTP 400, not a successful preview or a network/auth error.`);
      assert.equal(error.body?.error, 'Template resolution failed');
      assert.ok(error.body.details?.some(d => d.field.includes(fixture.expectedField)), `${fixture.name}: unexpected error field.`);
      await save(prefix + '-error.json', error.body);
      summary.push({name:fixture.name, result:'rejected as expected', stage:'api'});
      log(`PASS ${fixture.name}: HTTP 400 with field details`);
      continue;
    }
    checkInput(fixture.variables);
    const quote = await api.authoring.validate({payload:template, variables:fixture.variables});
    await save(prefix + '-validation.json', quote);
    assert.equal(quote.valid, true, `${fixture.name}: validation failed.`);
    assert.ok(Array.isArray(quote.warnings), `${fixture.name}: missing warning list.`);
    assert.equal(quote.warnings.length, 0, `${fixture.name}: inspect the saved validation warnings.`);
    assert.ok(Number.isFinite(quote.creditsRequired) && quote.creditsRequired > 0, `${fixture.name}: missing credit estimate.`);
    checkResolved(quote.payload, fixture);
    const row = {name:fixture.name, result:'passed', sceneCount:quote.payload.scenes.length, duration:quote.payload.duration, creditsRequired:quote.creditsRequired, warnings:0};
    summary.push(row);
    log(`PASS ${fixture.name}: ${row.sceneCount} scenes, ${row.duration}s, 0 warnings`);
    if (fixture.name === 'representative') representative = {request:{payload:quote.payload}, quote};
  }
  assert.ok(representative, 'Missing representative fixture.');
  await save('out/matrix.json', summary);
  return representative;
}
