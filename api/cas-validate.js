const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://farisgue.github.io',
]);
const ALLOWED_SERVICES = new Set([
  'http://127.0.0.1:5500/cas-callback.html',
  'https://FarisGue.github.io/ArtificialInquiries_2.b/cas-callback.html',
]);
const DEFAULT_CAS_SERVER_URL = 'https://cas.univ-paris8.fr/cas';
const DEFAULT_CAS_SERVICE_URL = 'https://FarisGue.github.io/ArtificialInquiries_2.b/cas-callback.html';

function sendJson(res, status, body) {
  return res.status(status).json(body);
}
function decodeXml(value) {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/gi, (entity, decimal, hex) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity.toLowerCase()] || entity;
  });
}
function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<cas:${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/cas:${tag}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]*>/g, '').trim()) : '';
}
function parseCasSuccess(xml) {
  if (typeof xml !== 'string' || xml.length > 200000 || !/<cas:authenticationSuccess\b/i.test(xml)) return null;
  const user = tagValue(xml, 'user');
  if (!user || user.length > 512) return null;
  const attributes = {};
  const block = xml.match(/<cas:attributes(?:\s[^>]*)?>([\s\S]*?)<\/cas:attributes>/i)?.[1] || '';
  const pattern = /<cas:([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/cas:\1>/gi;
  for (const match of block.matchAll(pattern)) {
    const value = decodeXml(match[2].replace(/<[^>]*>/g, '').trim());
    if (!value || value.length > 2048) continue;
    if (Object.prototype.hasOwnProperty.call(attributes, match[1])) attributes[match[1]] = [].concat(attributes[match[1]], value);
    else attributes[match[1]] = value;
  }
  return { user, attributes };
}
function configuredCasServer() {
  const raw = typeof process.env.CAS_SERVER_URL === 'string' && process.env.CAS_SERVER_URL.trim()
    ? process.env.CAS_SERVER_URL.trim()
    : DEFAULT_CAS_SERVER_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
    return url;
  } catch { return null; }
}

module.exports = async function casValidate(req, res) {
  const origin = req.headers.origin;
  const originAllowed = ALLOWED_ORIGINS.has(origin);
  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed) return sendJson(res, 403, { error: 'origin_not_allowed' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return sendJson(res, 400, { error: 'invalid_request' }); }
  }
  const ticket = typeof body?.ticket === 'string' ? body.ticket.trim() : '';
  const service = typeof body?.service === 'string' ? body.service : '';
  const configuredServices = typeof process.env.CAS_SERVICE_URL === 'string' && process.env.CAS_SERVICE_URL.trim()
    ? process.env.CAS_SERVICE_URL.split(',').map(value => value.trim()).filter(Boolean)
    : [DEFAULT_CAS_SERVICE_URL];
  if (!ticket || ticket.length > 4096 || !/^ST-[A-Za-z0-9._~-]+$/.test(ticket) || !ALLOWED_SERVICES.has(service)
    || configuredServices.some(value => !ALLOWED_SERVICES.has(value))
    || (configuredServices.length && !configuredServices.includes(service))) {
    return sendJson(res, 400, { error: 'invalid_request' });
  }
  const server = configuredCasServer();
  if (!server) return sendJson(res, 503, { error: 'cas_not_configured' });

  const validationUrl = new URL('serviceValidate', server);
  validationUrl.searchParams.set('ticket', ticket);
  validationUrl.searchParams.set('service', service);
  try {
    const upstream = await fetch(validationUrl, { method: 'GET', headers: { Accept: 'application/xml, text/xml' }, cache: 'no-store', redirect: 'error' });
    const xml = await upstream.text();
    const result = upstream.ok ? parseCasSuccess(xml) : null;
    if (!result) return sendJson(res, 401, { authenticated: false, error: 'invalid_ticket' });
    return sendJson(res, 200, { authenticated: true, user: result.user, attributes: result.attributes });
  } catch {
    return sendJson(res, 502, { error: 'cas_validation_unavailable' });
  }
};

