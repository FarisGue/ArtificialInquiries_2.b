'use strict';

const CAS_VALIDATE_ENDPOINT = 'https://artificialinquiries-2b.vercel.app/api/cas-validate';
const CAS_PENDING_KEY = 'artinq.cas.pending.v1';
const CAS_AUTHENTICATED_KEY = 'cas_authenticated';
const CAS_USER_KEY = 'cas_user';
const CAS_ATTRIBUTES_KEY = 'cas_attributes';

function casCallbackServiceUrl() {
  return ['127.0.0.1', 'localhost'].includes(location.hostname)
    ? 'http://127.0.0.1:5500/cas-callback.html'
    : 'https://FarisGue.github.io/ArtificialInquiries_2.b/cas-callback.html';
}
function casCallbackError(message) {
  document.getElementById('cas-callback-status').textContent = message;
}
function clearCasResult() {
  for (const key of [CAS_AUTHENTICATED_KEY, CAS_USER_KEY, CAS_ATTRIBUTES_KEY]) sessionStorage.removeItem(key);
}
async function completeCasAuthentication() {
  const params = new URLSearchParams(location.search);
  const ticket = params.get('ticket');
  const pending = sessionStorage.getItem(CAS_PENDING_KEY);
  history.replaceState(null, '', location.pathname);
  sessionStorage.removeItem(CAS_PENDING_KEY);

  if (!pending) {
    clearCasResult();
    casCallbackError('CAS authentication failed: no login request is pending.');
    return;
  }
  if (!ticket) {
    clearCasResult();
    casCallbackError('CAS authentication failed: no ticket was returned.');
    return;
  }

  try {
    const response = await fetch(CAS_VALIDATE_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, service: casCallbackServiceUrl() }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    const result = await response.json();
    if (!response.ok || result.authenticated !== true || typeof result.user !== 'string' || !result.user) throw new Error('CAS validation failed');
    sessionStorage.setItem(CAS_AUTHENTICATED_KEY, 'true');
    sessionStorage.setItem(CAS_USER_KEY, result.user);
    sessionStorage.setItem(CAS_ATTRIBUTES_KEY, JSON.stringify(result.attributes && typeof result.attributes === 'object' ? result.attributes : {}));
    location.replace('response.html');
  } catch {
    clearCasResult();
    casCallbackError('CAS authentication could not be validated. Please return to the application and try again.');
  }
}

completeCasAuthentication();

