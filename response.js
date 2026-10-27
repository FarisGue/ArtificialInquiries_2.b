'use strict';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'artinq.omeka.config.v1';
const literals = ['title', 'taskName', 'importance', 'frequency', 'assistanceLevel', 'explanation'];
const relations = { usesAIRole: 'AIRole', keepsHumanResponsibility: 'HumanResponsibility', generatesReflection: 'Reflection' };
const term = field => field === 'title' ? 'dcterms:title' : `artinq:${field}`;
let config = null;
let properties = new Map();
let classes = new Map();
let tasks = [];
let editing = null;
let busy = false;

function showStatus(label) {
  $('api-status').textContent = label;
  $('api-status').dataset.state = label.toLowerCase().replace('...', '');
}
function showMessage(message, kind = 'info') {
  $('message').textContent = message;
  $('message').dataset.kind = kind;
  $('message').hidden = false;
}
function redact(value) {
  let result = String(value);
  for (const secret of [config?.identity, config?.credential, $('identity').value, $('credential').value]) {
    if (secret) for (const variant of [secret, encodeURIComponent(secret)]) result = result.split(variant).join('[REDACTED]');
  }
  return result.replace(/(key_(?:identity|credential)=)[^&\s]*/gi, '$1[REDACTED]');
}
function debug(url, status, message) {
  // Log only a safe URL and a short, redacted response; never request bodies.
  const safe = new URL(url);
  safe.searchParams.delete('key_identity');
  safe.searchParams.delete('key_credential');
  $('debug').textContent = `${safe}\nHTTP ${status}\n${redact(message).slice(0, 400)}\n\n${$('debug').textContent}`.slice(0, 6000);
}
function authNotice() {
  const mode = $('auth-mode').value;
  $('auth-note').textContent = !['keys', 'local'].includes(mode)
    ? 'This authentication mode requires additional server-side configuration and is not enabled in this prototype.'
    : mode === 'local' ? 'Anonymous public reads. Select Omeka API Keys to enable writes.' : 'Keys are required for writes. Reads first try anonymous access, then use supplied keys to include accessible private resources.';
  $('local-warning').hidden = !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test($('base-url').value.trim());
}
function readConfig() {
  if (!$('config-form').reportValidity()) throw new Error('Enter a valid Omeka base URL.');
  const url = new URL($('base-url').value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) base URL without credentials, query parameters or fragments.');
  const mode = $('auth-mode').value;
  if (!['keys', 'local'].includes(mode)) throw new Error('This authentication mode requires additional server-side configuration and is not enabled in this prototype.');
  return { base: url.href.replace(/\/+$/, '').replace(/\/api$/, ''), identity: $('identity').value.trim(), credential: $('credential').value.trim(), mode };
}
function resetData() {
  properties.clear(); classes.clear(); tasks = []; editing = null;
  $('tasks').replaceChildren(); $('task-count').textContent = 'Test the connection or refresh to load tasks.';
  showStatus('Disconnected');
}
function applyConfig() {
  const next = readConfig();
  if (JSON.stringify(next) !== JSON.stringify(config)) resetData();
  config = next;
}
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      $('base-url').value = saved.base || '';
      $('identity').value = saved.identity || '';
      $('credential').value = saved.credential || '';
      $('auth-mode').value = saved.mode || 'keys';
    }
  } catch { showMessage('Saved configuration could not be read. Enter settings again.', 'error'); }
  authNotice();
}
function saveConfig() {
  applyConfig();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
  catch { throw new Error('Browser storage is unavailable. Settings work for this session but could not be saved.'); }
  showMessage('Configuration saved in this browser.', 'success');
}
function requireKeys() {
  if (config?.mode !== 'keys' || !config.identity || !config.credential) throw new Error('Choose Omeka API Keys and enter both keys to create, update or delete tasks.');
}
async function request(path, { method = 'GET', params = {}, body, authenticated = false } = {}) {
  if (!config) throw new Error('Enter connection settings first.');
  const url = new URL(`${config.base}/api/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  if (authenticated || method !== 'GET') {
    requireKeys();
    url.searchParams.set('key_identity', config.identity);
    url.searchParams.set('key_credential', config.credential);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
    const raw = await response.text();
    debug(url, response.status, raw);
    if (!response.ok) {
      const message = response.status === 401 ? 'Invalid API keys or authentication required.' : response.status === 403 ? 'Access denied: check API keys and the owner’s permissions.' : response.status === 404 ? 'Omeka endpoint or item not found. Check the base URL.' : `Omeka API request failed (HTTP ${response.status}). ${redact(raw).slice(0, 180)}`;
      const error = new Error(message); error.status = response.status; throw error;
    }
    if (response.status === 204 || !raw) return null;
    try { return JSON.parse(raw); } catch { throw new Error('The server returned non-JSON data. Check that the URL points to Omeka S.'); }
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      debug(url, 'network error', 'No readable response');
      throw new Error('Omeka unavailable or network request blocked. Check Apache, the base URL, CORS, HTTPS/mixed-content and local-network permissions. The browser cannot distinguish these causes.');
    }
    throw error;
  } finally { clearTimeout(timer); }
}
async function get(path, params = {}) {
  const hasKeys = config?.mode === 'keys' && config.identity && config.credential;
  let publicResult;
  try { publicResult = await request(path, { params }); }
  catch (error) { if (!hasKeys || ![401, 403].includes(error.status)) throw error; }
  // Authenticated reads are essential before editing, to retain private metadata.
  return hasKeys ? request(path, { params, authenticated: true }) : publicResult;
}
async function all(path, params = {}) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await get(path, { ...params, per_page: 100, page });
    if (!Array.isArray(batch)) throw new Error(`Unexpected response for ${path}: expected a list.`);
    result.push(...batch);
    if (!batch.length) return result;
  }
}
async function discover() {
  const [props, types] = await Promise.all([all('properties'), all('resource_classes')]);
  properties = new Map(props.map(p => [p['o:term'], p['o:id']]));
  classes = new Map(types.map(c => [c['o:term'], c['o:id']]));
  const missing = [...literals, ...Object.keys(relations)].map(term).filter(t => !properties.has(t));
  if (missing.length) throw new Error(`Missing vocabulary properties: ${missing.join(', ')}. Import the artinq vocabulary in Omeka.`);
  if (!classes.has('artinq:Task')) throw new Error('The artinq:Task class was not found. Import the project vocabulary in Omeka.');
}
async function testConnection() {
  applyConfig(); showStatus('Connecting...');
  const result = await get('items', { per_page: 1 });
  if (!Array.isArray(result)) throw new Error('Unexpected API response: expected an item list.');
  showStatus('Connected');
  await discover(); await fetchTasks();
  showMessage('Connected to Omeka S. Tasks loaded.', 'success');
}
async function fetchTasks() {
  tasks = await all('items', { resource_class_id: classes.get('artinq:Task') });
  renderTasks(); showStatus('Connected');
}
const titleOf = item => item['o:title'] || item['dcterms:title']?.[0]?.['@value'] || `Item #${item['o:id']}`;
function valuesOf(item, field) {
  return (item[term(field)] || []).map(v => v['@value'] ?? v.display_title ?? v['o:label'] ?? (v.value_resource_id ? `Resource #${v.value_resource_id}` : v['@id'] || '')).join('\n');
}
function renderTasks() {
  $('tasks').replaceChildren();
  $('task-count').textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} found${tasks.length ? '' : '. Add your first task'}.`;
  for (const task of tasks) {
    const card = document.createElement('article'); card.className = 'task-card';
    const id = document.createElement('div'); id.className = 'task-id'; id.textContent = `OMEKA ITEM #${task['o:id']}`;
    const heading = document.createElement('h3'); heading.textContent = titleOf(task);
    const dl = document.createElement('dl');
    for (const [field, label] of Object.entries({ taskName: 'Task name', importance: 'Importance', frequency: 'Frequency', assistanceLevel: 'Assistance level', explanation: 'Explanation', usesAIRole: 'AI roles', keepsHumanResponsibility: 'Human responsibilities', generatesReflection: 'Reflection' })) {
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = valuesOf(task, field) || 'Not specified'; dl.append(dt, dd);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const [label, action] of [['Edit', () => openEditForm(task['o:id'])], ['Delete', () => deleteTask(task['o:id'])], ['Refresh', fetchTasks]]) {
      const button = document.createElement('button'); button.textContent = label; button.className = label === 'Delete' ? 'danger' : 'secondary';
      button.addEventListener('click', () => run(action)); actions.append(button);
    }
    card.append(id, heading, dl, actions); $('tasks').append(card);
  }
}
async function fetchRelatedResources() {
  for (const [field, type] of Object.entries(relations)) {
    const select = $(field); select.replaceChildren();
    if (!select.multiple) select.add(new Option('None', ''));
    const classId = classes.get(`artinq:${type}`);
    if (!classId) throw new Error(`Missing artinq:${type} resource class. Import the project vocabulary.`);
    for (const item of await all('items', { resource_class_id: classId })) select.add(new Option(titleOf(item), item['o:id']));
  }
}
async function prepareForm() {
  applyConfig(); requireKeys();
  if (!properties.size) await discover();
  await fetchRelatedResources();
  $('task-form').reset(); $('form-error').hidden = true;
}
async function openCreateForm() {
  await prepareForm(); editing = null;
  $('form-heading').textContent = 'Create Task'; $('save-task').textContent = 'Create Task'; $('task-dialog').showModal();
}
async function openEditForm(id) {
  await prepareForm();
  editing = await get(`items/${id}`);
  for (const field of literals) {
    const value = editing[term(field)]?.[0]?.['@value'] || '';
    if ($(field).tagName === 'SELECT' && !Array.from($(field).options).some(o => o.value === value)) $(field).add(new Option(value, value));
    $(field).value = value;
  }
  for (const field of Object.keys(relations)) {
    const links = editing[term(field)] || [];
    for (const link of links) if (link.value_resource_id && !Array.from($(field).options).some(o => o.value === String(link.value_resource_id))) $(field).add(new Option(link.display_title || `Resource #${link.value_resource_id}`, link.value_resource_id));
    const selectedLinks = $(field).multiple ? links : links.slice(0, 1);
    for (const option of $(field).options) option.selected = selectedLinks.some(v => String(v.value_resource_id) === option.value);
  }
  $('form-heading').textContent = `Edit Task #${id}`; $('save-task').textContent = 'Save changes'; $('task-dialog').showModal();
}
function buildPayload(existing = null) {
  const payload = {};
  // PATCH replaces the RDF value collection. Carry forward all unrelated values.
  if (existing) for (const [key, value] of Object.entries(existing)) {
    if (Array.isArray(value) && value.some(v => v && typeof v === 'object' && 'property_id' in v)) payload[key] = value;
  }
  else { payload['o:resource_class'] = { 'o:id': classes.get('artinq:Task') }; payload['o:is_public'] = true; }
  for (const field of literals) {
    const value = $(field).value.trim();
    const old = existing?.[term(field)] || [];
    // Preserve additional values and the first value's visibility/language.
    payload[term(field)] = value ? [{ ...(old[0] || {}), type: 'literal', property_id: properties.get(term(field)), '@value': value }, ...old.slice(1)] : old.slice(1);
  }
  for (const field of Object.keys(relations)) {
    const old = existing?.[term(field)] || [];
    payload[term(field)] = Array.from($(field).selectedOptions).filter(o => o.value).map(o => ({ ...(old.find(v => v.value_resource_id === Number(o.value)) || {}), type: 'resource:item', property_id: properties.get(term(field)), value_resource_id: Number(o.value) }));
    // The reflection UI edits the first link; retain any additional existing links.
    if (field === 'generatesReflection') payload[term(field)].push(...old.slice(1).filter(v => !payload[term(field)].some(n => n.value_resource_id === v.value_resource_id)));
  }
  return payload;
}
async function createTask() { await request('items', { method: 'POST', body: buildPayload() }); }
async function updateTask() {
  const fresh = await get(`items/${editing['o:id']}`);
  if (JSON.stringify(fresh) !== JSON.stringify(editing)) throw new Error('This task changed since you opened it. Close and reopen the editor before saving.');
  await request(`items/${editing['o:id']}`, { method: 'PATCH', body: buildPayload(fresh) });
}
async function afterWrite(message) {
  try { await fetchTasks(); showMessage(message, 'success'); }
  catch (error) { showMessage(`${message} Refresh failed: ${redact(error.message)} Use Refresh; do not repeat the write.`, 'error'); }
}
async function deleteTask(id) {
  applyConfig(); requireKeys();
  if (!window.confirm('Are you sure you want to delete this task?')) return;
  await request(`items/${id}`, { method: 'DELETE' }); await afterWrite('Task deleted.');
}
async function run(action) {
  if (busy) return;
  busy = true;
  const controls = Array.from(document.querySelectorAll('button, #config-form input, #config-form select'));
  controls.forEach(el => { el.disabled = true; });
  try { await action(); }
  catch (error) {
    showMessage(redact(error.message), 'error'); showStatus('Error');
    if ($('task-dialog').open) { $('form-error').textContent = redact(error.message); $('form-error').hidden = false; }
  } finally { busy = false; controls.forEach(el => { el.disabled = false; }); }
}
$('config-form').addEventListener('submit', event => { event.preventDefault(); run(saveConfig); });
$('test-connection').addEventListener('click', () => run(testConnection));
$('refresh-tasks').addEventListener('click', () => run(async () => { applyConfig(); showStatus('Connecting...'); await discover(); await fetchTasks(); }));
$('clear-config').addEventListener('click', () => run(() => {
  localStorage.removeItem(STORAGE_KEY); config = null; $('config-form').reset(); resetData(); $('debug').textContent = 'No requests yet.'; authNotice(); showMessage('Configuration cleared.');
}));
$('auth-mode').addEventListener('change', authNotice);
$('base-url').addEventListener('input', authNotice);
// Old cards must never send item IDs to a newly entered server.
for (const id of ['base-url', 'identity', 'credential', 'auth-mode']) $(id).addEventListener('input', resetData);
$('add-task').addEventListener('click', () => run(openCreateForm));
for (const id of ['close-form', 'cancel-form']) $(id).addEventListener('click', () => $('task-dialog').close());
$('task-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('task-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    if (!$('title').value.trim() || !$('taskName').value.trim()) throw new Error('Invalid form: title and task name must not be blank.');
    const isEdit = Boolean(editing);
    if (isEdit) await updateTask(); else await createTask();
    $('task-dialog').close(); await afterWrite(isEdit ? 'Task updated.' : 'Task created.');
  });
});
loadConfig();
