import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_ORIGIN } from '../lib/activity.mjs';

const token = process.env.ACTIVITY_ADMIN_TOKEN;
if (!token || token.length < 32) throw new Error('Set ACTIVITY_ADMIN_TOKEN (at least 32 characters) in the local environment.');
const url = new URL('/api/activity', SITE_ORIGIN);
// Optional ISO timestamps allow smaller exports if there are more than 10000 events.
if (process.argv[2]) url.searchParams.set('from', process.argv[2]);
if (process.argv[3]) url.searchParams.set('to', process.argv[3]);
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000), redirect: 'error',
});
if (!response.ok) throw new Error(`Export failed (${response.status}): ${await response.text()}`);
const data = await response.json();
if (data.schemaVersion !== 1 || !Array.isArray(data.events)) throw new Error('Unexpected export format');
const destination = path.resolve('private', 'activity.json');
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
console.log(`Saved ${data.summary.totalEvents} events (${data.summary.pageviews} pageviews): ${destination}`);
