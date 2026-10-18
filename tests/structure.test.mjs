import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicText } from '../scripts/check-examples.mjs';

test('publication checks reject credentials and signed URLs without printing their values', () => {
  const examples = ['zvid_' + 'a'.repeat(40), 'ghp_' + 'a'.repeat(40),
    'https://user:password@example.test/file',
    'https://cdn.example.test/file?X-Amz-Signature=' + 'a'.repeat(64)];
  for (const value of examples) {
    assert.throws(() => assertPublicText(value, 'fixture'), error =>
      error.message.includes('Potential private') && !error.message.includes(value));
  }
});

test('public CDN addresses and empty configuration examples are allowed', () => {
  assertPublicText('ZVID_API_KEY=\nMAX_RENDER_CREDITS=8\nhttps://cdn.zvid.io/blog/example/project.json', 'fixture');
});
