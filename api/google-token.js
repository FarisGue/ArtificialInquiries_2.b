const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://FarisGue.github.io',
];
const ALLOWED_REDIRECTS = new Set([
  'http://127.0.0.1:5500/google-callback.html',
  'https://FarisGue.github.io/ArtificialInquiries_2.b/google-callback.html',
]);

function sendJson(response, status, body) {
  response.status(status).json(body);
}

module.exports = async function googleToken(req, res) {
  const origin = req.headers.origin;
  // URL parsing normalizes DNS casing, while preserving the explicit allowlist above.
  const originAllowed = typeof origin === 'string'
    && allowedOrigins.some(allowedOrigin => new URL(allowedOrigin).origin === origin);

  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (!originAllowed) {
    return sendJson(res, 403, { error: 'origin_not_allowed' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return sendJson(res, 400, { error: 'invalid_request' }); }
  }
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
  if (!code || !ALLOWED_REDIRECTS.has(redirectUri)) {
    return sendJson(res, 400, { error: 'invalid_request' });
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return sendJson(res, 500, { error: 'oauth_not_configured' });
  }

  try {
    const form = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const googleData = await googleResponse.json();
    if (!googleResponse.ok || googleData.error) {
      return sendJson(res, 400, { error: typeof googleData.error === 'string' ? googleData.error : 'token_exchange_failed', error_description: typeof googleData.error_description === 'string' ? googleData.error_description : undefined });
    }
    return sendJson(res, 200, {
      access_token: googleData.access_token,
      token_type: googleData.token_type,
      expires_in: googleData.expires_in,
      scope: googleData.scope,
    });
  } catch {
    return sendJson(res, 502, { error: 'token_exchange_unavailable' });
  }
};
