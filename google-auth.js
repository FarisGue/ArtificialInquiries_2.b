'use strict';

const GOOGLE_STATE_KEY = 'artinq.google.oauth.state.v1';
const GOOGLE_TOKEN_KEY = 'artinq.google.access-token.v1';
const GOOGLE_USER_KEY = 'artinq.google.user.v1';
const GOOGLE_TOKEN_ENDPOINT = 'https://artificialinquiries-2b.vercel.app/api/google-token';

function googleCallbackRedirectUri() {
  return ['127.0.0.1', 'localhost'].includes(location.hostname)
    ? 'http://127.0.0.1:5500/google-callback.html'
    : 'https://FarisGue.github.io/ArtificialInquiries_2.b/google-callback.html';
}
function googleCallbackError(message) {
  document.getElementById('google-callback-status').textContent = message;
}
async function completeGoogleAuthentication() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');
  const expectedState = sessionStorage.getItem(GOOGLE_STATE_KEY);

  history.replaceState(null, '', location.pathname);
  sessionStorage.removeItem(GOOGLE_STATE_KEY);

  if (!expectedState || !returnedState || returnedState !== expectedState) {
    googleCallbackError('Google authentication failed: invalid state.');
    return;
  }
  if (oauthError) {
    googleCallbackError('Google authentication was cancelled or denied.');
    return;
  }
  if (!code) {
    googleCallbackError('Google authentication failed: no authorization code was returned.');
    return;
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: googleCallbackRedirectUri() }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string' || !tokenData.access_token) throw new Error('Token exchange failed');

    const accessToken = tokenData.access_token;
    const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!userResponse.ok) throw new Error('User lookup failed');
    const profile = await userResponse.json();
    if (typeof profile.sub !== 'string' || typeof profile.email !== 'string') throw new Error('Invalid user response');
    const user = {
      sub: profile.sub,
      name: typeof profile.name === 'string' ? profile.name : '',
      email: profile.email,
      picture: typeof profile.picture === 'string' ? profile.picture : '',
    };
    sessionStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
    sessionStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(user));
    location.replace('response.html');
  } catch {
    sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
    sessionStorage.removeItem(GOOGLE_USER_KEY);
    googleCallbackError('Google authentication failed. Please return to the application and try again.');
  }
}

completeGoogleAuthentication();
