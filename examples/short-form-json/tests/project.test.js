import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProject } from '../src/project.js';
const sample = JSON.parse(await readFile(new URL('../data/content.json', import.meta.url)));

test('three input beats become ordered 4-second scenes on one portrait canvas', () => {
  const p = buildProject(sample);
  assert.equal(p.width / p.height, 9 / 16);
  assert.equal(p.scenes.reduce((n,s)=>n+s.duration,0),12);
  assert.deepEqual(p.scenes.map(s=>s.visuals[2].text),sample.beats.map(b=>b.title));
  assert.equal(new Set(p.scenes.map(s=>s.id)).size,3);
  for(const scene of p.scenes) for(const v of scene.visuals) {
    assert.ok(v.x >= 120 && v.x + v.width <= 900);
    assert.ok(v.y >= 380 && v.y + v.height <= 1520);
  }
});
test('copy and timing can change without mutating the source record or canvas', () => {
  const changed = structuredClone(sample);changed.beats[0].title='Plan one useful video';changed.secondsPerScene=5;
  const p=buildProject(changed);
  assert.equal(p.scenes[0].visuals[2].text,'Plan one useful video');
  assert.equal(p.scenes.reduce((n,s)=>n+s.duration,0),15);
  assert.equal(sample.secondsPerScene,4);
});
test('example rules reject missing beats, oversized text, markup and invalid timing', () => {
  for(const mutate of [c=>c.beats.pop(),c=>c.beats[0].title='x'.repeat(41),c=>c.beats[0].title='<b>Hello</b>',c=>c.secondsPerScene=NaN,c=>c.secondsPerScene=2,c=>c.series='']) {
    const c=structuredClone(sample);mutate(c);assert.throws(()=>buildProject(c));
  }
});
