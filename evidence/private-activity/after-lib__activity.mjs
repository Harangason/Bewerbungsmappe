import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const SITE_ORIGIN = 'https://application-martin-drexler.vercel.app';
const PREFIX = 'application:activity:';
const INDEX = `${PREFIX}index`;
const SECTIONS = new Set(['start', 'motivation', 'profil', 'kompetenzen', 'berufserfahrung', 'ausbildung', 'kenntnisse']);
const TARGETS = {
  pageview: new Set(['view']),
  language: new Set(['de', 'en']),
  print: new Set(['pdf']),
  contact: new Set(['email', 'phone', 'linkedin']),
  portfolio: new Set(['portfolio', 'project-1', 'project-2', 'project-4', 'project-5']),
  workflow: new Set(['problem', 'interfaces', 'constraints', 'concept', 'software', 'validation']),
};

// Clamp month ends: 31 January + 3 calendar months = 30 April, same UTC time.
export function shiftMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function normalizeEvent(body, now = new Date()) {
  if (!body || !Object.hasOwn(TARGETS, body.type) || !TARGETS[body.type].has(body.target)
    || !SECTIONS.has(body.section) || !['de', 'en'].includes(body.language)) return null;
  // Deliberately discard all additional properties, including URLs and identifiers.
  return { at: now.toISOString(), type: body.type, target: body.target, section: body.section, language: body.language };
}

export function authorized(header, token) {
  if (typeof token !== 'string' || token.length < 32 || typeof header !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(header).digest(),
    createHash('sha256').update(`Bearer ${token}`).digest());
}

const RECORD_SCRIPT = `
local count = redis.call('INCR', KEYS[3])
if count == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if count > 2000 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PXAT', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[3], KEYS[1])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[4])
local ttl = redis.call('PTTL', KEYS[2])
if ttl < 0 then
  redis.call('PEXPIREAT', KEYS[2], ARGV[2])
else
  redis.call('PEXPIREAT', KEYS[2], ARGV[2], 'GT')
end
return 1`;

export function createActivityStore(env = process.env, fetcher = fetch) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw new Error('Activity storage is not configured');
  const endpoint = new URL(url);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid storage URL');

  async function command(args) {
    const response = await fetcher(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Activity storage request failed');
    const data = await response.json();
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('Activity storage command failed');
    return data.result;
  }

  return {
    async record(event) {
      const now = new Date(event.at);
      const expiry = shiftMonths(now, 3).getTime();
      const key = `${PREFIX}event:${randomUUID()}`;
      // One atomic operation; JSON values expire even if no one visits again.
      return await command(['EVAL', RECORD_SCRIPT, 3, key, INDEX, `${PREFIX}rate`,
        JSON.stringify(event), expiry, now.getTime(), shiftMonths(now, -3).getTime()]) === 1;
    },
    async read(now, from, to) {
      const keys = await command(['ZRANGEBYSCORE', INDEX, from.getTime(), to.getTime(), 'LIMIT', 0, 10001]);
      if (keys.length > 10000) return null;
      const events = [];
      for (let offset = 0; offset < keys.length; offset += 250) {
        const values = await command(['MGET', ...keys.slice(offset, offset + 250)]);
        for (const value of values) {
          if (!value) continue;
          const event = JSON.parse(value);
          if (shiftMonths(new Date(event.at), 3) > now) events.push(event);
        }
      }
      return events.sort((a, b) => a.at.localeCompare(b.at));
    },
  };
}

export function summarize(events) {
  const result = { totalEvents: events.length, pageviews: 0, byDay: {}, byType: {}, bySection: {} };
  for (const event of events) {
    if (event.type === 'pageview') result.pageviews++;
    for (const [group, key] of [['byDay', event.at.slice(0, 10)], ['byType', event.type], ['bySection', event.section]]) {
      result[group][key] = (result[group][key] || 0) + 1;
    }
  }
  return result;
}

export function createActivityHandler({ env = process.env, store, clock = () => new Date() } = {}) {
  return async function handle(request) {
    const headers = {
      'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    };
    const json = (status, body, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
    if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
    if (request.method === 'GET' && !authorized(request.headers.get('authorization'), env.ACTIVITY_ADMIN_TOKEN)) {
      return json(401, { error: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
    }
    if (env.VERCEL_ENV !== 'production' || env.ACTIVITY_ENABLED !== 'true') return json(503, { error: 'Activity is disabled' });
    const now = clock();
    let event;
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== SITE_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site') {
        return json(403, { error: 'Forbidden' });
      }
      if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'JSON required' });
      // Bound the streamed body too, rather than trusting Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: 'Invalid event' });
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) { await reader.cancel(); return json(413, { error: 'Event too large' }); }
        chunks.push(Buffer.from(value));
      }
      try { event = normalizeEvent(JSON.parse(Buffer.concat(chunks).toString('utf8')), now); } catch { /* Invalid JSON. */ }
      if (!event) return json(400, { error: 'Invalid event' });
    }
    try {
      const storage = store ?? createActivityStore(env);
      if (event) {
        if (!await storage.record(event)) return json(429, { error: 'Rate limit exceeded' }, { 'Retry-After': '60' });
        return new Response(null, { status: 204, headers });
      }
      const url = new URL(request.url);
      const lowerBound = shiftMonths(now, -3);
      const from = url.searchParams.has('from') ? new Date(url.searchParams.get('from')) : lowerBound;
      const to = url.searchParams.has('to') ? new Date(url.searchParams.get('to')) : now;
      if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to) return json(400, { error: 'Invalid date range' });
      const start = new Date(Math.max(+from, +lowerBound));
      const end = new Date(Math.min(+to, +now));
      const events = start > end ? [] : await storage.read(now, start, end);
      if (events === null) return json(413, { error: 'More than 10000 events. Export smaller ranges using from/to (ISO timestamps).' });
      return json(200, {
        schemaVersion: 1, generatedAt: now.toISOString(), retentionMonths: 3,
        from: start.toISOString(), to: end.toISOString(), summary: summarize(events), events,
      }, { 'Content-Disposition': 'attachment; filename="activity.json"' });
    } catch {
      console.error('Private activity storage unavailable');
      return json(503, { error: 'Activity storage unavailable' });
    }
  };
}
