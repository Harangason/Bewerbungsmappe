import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = '127.0.0.1';
const port = 25001;
const allowedHosts = new Set([`localhost:${port}`, `${host}:${port}`]);
const assets = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/motivation', ['index.html', 'text/html']], ['/motivation/', ['index.html', 'text/html']],
  ['/styles.css', ['cv.css', 'text/css']], ['/app.js', ['cv.js', 'text/javascript']],
]);

const handler = async (req, res) => {
  if (!allowedHosts.has(req.headers.host ?? '')) {
    res.writeHead(403).end('Unzulässiger Host'); return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/health') {
      const body = JSON.stringify({ status: 'ok', app: 'Martin-Drexler-Portfolio', port, addresses: [host] });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const asset = assets.get(url.pathname);
    if (!asset) { res.writeHead(404).end('Nicht gefunden'); return; }
    const body = await readFile(path.join(root, 'dist', asset[0]));
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error.message); res.writeHead(500).end('Die Portfolio-Seite konnte nicht geladen werden.');
  }
};

const server = http.createServer(handler);
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 25001 ist bereits belegt.' : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Martin-Drexler-Portfolio läuft auf http://localhost:${port}`);
});
