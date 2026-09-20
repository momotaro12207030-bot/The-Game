import { buildRequest, cleanTelemetry } from '../director.mjs';

const buckets = globalThis.__afterlightBuckets || (globalThis.__afterlightBuckets = new Map());

function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(status).json(data);
}

function header(req, name) {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : String(v || '');
}

function clientKey(req) {
  const fwd = header(req, 'x-forwarded-for').split(',')[0].trim();
  return fwd || header(req, 'x-real-ip') || 'unknown';
}

function sameToken(a, b) {
  if (!b) return true;
  if (typeof a !== 'string' || a.length > 512 || b.length < 16 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function allow(req) {
  const now = Date.now();
  const key = clientKey(req);
  const hour = 60 * 60 * 1000;
  const old = buckets.get(key) || [];
  const recent = old.filter(t => now - t < hour);
  if (recent.length && now - recent.at(-1) < 5500) return false;
  if (recent.length >= 180) return false;
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v.at(-1) > hour) buckets.delete(k);
    }
  }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  if (!process.env.TYPESAFE_API_KEY) {
    return send(res, 503, { error: 'typesafe_api_key_missing' });
  }
  if (!sameToken(header(req, 'x-game-token'), process.env.JEV_GAME_TOKEN || '')) {
    return send(res, 401, { error: 'invalid_game_token' });
  }

  const len = Number(header(req, 'content-length') || 0);
  if (Number.isFinite(len) && len > 8000) return send(res, 413, { error: 'request_too_large' });

  let body;
  try { body = await readBody(req); }
  catch { return send(res, 400, { error: 'invalid_json' }); }

  if (!body || !body.telemetry || typeof body.telemetry !== 'object' || Array.isArray(body.telemetry)) {
    return send(res, 400, { error: 'invalid_telemetry' });
  }
  if (!allow(req)) return send(res, 429, { error: 'rate_limited' });

  const telemetry = cleanTelemetry(body.telemetry);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5500);

  try {
    const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildRequest(telemetry)),
      signal: ctrl.signal
    });

    let raw = null;
    try { raw = await upstream.json(); } catch {}

    if (!upstream.ok) {
      const status = [401, 403, 429].includes(upstream.status) ? upstream.status : 502;
      return send(res, status, { error: 'provider_rejected_request', provider_status: upstream.status });
    }
    if (!raw || !raw.answers || typeof raw.answers !== 'object') {
      return send(res, 502, { error: 'invalid_provider_response' });
    }

    return send(res, 200, { model: raw.model, answers: raw.answers, usage: raw.usage });
  } catch (err) {
    const timeout = err?.name === 'AbortError';
    return send(res, timeout ? 504 : 502, {
      error: timeout ? 'provider_timeout' : 'provider_unavailable'
    });
  } finally {
    clearTimeout(timer);
  }
}
