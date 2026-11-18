'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
 CORE,RESOLVER,ROUTES,graphVerified,assessParentCore,
 createOfflinePublishedCoreAdmission
}=require('./published-core-readonly-admission.cjs');

const SCOPE=Object.freeze({
 source:'SERVER_REVIEWED_SYNTHETIC_WIDGET_SCOPE',verified:true,
 tenantId:'tenant_shared',storeId:'store_a',widgetId:'widget_a',
 mode:'MERCHANT_SANDBOX',merchantOwnerApprovedSandbox:true,
 sandboxOnly:true,customerAuthenticated:false,
 privateOrdersAllowed:false,writeAllowed:false,sendAllowed:false
});
const PLAT=Object.freeze({...SCOPE,tenantId:'platform_demo',
 storeId:'platform_demo_store',widgetId:'platform_widget',
 mode:'PLATFORM_CONSULTANT'});
function graph(op,modify={}){
 const r=ROUTES[op],nodes=Object.entries(r.nodes).map(([name,type])=>({
  name,type,
  ...(name===r.dataTable?{resource:'row',operation:'get'}:{}),
  ...(name===r.resolver?{workflowId:RESOLVER}:{})
 }));
 nodes.push({name:'READ ME - non executing',type:'n8n-nodes-base.stickyNote'});
 return {source:'MOCK_INDEPENDENT_PUBLISHED_GRAPH',verified:true,
  active:true,workflowId:r.id,activeVersionId:r.published,
  nodes,edges:r.edges.map(x=>[...x]),...modify};
}
function response(req,alter={}){
 return {
  source:'MOCK_SCOPED_PUBLIC_CORE_CHILD_READBACK',
  verified:true,operation:req.operation,tenantId:req.tenantId,
  storeId:req.storeId,writeAllowed:false,privateOrderAccess:false,
  providerSends:0,orderWrites:0,previewOnly:true,
  ...(req.operation==='CATALOG_QUERY'?{
    products:[{name:'Sản phẩm QA',sku:'QA_A001',priceVnd:159000,
      stock:3,imageUrl:null}]
  }:{
    lines:[{sku:'QA_A001',quantity:2}],subtotalVnd:318000,
    canConfirm:false
  }),...alter
 };
}
function fixture({mode='MERCHANT_SANDBOX',scope=SCOPE,editGraph,editResult}={}){
 const counts={read:0,invoke:0};let last=null;
 const readPublishedGraph=async opts=>{
  counts.read++;
  assert.equal(opts.publicOnly,true);
  assert.equal(opts.requireActiveVersionId,ROUTES[
    Object.keys(ROUTES).find(k=>ROUTES[k].id===opts.workflowId)].published);
  const op=Object.keys(ROUTES).find(k=>ROUTES[k].id===opts.workflowId);
  const s=graph(op);
  return editGraph?editGraph(s,opts):s;
 };
 const invokeExistingReadOnlyChild=async req=>{
  counts.invoke++;last=req;
  assert.equal(req.parentCoreId,CORE.id);
  assert.equal(req.parentCorePublishedVersionId,CORE.published);
  assert.equal(req.readOnly,true);
  assert.equal(req.publicOnly,true);
  assert.equal(req.sandboxOnly,true);
  assert.equal(req.orderWritesAllowed,false);
  assert.equal(req.providerSendsAllowed,false);
  assert.equal(req.privateOrderAccess,false);
  const base=response(req);
  return editResult?editResult(base,req):base;
 };
 const g=createOfflinePublishedCoreAdmission({qaMode:'OFFLINE_SYNTHETIC_QA',
  mode,serverScope:scope,readPublishedGraph,invokeExistingReadOnlyChild});
 return {g,counts,getLast:()=>last};
}
const reject=(promise,code)=>assert.rejects(promise,e=>e?.code===code);
const catalog={operation:'CATALOG_QUERY',query:'Cho tôi xem áo QA'};
const cart={operation:'CART_PREVIEW',items:[{sku:'QA_A001',quantity:2}]};

test('Pinned actual published workflow IDs and zero permitted new agent',()=>{
 assert.equal(CORE.id,'iyfGUiEsZlNTBWOR');
 assert.equal(CORE.published,'456862c9-e5ee-4bfa-9931-47dbc39ab73d');
 assert.equal(ROUTES.CATALOG_QUERY.id,'oOOXicKXGkBskKqh');
 assert.equal(ROUTES.CART_PREVIEW.id,'igPOsSbEgd4NgtRA');
 assert.equal(RESOLVER,'5Eeh8hbpsoNhuiVo');
});
test('No hosted or production adapter can be created',()=>{
 assert.throws(()=>createOfflinePublishedCoreAdmission(),e=>
  e.code==='HOSTED_N8N_ADMISSION_NOT_APPROVED');
 assert.throws(()=>createOfflinePublishedCoreAdmission({
  qaMode:'HOSTED',mode:'MERCHANT_SANDBOX',
  serverScope:SCOPE,readPublishedGraph:()=>{},invokeExistingReadOnlyChild:()=>{}
 }),e=>e.code==='HOSTED_N8N_ADMISSION_NOT_APPROVED');
});
test('Published full Agent denied even though Core is active',()=>{
 const x=assessParentCore({
  source:'MOCK_INDEPENDENT_PUBLISHED_GRAPH',verified:true,
  workflowId:CORE.id,activeVersionId:CORE.published,
  nodes:[
   {name:'Commerce Sandbox Agent',type:'@n8n/n8n-nodes-langchain.agent'},
   {name:'Create Sandbox Ticket',type:'@n8n/n8n-nodes-langchain.toolWorkflow',
    workflowId:CORE.demoTicketWriter}
  ]
 });
 assert.equal(x.directAgentAdmission,false);
 assert.equal(x.reason,'AGENT_HAS_REACHABLE_TICKET_WRITE_TOOL');
 assert.equal(x.realN8nInvocations,0);
});
test('Unknown or changed parent published graph cannot be trusted',()=>{
 assert.throws(()=>assessParentCore({
  source:'MOCK_INDEPENDENT_PUBLISHED_GRAPH',verified:true,
  workflowId:CORE.id,activeVersionId:'unsaved-draft',nodes:[]
 }),e=>e.code==='PARENT_CORE_PUBLISHED_VERSION_UNVERIFIED');
});
test('Even an apparently safe full Agent is NO-GO pending independent admission',()=>{
 const x=assessParentCore({
  source:'MOCK_INDEPENDENT_PUBLISHED_GRAPH',verified:true,
  workflowId:CORE.id,activeVersionId:CORE.published,nodes:[]
 });
 assert.equal(x.directAgentAdmission,false);
 assert.equal(x.reason,'AGENT_PATH_UNREVIEWED_AND_NOT_ALLOWED');
});
test('Catalog query reads scoped existing child and never writes',async()=>{
 const {g,counts,getLast}=fixture();
 const r=await g.preview(catalog);
 assert.equal(counts.read,1);
 assert.equal(counts.invoke,1);
 assert.equal(getLast().workflowId,ROUTES.CATALOG_QUERY.id);
 assert.equal(getLast().requiredPublishedVersionId,ROUTES.CATALOG_QUERY.published);
 assert.equal(getLast().tenantId,'tenant_shared');
 assert.equal(getLast().storeId,'store_a');
 assert.deepEqual(r.products,[{name:'Sản phẩm QA',sku:'QA_A001',
  priceVnd:159000,stock:3,imageUrl:null}]);
 assert.equal(r.orderWrites,0);
 assert.equal(r.providerSends,0);
 assert.equal(g.directAgentAdmission,false);
 assert.equal(g.releaseState.realN8nExecuted,false);
});
test('Cart preview uses existing child tool, cannot confirm purchase',async()=>{
 const {g,getLast}=fixture();
 const r=await g.preview(cart);
 assert.equal(getLast().workflowId,ROUTES.CART_PREVIEW.id);
 assert.deepEqual(JSON.parse(getLast().cartJson),cart.items);
 assert.equal(r.subtotalVnd,318000);
 assert.equal(r.canConfirm,false);
 assert.equal(r.lineCount,1);
});
test('Platform Consultant uses fixed synthetic platform scope only',async()=>{
 const {g,getLast}=fixture({mode:'PLATFORM_CONSULTANT',scope:PLAT});
 await g.preview(catalog);
 assert.equal(getLast().tenantId,'platform_demo');
 assert.equal(getLast().storeId,'platform_demo_store');
});
test('Platform mode cannot bind an arbitrary merchant store',()=>{
 assert.throws(()=>fixture({mode:'PLATFORM_CONSULTANT',
  scope:{...SCOPE,mode:'PLATFORM_CONSULTANT'}}),
  e=>e.code==='PLATFORM_MODE_PRIVATE_STORE_DENIED');
});
test('Merchant Sandbox requires owner-approved synthetic scope',()=>{
 assert.throws(()=>fixture({scope:{...SCOPE,merchantOwnerApprovedSandbox:false}}),
  e=>e.code==='MERCHANT_SANDBOX_OWNER_GATE_DENIED');
 assert.throws(()=>fixture({scope:{...SCOPE,productionStore:true}}),
  e=>e.code==='MERCHANT_SANDBOX_OWNER_GATE_DENIED');
});
test('Untrusted browser marker, client role or forged Store is denied',()=>{
 for(const bad of [
  {source:'BROWSER_BODY'},{verified:false},
  {sandboxOnly:false},{customerAuthenticated:true},
  {privateOrdersAllowed:true},{writeAllowed:true},
  {sendAllowed:true},{tenantId:'bad bad'},{widgetId:'x'}
 ]){
  assert.throws(()=>fixture({scope:{...SCOPE,...bad}}),
   e=>e.code==='SERVER_SANDBOX_SCOPE_NOT_ATTESTED');
 }
});
test('Any extra browser tenant/store/role/action fields denied before read',async()=>{
 const {g,counts}=fixture();
 for(const extra of [
  {tenantId:'tenant_shared'},{storeId:'store_a'},{role:'owner'},
  {action:'ORDER_CREATE'},{customerId:'fake'},{workflowId:CORE.id},
  {authenticated:true},{expected_total:159000},
  {tool:'Create Sandbox Ticket'},{confirmed:true}
 ]){
  await reject(g.preview({...catalog,...extra}),'BROWSER_REQUEST_NOT_READONLY');
 }
 assert.equal(counts.read,0);assert.equal(counts.invoke,0);
});
test('Unknown tool, order cancel, write, prompt tool execution denied',async()=>{
 const {g,counts}=fixture();
 for(const op of ['CREATE_ORDER','ORDER_STATUS','SUPPORT_TICKET',
   'UPDATE_STOCK','DISPATCH_MESSAGE','AGENT_CHAT','DIRECT_CORE_AGENT']){
  await reject(g.preview({operation:op,query:'hello'}),
   'BROWSER_REQUEST_NOT_READONLY');
 }
 assert.equal(counts.invoke,0);
});
test('Invalid catalog query denied before snapshot read',async()=>{
 const {g,counts}=fixture();
 for(const query of ['',null,'x'.repeat(241),'anything\nexfil']){
  await reject(g.preview({operation:'CATALOG_QUERY',query}),
   'CATALOG_QUERY_INVALID');
 }
 assert.equal(counts.read,0);
});
test('No third-party Origin or session string proves shop identity',async()=>{
 const {g,counts}=fixture();
 await reject(g.preview({...catalog,origin:'https://shop-a.qa.invalid'}),
  'BROWSER_REQUEST_NOT_READONLY');
 await reject(g.preview({...catalog,session:'T404W1_FAKE'}),
  'BROWSER_REQUEST_NOT_READONLY');
 assert.equal(counts.read,0);
});
test('Cart with zero, duplicate, negative, fractional or too many rows denied',async()=>{
 const {g,counts}=fixture();
 for(const items of [
  [],null,[{sku:'QA_A001',quantity:0}],
  [{sku:'QA_A001',quantity:-1}],
  [{sku:'QA_A001',quantity:0.5}],
  [{sku:'QA_A001',quantity:100}],
  [{sku:'QA_A001',quantity:2},{sku:'QA_A001',quantity:3}],
  Array.from({length:11},(_,i)=>({sku:'SKU_'+i,quantity:1})),
  [{sku:'QA_A001',quantity:2,unitPrice:0}]
 ]){
  await reject(g.preview({operation:'CART_PREVIEW',items}),
   'CART_PREVIEW_ITEMS_INVALID');
 }
 assert.equal(counts.read,0);
});
test('Published catalog+cart graph shape matches verified safe query path',()=>{
 assert.equal(graphVerified(graph('CATALOG_QUERY'),'CATALOG_QUERY').readOnlyGraphVerified,true);
 assert.equal(graphVerified(graph('CART_PREVIEW'),'CART_PREVIEW').readOnlyGraphVerified,true);
});
test('Unpublished draft or wrong workflow refuses admission',()=>{
 const {g,counts}=fixture({editGraph:s=>({...s,activeVersionId:'draft-version'})});
 await reject(g.preview(catalog),'PUBLISHED_GRAPH_VERSION_UNVERIFIED');
 assert.equal(counts.invoke,0);
});
test('Cross-child graph forgery cannot admit wrong operation',()=>{
 const {g,counts}=fixture({editGraph:s=>({...s,workflowId:ROUTES.CART_PREVIEW.id})});
 await reject(g.preview(catalog),'PUBLISHED_GRAPH_VERSION_UNVERIFIED');
 assert.equal(counts.invoke,0);
});
test('Unknown and false snapshots never attest to published Core',async()=>{
 const cases=[{},null,{...graph('CATALOG_QUERY'),verified:false},
  {...graph('CATALOG_QUERY'),active:false},
  {...graph('CATALOG_QUERY'),source:'BROWSER_BODY'}];
 for(const c of cases){
  const {g,counts}=fixture({editGraph:()=>c});
  await reject(g.preview(catalog),'PUBLISHED_GRAPH_VERSION_UNVERIFIED');
  assert.equal(counts.invoke,0);
 }
});
test('Mutated Data Table GET → INSERT or UPDATE is blocked',async()=>{
 for(const operation of ['insert','update','delete','upsert','execute']){
  const {g,counts}=fixture({editGraph:s=>({
   ...s,nodes:s.nodes.map(n=>n.name==='Read Tenant Catalog'?
    {...n,operation}:n)
  })});
  await reject(g.preview(catalog),'DATA_TABLE_READ_ONLY_REQUIRED');
  assert.equal(counts.invoke,0);
 }
});
test('Replaced resolver or embedded Agent/write tool blocked',async()=>{
 const cases=[
  s=>({...s,nodes:s.nodes.map(n=>n.name==='Resolve Channel Tenant'?
    {...n,workflowId:'evil_tool'}:n)}),
  s=>({...s,nodes:s.nodes.map(n=>n.name==='Read Tenant Catalog'?
    {...n,type:'n8n-nodes-base.httpRequest'}:n)}),
  s=>({...s,nodes:s.nodes.map(n=>n.name==='Read Tenant Catalog'?
    {...n,type:'@n8n/n8n-nodes-langchain.agent'}:n)})
 ];
 for(const change of cases){
  const {g,counts}=fixture({editGraph:change});
  await assert.rejects(g.preview(catalog));
  assert.equal(counts.invoke,0);
 }
});
test('Additional node or rerouted edge is fail-closed',async()=>{
 for(const editGraph of [
  s=>({...s,nodes:[...s.nodes,{name:'Extra',type:'n8n-nodes-base.code'}]}),
  s=>({...s,edges:[['Catalog Query Input','Read Tenant Catalog'],...s.edges.slice(1)]})
 ]){
  const {g,counts}=fixture({editGraph});
  await assert.rejects(g.preview(catalog));
  assert.equal(counts.invoke,0);
 }
});
test('Returned catalog must be verified, exact same tenant/store and no writes',async()=>{
 for(const alter of [
  {verified:false},{tenantId:'tenant_other'},
  {storeId:'store_b'},{writeAllowed:true},
  {providerSends:1},{orderWrites:1},{privateOrderAccess:true},
  {previewOnly:false},{operation:'CART_PREVIEW'},
  {source:'RAW_LLM'}
 ]){
  const {g}=fixture({editResult:r=>({...r,...alter})});
  await reject(g.preview(catalog),'CORE_CHILD_READBACK_NOT_AUTHORIZED');
 }
});
test('No cross-store price/stock or PII leaks via catalog response',async()=>{
 for(const badProduct of [
  {name:'FAKE',sku:'QA_A001',priceVnd:'159.000đ',stock:3,imageUrl:null},
  {name:'FAKE',sku:'QA_A001',priceVnd:159000.5,stock:3,imageUrl:null},
  {name:'FAKE',sku:'QA_A001',priceVnd:159000,stock:-1,imageUrl:null},
  {name:'FAKE',sku:'QA_A001',priceVnd:159000,stock:3,imageUrl:'https://untrusted.invalid/a.png'},
  {name:'FAKE',sku:'QA_A001',priceVnd:159000,stock:3,imageUrl:null,
   phone:'fake'}
 ]){
  const {g}=fixture({editResult:r=>({...r,products:[badProduct]})});
  // Extra raw fields do not survive; a safe product with PII is reconstructed.
  if('phone' in badProduct){
   const x=await g.preview(catalog);
   assert.equal(JSON.stringify(x).includes('phone'),false);
  }else{
   await reject(g.preview(catalog),'PUBLIC_CATALOG_INVALID');
  }
 }
});
test('Public catalog response strips malicious customer metadata',async()=>{
 const {g}=fixture({editResult:r=>({...r,phone:'synthetic_secret',
  customer_email:'synthetic_customer@example.invalid',
  products:r.products.map(p=>({...p,customerId:'not_forwarded'}))})});
 const res=await g.preview(catalog);
 const out=JSON.stringify(res);
 assert(!out.includes('synthetic_secret'));
 assert(!out.includes('customerId'));
 assert(!out.includes('example.invalid'));
});
test('Cart may not confirm order or invent subtotal',async()=>{
 for(const alter of [
  {canConfirm:true},{subtotalVnd:'318.000'},
  {subtotalVnd:-1},{lines:Array.from({length:11},()=>({}))}
 ]){
  const {g}=fixture({editResult:r=>({...r,...alter})});
  await reject(g.preview(cart),'PUBLIC_CART_PREVIEW_INVALID');
 }
});
test('Errors do not turn into successful readbacks',async()=>{
 const {g,counts}=fixture({editGraph:()=>{throw new Error('DISPOSABLE_QA_DOWN')}});
 await assert.rejects(g.preview(catalog));
 assert.equal(counts.invoke,0);
});
