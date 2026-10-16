import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { authorized, createActivityHandler, createActivityStore, normalizeEvent, shiftMonths, SITE_ORIGIN } from '../lib/activity.mjs';

const now = new Date('2026-10-16T12:00:00.000Z');
const token = 'test-only-private-admin-token-32-characters';
const env = { ACTIVITY_ENABLED: 'true', VERCEL_ENV: 'production', ACTIVITY_ADMIN_TOKEN: token };
const payload = { type: 'pageview', target: 'view', section: 'profil', language: 'de' };
const stored = [];
function setup(storage = { record: async event => { stored.push(event); return true; }, read: async () => stored }) {
  return createActivityHandler({ env, store: storage, clock: () => now });
}
function post(body = payload, headers = {}) {
  return new Request(`${SITE_ORIGIN}/api/activity`, {
    method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function get(query = '', secret = token) {
  return new Request(`${SITE_ORIGIN}/api/activity${query}`, { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
}

test('calendar-month retention handles month ends, leap years and UTC precision', () => {
  for (const [date, expected] of [
    ['2026-01-31T12:34:56.123Z', '2026-04-30T12:34:56.123Z'],
    ['2025-11-30T12:34:56.123Z', '2026-02-28T12:34:56.123Z'],
    ['2023-11-30T12:34:56.123Z', '2024-02-29T12:34:56.123Z'],
    ['2026-10-16T12:00:00.000Z', '2027-01-16T12:00:00.000Z'],
  ]) assert.equal(shiftMonths(new Date(date), 3).toISOString(), expected);
  assert.equal(shiftMonths(now, -3).toISOString(), '2026-07-16T12:00:00.000Z');
});

test('event schema discards personal data and rejects arbitrary event values', () => {
  const normalized = normalizeEvent({ ...payload, ip: 'secret', url: 'secret', visitorId: 'secret', at: '1999' }, now);
  assert.deepEqual(normalized, { at: now.toISOString(), ...payload });
  for (const body of [null, {}, { ...payload, type: '__proto__' }, { ...payload, target: 'private text' },
    { ...payload, section: 'unknown' }, { ...payload, language: 'fr' }]) assert.equal(normalizeEvent(body, now), null);
});

test('export is private, fails closed without a strong token and is never cached', async () => {
  for (const secret of [null, 'wrong']) {
    const response = await setup()(get('', secret));
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(authorized(`Bearer ${token}`, undefined), false);
  assert.equal(authorized('Bearer short', 'short'), false);
  assert.equal(authorized(`Bearer ${token}`, token), true);
});

test('production event reaches private JSON export and its counters', async () => {
  stored.length = 0;
  const handler = setup();
  assert.equal((await handler(post())).status, 204);
  assert.equal((await handler(post({ type: 'print', target: 'pdf', section: 'profil', language: 'en' }))).status, 204);
  const response = await handler(get());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.retentionMonths, 3);
  assert.deepEqual(data.summary, {
    totalEvents: 2, pageviews: 1, byDay: { '2026-10-16': 2 }, byType: { pageview: 1, print: 1 }, bySection: { profil: 2 },
  });
  assert.match(response.headers.get('content-disposition'), /activity.json/);
});

test('rejects wrong origins, malformed/oversized events and unsupported methods', async () => {
  const handler = setup();
  assert.equal((await handler(post(payload, { Origin: 'https://attacker.invalid' }))).status, 403);
  assert.equal((await handler(post(payload, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal((await handler(post('bad JSON'))).status, 400);
  assert.equal((await handler(post({ ...payload, section: 'secret' }))).status, 400);
  assert.equal((await handler(post('x'.repeat(1025)))).status, 413);
  assert.equal((await handler(post(payload, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await handler(new Request(`${SITE_ORIGIN}/api/activity`, { method: 'DELETE' }))).status, 405);
});

test('disabled and preview deployments cannot record events; storage errors never expose details', async () => {
  for (const config of [{ ...env, ACTIVITY_ENABLED: undefined }, { ...env, VERCEL_ENV: 'preview' }]) {
    assert.equal((await createActivityHandler({ env: config })(post())).status, 503);
  }
  assert.equal((await setup({ record: async () => false })(post())).status, 429);
  const failing = setup({ record: async () => { throw new Error('private credential'); } });
  const response = await failing(post());
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private credential'), false);
});

test('export bounds cannot reach older data, and large results are never silently truncated', async () => {
  let bounds;
  const handler = setup({ read: async (...args) => { bounds = args; return []; } });
  assert.equal((await handler(get('?from=2000-01-01&to=2099-01-01'))).status, 200);
  assert.equal(bounds[1].toISOString(), '2026-07-16T12:00:00.000Z');
  assert.equal(bounds[2].toISOString(), now.toISOString());
  assert.equal((await handler(get('?from=invalid'))).status, 400);
  assert.equal((await handler(get('?from=2026-10-16&to=2026-10-01'))).status, 400);
  assert.equal((await setup({ read: async () => null })(get())).status, 413);
});

test('Redis stores JSON with an independent absolute expiry and excludes expired records from export', async () => {
  const commands = [];
  const fresh = normalizeEvent(payload, now);
  const expired = normalizeEvent(payload, new Date('2026-07-16T11:59:59Z'));
  const store = createActivityStore({ UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'server-secret' },
    async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer server-secret');
      const command = JSON.parse(options.body);
      commands.push(command);
      const result = command[0] === 'EVAL' ? 1 : command[0] === 'ZRANGEBYSCORE' ? ['key-1', 'key-2', 'key-3']
        : [JSON.stringify(fresh), JSON.stringify(expired), null];
      return Response.json({ result });
    });
  assert.equal(await store.record(fresh), true);
  const write = commands[0];
  assert.equal(write[0], 'EVAL');
  assert.match(write[1], /'PXAT'/);
  assert.match(write[1], /'PEXPIREAT'.*'GT'/);
  assert.deepEqual(JSON.parse(write[6]), fresh);
  assert.equal(write[7], +new Date('2027-01-16T12:00:00Z'));
  assert.deepEqual(await store.read(now, shiftMonths(now, -3), now), [fresh]);
  assert.throws(() => createActivityStore({}), /not configured/);
});

const clientSource = await readFile(new URL('../dist/activity.js', import.meta.url), 'utf8');
function browser({ origin = SITE_ORIGIN, exclude = false, privacy = false, blockedStorage = false } = {}) {
  const sent = [];
  const listeners = {};
  const location = { origin, pathname: '/', hash: '', href: `${origin}/?sensitive=secret` };
  const document = { documentElement: { lang: 'de' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = { location, document, URL, navigator: { doNotTrack: privacy ? '1' : '0' },
    localStorage: { getItem: () => { if (blockedStorage) throw new Error('denied'); return exclude ? 'true' : null; } },
    fetch: (url, options) => { sent.push({ url, ...JSON.parse(options.body) }); return Promise.resolve(); },
  };
  context.window = { location, addEventListener: (name, fn) => { listeners[name] = fn; } };
  vm.runInNewContext(clientSource, context);
  return { sent, listeners, location, document };
}

test('client records navigation and fixed click labels without URL queries or repeated section views', () => {
  const page = browser();
  assert.equal(page.sent.length, 1);
  page.location.hash = '#profil'; page.listeners.hashchange(); page.listeners.hashchange();
  assert.equal(page.sent.length, 2);
  assert.equal(page.sent[1].section, 'profil');
  page.listeners.click({ target: { closest: () => ({
    matches: selector => selector === '[data-language]', dataset: { language: 'en' },
  }) } });
  assert.equal(page.sent[2].type, 'language');
  assert.equal(page.sent[2].target, 'en');
  assert.equal(JSON.stringify(page.sent).includes('sensitive'), false);
  assert.equal(browser({ blockedStorage: true }).sent.length, 1);
});

test('client respects owner exclusion, privacy signals, local/preview hosts and GitHub Pages', () => {
  for (const options of [{ exclude: true }, { privacy: true }, { origin: 'http://localhost:25001' },
    { origin: 'https://harangason.github.io' }, { origin: 'https://preview.vercel.app' }]) {
    assert.equal(browser(options).sent.length, 0);
  }
});
