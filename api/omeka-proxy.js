const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://FarisGue.github.io',
];
const ALLOWED_RESOURCES = new Set([
  'items',
  'resource_classes',
  'properties',
  'resource_templates',
  'vocabularies',
]);
const OMITTED_PARAMETERS = new Set(['resource', 'key_identity', 'key_credential']);
const OMEKA_API_BASE = 'https://humanum-p8.fr/omk_artificialinquiries/api/';

function sendJson(res, status, body) {
  return res.status(status).json(body);
}

module.exports = async function omekaProxy(req, res) {
  const origin = req.headers.origin;
  const originAllowed = typeof origin === 'string'
    && allowedOrigins.some(allowedOrigin => new URL(allowedOrigin).origin === origin);

  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Omeka-S-Total-Results, Link');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed) return sendJson(res, 403, { error: 'origin_not_allowed' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const requestUrl = new URL(req.url, 'https://artificialinquiries-2b.vercel.app');
  const resource = requestUrl.searchParams.get('resource');
  if (!ALLOWED_RESOURCES.has(resource)) return sendJson(res, 400, { error: 'invalid_resource' });

  const target = new URL(resource, OMEKA_API_BASE);
  for (const [name, value] of requestUrl.searchParams) {
    if (!OMITTED_PARAMETERS.has(name.toLowerCase())) target.searchParams.append(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/ld+json' },
      cache: 'no-store',
      redirect: 'error',
    });
    const raw = await upstream.text();
    if (!upstream.ok) return sendJson(res, upstream.status, { error: 'common_omeka_request_failed' });

    try { JSON.parse(raw); }
    catch { return sendJson(res, 502, { error: 'invalid_upstream_response' }); }

    for (const name of ['Content-Type', 'Omeka-S-Total-Results', 'Link']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    return res.status(upstream.status).send(raw);
  } catch {
    return sendJson(res, 502, { error: 'common_omeka_unavailable' });
  }
};
