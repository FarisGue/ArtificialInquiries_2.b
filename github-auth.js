'use strict';

const GITHUB_STATE_KEY = 'artinq.github.oauth.state.v1';
const GITHUB_TOKEN_KEY = 'artinq.github.access-token.v1';
const GITHUB_USER_KEY = 'artinq.github.user.v1';
const TOKEN_ENDPOINT = 'https://artificialinquiries-2b.vercel.app/api/github-token';

function callbackRedirectUri() {
  return ['127.0.0.1', 'localhost'].includes(location.hostname)
    ? 'http://127.0.0.1:5500/github-callback.html'
    : 'https://FarisGue.github.io/ArtificialInquiries_2.b/github-callback.html';
}
function callbackError(message) {
  document.getElementById('github-callback-status').textContent = message;
}
async function completeGithubAuthentication() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');
  const expectedState = sessionStorage.getItem(GITHUB_STATE_KEY);

  history.replaceState(null, '', location.pathname);
  sessionStorage.removeItem(GITHUB_STATE_KEY);

  if (!expectedState || !returnedState || returnedState !== expectedState) {
    callbackError('GitHub authentication failed: invalid state.');
    return;
  }
  if (oauthError) {
    callbackError('GitHub authentication was cancelled or denied.');
    return;
  }
  if (!code) {
    callbackError('GitHub authentication failed: no authorization code was returned.');
    return;
  }

  try {
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: callbackRedirectUri() }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string' || !tokenData.access_token) throw new Error('Token exchange failed');

    const accessToken = tokenData.access_token;
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!userResponse.ok) throw new Error('User lookup failed');
    const profile = await userResponse.json();
    if (typeof profile.login !== 'string' || typeof profile.avatar_url !== 'string' || typeof profile.html_url !== 'string') throw new Error('Invalid user response');
    const user = { login: profile.login, name: typeof profile.name === 'string' ? profile.name : '', avatar_url: profile.avatar_url, html_url: profile.html_url };
    sessionStorage.setItem(GITHUB_TOKEN_KEY, accessToken);
    sessionStorage.setItem(GITHUB_USER_KEY, JSON.stringify(user));
    location.replace('response.html');
  } catch {
    sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    sessionStorage.removeItem(GITHUB_USER_KEY);
    callbackError('GitHub authentication failed. Please return to the application and try again.');
  }
}

completeGithubAuthentication();
