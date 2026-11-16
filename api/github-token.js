const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://farisgue.github.io',
]);
const ALLOWED_REDIRECTS = new Set([
  'http://127.0.0.1:5500/github-callback.html',
  'https://FarisGue.github.io/ArtificialInquiries_2.b/github-callback.html',
]);

function sendJson(response, status, body) {
  response.status(status).json(body);
}

module.exports = async function githubToken(request, response) {
  const origin = request.headers.origin;
  if (!ALLOWED_ORIGINS.has(origin)) {
    sendJson(response, 403, { error: 'origin_not_allowed' });
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  let body = request.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { sendJson(response, 400, { error: 'invalid_request' }); return; }
  }
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
  if (!code || !ALLOWED_REDIRECTS.has(redirectUri)) {
    sendJson(response, 400, { error: 'invalid_request' });
    return;
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    sendJson(response, 500, { error: 'oauth_not_configured' });
    return;
  }

  try {
    const githubResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const githubData = await githubResponse.json();
    if (!githubResponse.ok || githubData.error) {
      sendJson(response, 400, { error: typeof githubData.error === 'string' ? githubData.error : 'token_exchange_failed', error_description: typeof githubData.error_description === 'string' ? githubData.error_description : undefined });
      return;
    }
    sendJson(response, 200, { access_token: githubData.access_token, token_type: githubData.token_type, scope: githubData.scope });
  } catch {
    sendJson(response, 502, { error: 'token_exchange_unavailable' });
  }
};
