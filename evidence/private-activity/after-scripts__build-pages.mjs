import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function buildPages(outputDirectory = path.join(root, '_site')) {
  const outputRoot = path.resolve(outputDirectory);
  const sourceHtml = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
  const html = sourceHtml
    .replaceAll('href="/styles.css"', 'href="./styles.css"')
    .replaceAll('src="/app.js"', 'src="./app.js"')
    .replaceAll('src="/activity.js"', 'src="./activity.js"')
    .replaceAll('href="/motivation"', 'href="#motivation"')
    .replaceAll('data-local-page="/motivation"', 'data-local-page="./#motivation"')
    .replaceAll('href="/"', 'href="./"')
    .replaceAll('data-local-page="/"', 'data-local-page="./"')
    .replaceAll('href="/#', 'href="./#')
    .replaceAll('data-local-page="/#', 'data-local-page="./#');
  if (/(?:href|src|data-local-page)="\/(?!\/)/.test(html)) {
    throw new Error('A local URL still points outside the GitHub Pages project directory.');
  }
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, 'index.html'), html);
  await copyFile(path.join(root, 'dist', 'cv.css'), path.join(outputRoot, 'styles.css'));
  await copyFile(path.join(root, 'dist', 'cv.js'), path.join(outputRoot, 'app.js'));
  await copyFile(path.join(root, 'dist', 'activity.js'), path.join(outputRoot, 'activity.js'));
  return outputRoot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`GitHub Pages files ready: ${await buildPages(process.argv[2])}`);
}
