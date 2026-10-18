import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const generated = new Set(['node_modules', 'out', 'output', '.git', 'dist']);
export function sourceFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), `Symlinks are not portable: ${prefix}${entry.name}`);
    if (generated.has(entry.name)) return [];
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') return [];
    const relative = prefix + entry.name;
    return entry.isDirectory() ? sourceFiles(path.join(directory, entry.name), relative + '/') : [relative];
  });
}

export function assertPublicText(text, file) {
  const patterns = [
    /zvid_[A-Za-z0-9]{24,}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /github_pat_[A-Za-z0-9_]{30,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /https?:\/\/[^\s/]+:[^\s/]+@/,
    /https?:\/\/[^\s"'<>]*(?:X-Amz-Signature|X-Amz-Credential)=/i,
  ];
  assert.ok(!patterns.some(pattern => pattern.test(text)), `Potential private credential or URL in ${file}`);
}

export function checkExample(directory) {
  const key = path.basename(directory);
  for (const file of ['README.md', 'example.json', 'package.json', 'package-lock.json', 'LICENSE', '.gitignore']) {
    assert.ok(fs.existsSync(path.join(directory, file)), `${key}: missing ${file}`);
  }
  const load = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  const metadata = load('example.json');
  assert.equal(metadata.id, key);
  assert.match(metadata.articleUrl, /^https:\/\/zvid\.io\/blog\/[a-z0-9-]+\/[a-z0-9-]+$/);
  assert.equal(metadata.runtime.minimumVersion, 22);
  const pkg = load('package.json');
  const lock = load('package-lock.json');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.ok(pkg.scripts.check && pkg.scripts.test);
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${key}: pin ${name} to an exact version`);
  }
  const files = sourceFiles(directory);
  assert.ok(files.some(file => /^tests\/.*\.test\.[cm]?js$/.test(file)), `${key}: missing behavior tests`);
  for (const file of files) {
    const size = fs.statSync(path.join(directory, file)).size;
    assert.ok(size < 1_000_000, `${key}/${file}: host large assets on the CDN`);
    assert.ok(!/\.(mp4|zip|png|jpg|jpeg|webp)$/i.test(file), `${key}/${file}: use a CDN asset URL`);
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    assertPublicText(text, `${key}/${file}`);
    if (file.endsWith('.json') && file !== 'fixtures/trailing-comma.json') JSON.parse(text);
    if (file === '.env.example') {
      for (const line of text.split(/\r?\n/).filter(line => line && !line.startsWith('#'))) {
        assert.match(line, /^(?:ZVID_API_KEY=|MAX_RENDER_CREDITS=\d+)$/, `${key}: unsafe environment example`);
      }
    }
  }
  return { id: key, files: files.length, articleUrl: metadata.articleUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const examples = fs.readdirSync(path.join(root, 'examples'), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => checkExample(path.join(root, 'examples', entry.name)));
  assert.ok(examples.length > 0);
  console.log(JSON.stringify({ examples }, null, 2));
}
