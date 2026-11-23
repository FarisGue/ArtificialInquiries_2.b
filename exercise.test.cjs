const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: false, open: false, dataset: {}, options: [], selectedOptions: [], children: [], addEventListener() {}, reportValidity() { return true; }, replaceChildren() { this.children = []; }, append(...values) { this.children.push(...values); }, reset() {}, add() {}, close() {}, showModal() { this.open = true; } });
  return elements.get(id);
}
const calls = [];
const existing = {
  'o:id': 77,
  'dcterms:title': [{ type: 'literal', property_id: 1, '@value': 'Exercise CRUD Test' }],
  'dcterms:creator': [{ type: 'literal', property_id: 9, '@value': 'Preserve this editor', is_public: false }],
  'artinq:aPourExemple': [{ type: 'resource:item', property_id: 318, value_resource_id: 12, '@id': 'http://localhost/omeka-s/api/items/12' }],
};
const context = vm.createContext({
  console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Option: function () {},
  document: { getElementById: element, querySelectorAll: () => [], createElement: () => element(Math.random()) },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { hostname: '127.0.0.1', assign() {} }, window: { confirm: () => true },
  fetch: async (url, options = {}) => {
    const parsed = new URL(url); calls.push({ url: parsed, ...options });
    let body = [];
    if (parsed.pathname.endsWith('/items/77') && options.method === 'GET') body = existing;
    else if (parsed.pathname.endsWith('/items') && options.method === 'GET') body = parsed.searchParams.get('page') === '1' ? [existing] : [];
    return { ok: true, status: options.method === 'DELETE' ? 204 : 200, text: async () => options.method === 'DELETE' ? '' : JSON.stringify(body) };
  },
});
vm.runInContext(fs.readFileSync('response.js', 'utf8'), context);

(async () => {
  await assert.rejects(vm.runInContext('openExerciseForm()', context), /Omeka configuration required\. Please configure the Omeka base URL and API keys before creating or modifying exercises\./);
  assert.equal(calls.length, 0, 'Missing local Omeka configuration must not make an Exercise request');
  element('base-url').value = 'http://localhost/omeka-s'; element('auth-mode').value = 'keys'; element('identity').value = 'id'; element('credential').value = 'credential';
  vm.runInContext("config={base:'http://localhost/omeka-s',identity:'id',credential:'credential',mode:'keys'}; classes.set('artinq:Exercice',134); exerciseTemplateId=26", context);
  const terms = { 'dcterms:title': 1, 'dcterms:description': 4, 'artinq:numero': 231, 'artinq:titre': 222, 'artinq:pageVademecum': 245, 'artinq:aPourExemple': 318 };
  context.exercisePropertyEntries = Object.entries(terms);
  vm.runInContext('properties=new Map(exercisePropertyEntries)', context);
  element('exercise-title').value = 'Exercise CRUD Test'; element('exercise-number').value = 'TEST'; element('exercise-artinq-title').value = 'Exercise CRUD Test'; element('exercise-page').value = '1'; element('exercise-description').value = 'Temporary test'; element('exercise-examples').value = '12, 12, 34';
  await vm.runInContext('createExercise()', context);
  const post = calls.find(call => call.method === 'POST'); const payload = JSON.parse(post.body);
  assert.equal(payload['o:resource_class']['o:id'], 134); assert.equal(payload['o:resource_template']['o:id'], 26); assert.equal(payload['artinq:numero'][0]['@value'], 'TEST'); assert.deepEqual(payload['artinq:aPourExemple'].map(value => value.value_resource_id), [12, 34]);
  vm.runInContext('editingExercise={"o:id":77}', context); await vm.runInContext('updateExercise()', context);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.equal(patch.url.pathname, '/omeka-s/api/items/77');
  assert.equal(JSON.parse(patch.body)['dcterms:creator'][0]['@value'], 'Preserve this editor');
  await vm.runInContext('loadExercises()', context); assert.equal(element('exercise-count').textContent, '1 exercise found.');
  const listCall = calls.find(call => call.method === 'GET' && call.url.pathname.endsWith('/items') && call.url.searchParams.get('resource_class_id'));
  assert.equal(listCall.url.searchParams.get('resource_class_id'), '134');
  assert.equal(listCall.url.searchParams.get('resource_template_id'), '26');
  await vm.runInContext('deleteExercise(77)', context);
  const deletes = calls.filter(call => call.method === 'DELETE');
  assert.deepEqual(deletes.map(call => call.url.pathname), ['/omeka-s/api/items/77']);
  let releases; let submissions = 0;
  const pending = new Promise(resolve => { releases = resolve; });
  context.doubleSubmitAction = async () => { submissions++; await pending; };
  const first = vm.runInContext('run(doubleSubmitAction)', context); const second = vm.runInContext('run(doubleSubmitAction)', context);
  assert.equal(submissions, 1, 'Busy guard must prevent a double submission'); releases(); await Promise.all([first, second]);
  console.log('PASS: Exercise CRUD endpoints, filters, template, class, properties, missing-config guard, metadata preservation, selected deletion, and double-submit prevention.');
})().catch(error => { console.error(error); process.exitCode = 1; });
