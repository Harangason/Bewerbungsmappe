import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildPages } from './build-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Pages publishes only the portfolio with links inside its project directory', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-pages-test-'));
  try {
    await buildPages(temporaryRoot);
    assert.deepEqual((await readdir(temporaryRoot)).sort(), ['activity.js', 'app.js', 'index.html', 'styles.css']);
    const html = await readFile(path.join(temporaryRoot, 'index.html'), 'utf8');
    const source = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
    for (const [, value] of html.matchAll(/(?:href|src|data-local-page)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|tel:|data:)/.test(value)) continue;
      const resolved = new URL(value, 'https://harangason.github.io/Bewerbungsmappe/');
      assert.ok(resolved.pathname.startsWith('/Bewerbungsmappe/'), `Escaping local link: ${value}`);
    }
    assert.ok(html.includes('href="#motivation"'));
    assert.ok(html.includes('href="./#profil"'));
    assert.ok(html.includes('data-local-page="./#profil"'));
    assert.ok(html.includes('src="./activity.js"'));
    assert.deepEqual(await readFile(path.join(temporaryRoot, 'activity.js')), await readFile(path.join(root, 'dist', 'activity.js')));
    assert.equal(html.match(/src="data:image\/jpeg;base64,[^"]+"/)[0], source.match(/src="data:image\/jpeg;base64,[^"]+"/)[0]);
    assert.deepEqual(await readFile(path.join(temporaryRoot, 'styles.css')), await readFile(path.join(root, 'dist', 'cv.css')));
    assert.deepEqual(await readFile(path.join(temporaryRoot, 'app.js')), await readFile(path.join(root, 'dist', 'cv.js')));
  } finally {
    if (path.dirname(temporaryRoot) !== path.resolve(os.tmpdir()) || !path.basename(temporaryRoot).startsWith('portfolio-pages-test-')) {
      throw new Error('Unexpected test-directory path; cleanup refused.');
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
