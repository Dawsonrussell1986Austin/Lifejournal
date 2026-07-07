// Shared, best-effort rate limiting for the AI endpoints (prompt/plan/today/
// study). Two layers guard the Anthropic key from a public web link:
//   1. Per-IP fixed window  — default 20 requests / 10 minutes per client
//   2. Per-day global ceiling — default 2000 requests / day as a cost backstop
//
// Backend selection is automatic:
//   • If a Vercel KV / Upstash Redis REST endpoint is configured
//     (KV_REST_API_URL + KV_REST_API_TOKEN, or the UPSTASH_* equivalents)
//     counters live in Redis, so limits hold ACROSS serverless instances.
//   • Otherwise counters live in memory — still stops a single warm instance
//     from being hammered, but resets on cold start and isn't shared between
//     concurrent instances. Provision KV for real durability.
//
// Tunable via env: RL_MAX_PER_WINDOW, RL_WINDOW_MIN, RL_DAILY_CEILING, RL_OFF.

const WINDOW_MS = (parseInt(process.env.RL_WINDOW_MIN, 10) || 10) * 60 * 1000;
const MAX_PER_WINDOW = parseInt(process.env.RL_MAX_PER_WINDOW, 10) || 20;
const DAILY_CEILING = parseInt(process.env.RL_DAILY_CEILING, 10) || 2000;

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const USE_KV = !!(KV_URL && KV_TOKEN);

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function dayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// ---- Durable backend (Upstash / Vercel KV REST) ---------------------------
// INCR the counter, and on the first hit set its TTL. Returns the new count.
async function kvIncr(key, ttlSec) {
  const r = await fetch(`${KV_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!r.ok) throw new Error('kv incr ' + r.status);
  const { result } = await r.json();
  if (result === 1) {
    // fire-and-forget expiry; a missed TTL just means the key lingers a bit
    fetch(`${KV_URL}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    }).catch(() => {});
  }
  return result;
}

// ---- In-memory backend ----------------------------------------------------
const mem = new Map(); // key -> { count, expires }

function memIncr(key, ttlSec) {
  const now = Date.now();
  // Opportunistic sweep so the map can't grow without bound.
  if (mem.size > 5000) {
    for (const [k, v] of mem) if (v.expires <= now) mem.delete(k);
  }
  const cur = mem.get(key);
  if (!cur || cur.expires <= now) {
    mem.set(key, { count: 1, expires: now + ttlSec * 1000 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

async function bump(key, ttlSec) {
  if (USE_KV) {
    try { return await kvIncr(key, ttlSec); }
    catch (e) { return memIncr(key, ttlSec); } // degrade to in-memory on KV error
  }
  return memIncr(key, ttlSec);
}

// Returns { ok: true } or { ok: false, status, retryAfter, error }.
async function checkLimit(req) {
  if (String(process.env.RL_OFF || '') === '1') return { ok: true };

  const windowIdx = Math.floor(Date.now() / WINDOW_MS);
  const ip = clientIp(req);

  const ipCount = await bump(`rl:ip:${ip}:${windowIdx}`, Math.ceil(WINDOW_MS / 1000));
  if (ipCount > MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
    return { ok: false, status: 429, retryAfter, error: 'Too many requests — please slow down and try again shortly.' };
  }

  const dayCount = await bump(`rl:day:${dayKey()}`, 60 * 60 * 26);
  if (dayCount > DAILY_CEILING) {
    return { ok: false, status: 429, retryAfter: 3600, error: 'Daily limit reached for this service. Please try again tomorrow.' };
  }

  return { ok: true };
}

// Convenience guard for handlers: applies limit + writes the 429 response.
// Returns true if the caller should STOP (a response was already sent).
async function limited(req, res) {
  const v = await checkLimit(req);
  if (v.ok) return false;
  if (v.retryAfter) res.setHeader('Retry-After', String(v.retryAfter));
  res.status(v.status).json({ error: v.error });
  return true;
}

module.exports = { checkLimit, limited, clientIp };
