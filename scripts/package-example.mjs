import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { root, checkExample, assertPublicText } from './check-examples.mjs';

const slug = process.argv[2];
assert.ok(process.argv.length === 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || ''), 'Usage: npm run package -- <example-slug>');
const folder = `examples/${slug}`;
const directory = path.join(root, folder);
const metadata = checkExample(directory);
const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', folder]), '', 'Commit example changes before packaging.');
const commit = git(['rev-parse', '--verify', 'HEAD^{commit}']);
const files = git(['ls-tree', '-r', '--name-only', `${commit}:${folder}`]).split('\n');
assert.ok(files.includes('README.md') && files.includes('LICENSE'));
for (const file of files) {
  assert.ok(!/(^|\/)(node_modules|out|output|\.git)(\/|$)/.test(file), `Private/generated archive path: ${file}`);
  assert.ok(!/(^|\/)\.env(?:\.|$)/.test(file) || path.basename(file) === '.env.example', `Environment file in archive: ${file}`);
  assertPublicText(git(['show', `${commit}:${folder}/${file}`]), file);
}
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const filename = `${slug}-example.zip`;
const archive = path.join(out, filename);
// Include the named folder so extracting the ZIP matches each article's steps.
execFileSync('git', ['-C', root, 'archive', '--format=zip', `--prefix=${slug}/`, `--output=${archive}`, `${commit}:${folder}`], { windowsHide: true });
const bytes = fs.readFileSync(archive);
const manifest = {
  id: slug, sourceCommit: commit,
  sourceUrl: `https://github.com/Zvid-io/blog-examples/tree/${commit}/${folder}`,
  articleUrl: metadata.articleUrl,
  filename, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  archiveRoot: `${slug}/`, files,
};
fs.writeFileSync(path.join(out, `${slug}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
