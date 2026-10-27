const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {value:'', textContent:'', hidden:false, dataset:{}, options:[], selectedOptions:[], addEventListener(){}, reportValidity(){return true;}, replaceChildren(){}, append(){}, reset(){}, add(o){this.options.push(o);}});
  return elements.get(id);
}
const storage = new Map();
const calls = [];
const context = vm.createContext({console, URL, AbortController, setTimeout, clearTimeout, Option: function(text,value){this.text=text;this.value=String(value);}, document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>element(Math.random())}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}, window:{confirm:()=>true}, fetch:async(url,options)=>{calls.push({url:new URL(url),...options});return {ok:true,status:options.method==='DELETE'?204:200,text:async()=>options.method==='DELETE'?'':'[]'};}});
vm.runInContext(fs.readFileSync('response.js','utf8'),context);
(async()=>{
  await vm.runInContext(`(async()=>{
    $('base-url').value='http://localhost/omeka-s'; $('auth-mode').value='keys'; $('identity').value='test-identity'; $('credential').value='test-credential'; saveConfig();
    properties = new Map([...literals,...Object.keys(relations)].map((f,i)=>[term(f),i+1])); classes.set('artinq:Task',44);
    $('title').value='Organize my university notes'; $('taskName').value='Organize my university notes'; $('frequency').value='Weekly'; $('assistanceLevel').value='AI Can Assist';
    $('usesAIRole').selectedOptions=[{value:'12'},{value:'13'}]; $('keepsHumanResponsibility').selectedOptions=[{value:'21'}]; $('generatesReflection').selectedOptions=[{value:'31'}];
    await createTask();
  })()`,context);
  let post=calls.find(c=>c.method==='POST'); let body=JSON.parse(post.body);
  assert.equal(body['o:resource_class']['o:id'],44);
  assert.equal(body['artinq:usesAIRole'][0].value_resource_id,12);
  assert.equal(body['artinq:usesAIRole'][0].type,'resource:item');
  assert.equal(body['dcterms:title'][0]['@value'],'Organize my university notes');
  assert.equal(post.url.searchParams.get('key_credential'),'test-credential');
  const preserved=vm.runInContext(`buildPayload({'dcterms:description':[{type:'literal',property_id:99,'@value':'Keep me',is_public:false}], 'dcterms:title':[{type:'literal',property_id:1,'@value':'Old',is_public:false},{type:'literal',property_id:1,'@value':'Alternate'}]})`,context);
  assert.equal(preserved['dcterms:description'][0]['@value'],'Keep me');
  assert.equal(preserved['dcterms:title'][0].is_public,false);
  assert.equal(preserved['dcterms:title'][1]['@value'],'Alternate');
  await vm.runInContext(`request('items/42',{method:'PATCH',body:buildPayload()})`,context);
  await vm.runInContext(`deleteTask(42)`,context);
  assert(calls.some(c=>c.method==='PATCH'&&c.url.pathname.endsWith('/items/42')));
  assert(calls.some(c=>c.method==='DELETE'&&c.url.pathname.endsWith('/items/42')));
  calls.length=0;
  await vm.runInContext(`get('items',{per_page:1})`,context);
  assert.equal(calls.length,2); assert.equal(calls[0].url.searchParams.has('key_identity'),false); assert.equal(calls[1].url.searchParams.has('key_identity'),true);
  assert(!element('debug').textContent.includes('test-credential'));
  assert(!element('debug').textContent.includes('test-identity'));
  assert(storage.size===1);
  await vm.runInContext(`config.mode='local'; get('items')`,context);
  assert.equal(calls.at(-1).url.searchParams.has('key_identity'),false);
  assert.throws(()=>vm.runInContext('requireKeys()',context),/API Keys/);
  console.log('PASS: configuration storage, public/authenticated GET, create JSON-LD, PATCH, DELETE, metadata preservation, resource links, credential redaction, local read-only mode.');
})().catch(error=>{console.error(error);process.exitCode=1;});
