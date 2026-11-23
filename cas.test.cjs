const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function mockResponse() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}
async function endpointTests() {
  const handler = require('./api/cas-validate.js');
  const originalFetch = global.fetch;
  const originalServer = process.env.CAS_SERVER_URL;
  const originalService = process.env.CAS_SERVICE_URL;
  const service = 'http://127.0.0.1:5500/cas-callback.html';
  const invoke = async (body, method = 'POST') => {
    const res = mockResponse();
    await handler({ method, headers: { origin: 'http://127.0.0.1:5500' }, body }, res);
    return res;
  };
  try {
    process.env.CAS_SERVER_URL = 'not-a-valid-url'; process.env.CAS_SERVICE_URL = service;
    assert.equal((await invoke({ ticket: 'ST-valid', service })).statusCode, 503, 'Missing CAS configuration must be handled');
    process.env.CAS_SERVER_URL = 'https://cas.univ-paris8.fr/cas'; process.env.CAS_SERVICE_URL = service;
    let validationUrl;
    global.fetch = async url => { validationUrl = new URL(url); return { ok: true, text: async () => '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Invalid</cas:authenticationFailure></cas:serviceResponse>' }; };
    const invalid = await invoke({ ticket: 'ST-invalid', service });
    assert.equal(invalid.statusCode, 401); assert.equal(invalid.body.authenticated, false);
    global.fetch = async url => { validationUrl = new URL(url); return { ok: true, text: async () => '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationSuccess><cas:user>student8</cas:user><cas:attributes><cas:mail>student@example.org</cas:mail><cas:role>student</cas:role></cas:attributes></cas:authenticationSuccess></cas:serviceResponse>' }; };
    const success = await invoke({ ticket: 'ST-success', service });
    assert.equal(success.statusCode, 200); assert.deepEqual(success.body, { authenticated: true, user: 'student8', attributes: { mail: 'student@example.org', role: 'student' } });
    assert.equal(validationUrl.pathname, '/cas/serviceValidate');
    assert.equal(validationUrl.searchParams.get('service'), service);
    assert.equal(validationUrl.searchParams.get('ticket'), 'ST-success');
    assert.equal((await invoke({}, 'OPTIONS')).statusCode, 204);
    assert.equal((await invoke({ ticket: 'ST-x', service: 'https://evil.example/callback' })).statusCode, 400);
  } finally {
    global.fetch = originalFetch;
    if (originalServer === undefined) delete process.env.CAS_SERVER_URL; else process.env.CAS_SERVER_URL = originalServer;
    if (originalService === undefined) delete process.env.CAS_SERVICE_URL; else process.env.CAS_SERVICE_URL = originalService;
  }
}

function frontendTests() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: false, disabled: false, dataset: {}, options: [], selectedOptions: [], addEventListener() {}, replaceChildren() {}, append() {}, add() {}, reset() {}, reportValidity() { return true; } });
    return elements.get(id);
  };
  const storage = new Map();
  let assigned = '';
  const context = vm.createContext({
    console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Option: function () {},
    document: { getElementById: element, querySelectorAll: () => [], createElement: () => element(Math.random()) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    location: { hostname: '127.0.0.1', assign: value => { assigned = value; } },
    window: { CAS_SERVER_URL: '', confirm: () => true }, fetch: async () => ({ ok: true, status: 200, text: async () => '[]' }),
  });
  vm.runInContext(fs.readFileSync('response.js', 'utf8'), context);
  vm.runInContext('loginWithCas()', context);
  assert.equal(assigned, ''); assert.equal(element('cas-auth-message').textContent, 'CAS authentication is not configured yet.');
  context.window.CAS_SERVER_URL = 'https://cas.univ-paris8.fr/cas';
  vm.runInContext('restoreCasSession()', context);
  assert.equal(element('login-cas').disabled, false, 'Configured CAS login button must be enabled');
  vm.runInContext('loginWithCas()', context);
  const login = new URL(assigned);
  assert.equal(login.href.split('?')[0], 'https://cas.univ-paris8.fr/cas/login');
  assert.equal(login.searchParams.get('service'), 'http://127.0.0.1:5500/cas-callback.html');
  context.location.hostname = 'FarisGue.github.io'; vm.runInContext('loginWithCas()', context);
  assert.equal(new URL(assigned).searchParams.get('service'), 'https://FarisGue.github.io/ArtificialInquiries_2.b/cas-callback.html');
  assert(storage.has('artinq.cas.pending.v1'));
  storage.set('artinq.github.user.v1', 'github'); storage.set('artinq.google.user.v1', 'google'); storage.set('artinq.omeka.guest.v1', 'omeka');
  storage.set('cas_authenticated', 'true'); storage.set('cas_user', 'student8'); storage.set('cas_attributes', '{}');
  vm.runInContext('logoutCas()', context);
  for (const key of ['cas_authenticated', 'cas_user', 'cas_attributes', 'artinq.cas.pending.v1']) assert(!storage.has(key));
  assert.equal(storage.get('artinq.github.user.v1'), 'github');
  assert.equal(storage.get('artinq.google.user.v1'), 'google');
  assert.equal(storage.get('artinq.omeka.guest.v1'), 'omeka');
  assert.equal(assigned, 'https://cas.univ-paris8.fr/cas/logout');
}

async function callbackTest({ search, response, pending = true }) {
  const storage = new Map(pending ? [['artinq.cas.pending.v1', '1']] : []);
  let replaced = ''; let requestBody = null;
  const status = { textContent: '' };
  const context = vm.createContext({
    URLSearchParams, console,
    document: { getElementById: () => status },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    location: { hostname: '127.0.0.1', search, pathname: '/cas-callback.html', replace: value => { replaced = value; } },
    history: { replaceState() {} },
    fetch: async (url, options) => { requestBody = JSON.parse(options.body); return { ok: response.ok, json: async () => response.body }; },
  });
  vm.runInContext(fs.readFileSync('cas-auth.js', 'utf8'), context);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { storage, status: status.textContent, replaced, requestBody };
}

(async () => {
  await endpointTests();
  frontendTests();
  const missing = await callbackTest({ search: '', response: {} });
  assert.match(missing.status, /no ticket/i); assert.equal(missing.requestBody, null);
  const invalid = await callbackTest({ search: '?ticket=ST-secret-ticket', response: { ok: false, body: { authenticated: false } } });
  assert.match(invalid.status, /could not be validated/i); assert(!invalid.storage.has('cas_authenticated'));
  const success = await callbackTest({ search: '?ticket=ST-success', response: { ok: true, body: { authenticated: true, user: 'student8', attributes: { mail: 'student@example.org' } } } });
  assert.equal(success.storage.get('cas_authenticated'), 'true'); assert.equal(success.storage.get('cas_user'), 'student8');
  assert.equal(success.replaced, 'response.html'); assert.equal(success.requestBody.service, 'http://127.0.0.1:5500/cas-callback.html');
  assert(![...success.storage.values()].some(value => String(value).includes('ST-success')), 'CAS ticket must never be stored');
  console.log('PASS: CAS configuration, login URL, callback, validation XML, session storage, logout isolation, and service restrictions.');
})().catch(error => { console.error(error); process.exitCode = 1; });

