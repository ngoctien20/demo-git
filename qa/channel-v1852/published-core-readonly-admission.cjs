'use strict';
/**
 * V18.5.2 — Published Commerce Core READ-ONLY admission proof.
 *
 * SOURCE ONLY, NOT A LIVE N8N ADAPTER. The only two permissible *candidate*
 * operations use EXISTING Core child tools, not a second AI:
 *   Catalog Query oOOXicKXGkBskKqh / Cart Preview igPOsSbEgd4NgtRA.
 * The parent Commerce AI Agent is NOT admitted because it can call the
 * write-capable support tickets workflow jirkuVts1AjIhnPJ.
 *
 * No HTTP, credentials, n8n execution, customer data, Orders, sends or writes.
 * All injected ports are synthetic for deterministic security regressions.
 */
const CORE=Object.freeze({
  id:'iyfGUiEsZlNTBWOR',
  published:'456862c9-e5ee-4bfa-9931-47dbc39ab73d',
  demoTicketWriter:'jirkuVts1AjIhnPJ'
});
const RESOLVER='5Eeh8hbpsoNhuiVo';
const ROUTES=Object.freeze({
  CATALOG_QUERY:Object.freeze({
    id:'oOOXicKXGkBskKqh',
    published:'e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696',
    edges:[
      ['Catalog Query Input','Resolve Channel Tenant'],
      ['Resolve Channel Tenant','Read Tenant Catalog'],
      ['Read Tenant Catalog','Rank and Return Safe Products']
    ],
    nodes:Object.freeze({
      'Catalog Query Input':'n8n-nodes-base.executeWorkflowTrigger',
      'Resolve Channel Tenant':'n8n-nodes-base.executeWorkflow',
      'Read Tenant Catalog':'n8n-nodes-base.dataTable',
      'Rank and Return Safe Products':'n8n-nodes-base.code'
    }),
    dataTable:'Read Tenant Catalog',
    resolver:'Resolve Channel Tenant',
    terminal:'Rank and Return Safe Products'
  }),
  CART_PREVIEW:Object.freeze({
    id:'igPOsSbEgd4NgtRA',
    published:'eff32e20-a6d0-4975-88b8-107eae752b4b',
    edges:[
      ['Cart Preview Input','Resolve Cart Tenant'],
      ['Resolve Cart Tenant','Read Cart Catalog'],
      ['Read Cart Catalog','Validate and Preview Cart']
    ],
    nodes:Object.freeze({
      'Cart Preview Input':'n8n-nodes-base.executeWorkflowTrigger',
      'Resolve Cart Tenant':'n8n-nodes-base.executeWorkflow',
      'Read Cart Catalog':'n8n-nodes-base.dataTable',
      'Validate and Preview Cart':'n8n-nodes-base.code'
    }),
    dataTable:'Read Cart Catalog',
    resolver:'Resolve Cart Tenant',
    terminal:'Validate and Preview Cart'
  })
});
const MODES=Object.freeze(['PLATFORM_CONSULTANT','MERCHANT_SANDBOX']);
const IDENTIFIER=/^[A-Za-z0-9_-]{2,90}$/;
const writeType=/\.(?:httpRequest|googleSheets|postgres|mysql|executeCommand|file|ssh)$/i;
const codeControl=/[\u0000-\u001f\u007f]/;
const browserAllowed=Object.freeze({
  CATALOG_QUERY:['operation','query'],
  CART_PREVIEW:['operation','items']
});
function denied(code){const e=new Error(code);e.code=code;throw e;}
function plain(obj) {
  return obj!==null && typeof obj==='object' &&
    !Array.isArray(obj) && (Object.getPrototypeOf(obj)===Object.prototype ||
    Object.getPrototypeOf(obj)===null);
}
function exactKeys(obj,allowed) {
  return plain(obj)&&Object.keys(obj).every(k=>allowed.includes(k))&&
    Object.getOwnPropertySymbols(obj).length===0;
}
function validId(x){return typeof x==='string'&&IDENTIFIER.test(x)}
function checkScope(scope,mode){
  // Factory accepts ONLY a server-owned synthetic scope. A real hosted flow
  // needs proof from independently verified installation/domain/entitlement.
  if(!plain(scope)||scope.source!=='SERVER_REVIEWED_SYNTHETIC_WIDGET_SCOPE'||
    scope.verified!==true||scope.sandboxOnly!==true||
    scope.customerAuthenticated!==false||
    scope.privateOrdersAllowed!==false||scope.writeAllowed!==false||
    scope.sendAllowed!==false||!validId(scope.tenantId)||!validId(scope.storeId)||
    !validId(scope.widgetId)||scope.mode!==mode)
    denied('SERVER_SANDBOX_SCOPE_NOT_ATTESTED');
  if(mode==='PLATFORM_CONSULTANT'){
    if(scope.tenantId!=='platform_demo'||scope.storeId!=='platform_demo_store')
      denied('PLATFORM_MODE_PRIVATE_STORE_DENIED');
  }else if(scope.merchantOwnerApprovedSandbox!==true||
    scope.productionStore===true)denied('MERCHANT_SANDBOX_OWNER_GATE_DENIED');
  return Object.freeze({
    tenantId:scope.tenantId,storeId:scope.storeId,widgetId:scope.widgetId,
    mode,sandboxOnly:true,customerAuthenticated:false
  });
}
function graphVerified(snapshot,operation){
  const route=ROUTES[operation];
  if(!route)denied('OPERATION_NOT_IN_READONLY_ALLOWLIST');
  // This marker comes only from mocked test port in this source-only module.
  // The string itself MUST NOT be promoted to hosted trust without a real
  // n8n server-to-server read and exact immutable Published version proof.
  if(!plain(snapshot)||snapshot.source!=='MOCK_INDEPENDENT_PUBLISHED_GRAPH'||
     snapshot.verified!==true||snapshot.active!==true||
     snapshot.workflowId!==route.id||snapshot.activeVersionId!==route.published||
     !Array.isArray(snapshot.nodes)||!Array.isArray(snapshot.edges))
    denied('PUBLISHED_GRAPH_VERSION_UNVERIFIED');
  if(snapshot.nodes.length!==5||snapshot.edges.length!==3)
    denied('PUBLISHED_GRAPH_SHAPE_CHANGED');
  const seen=new Set();
  for(const node of snapshot.nodes){
    if(!plain(node)||typeof node.name!=='string'||seen.has(node.name)||
      typeof node.type!=='string')denied('PUBLISHED_GRAPH_SHAPE_CHANGED');
    seen.add(node.name);
    const expected=route.nodes[node.name];
    if(expected){
      if(node.type!==expected)denied('READONLY_NODE_TYPE_CHANGED');
    }else if(node.type!=='n8n-nodes-base.stickyNote')
      denied('UNREVIEWED_NODE_ADDED');
    if(node.name===route.dataTable &&
      (node.operation!=='get'||node.resource!=='row'))
      denied('DATA_TABLE_READ_ONLY_REQUIRED');
    if(node.name===route.resolver &&
       (node.workflowId!==RESOLVER||node.type!=='n8n-nodes-base.executeWorkflow'))
      denied('TENANT_RESOLVER_BINDING_CHANGED');
    if(writeType.test(node.type)||node.type.includes('langchain.agent')||
       node.type.includes('toolWorkflow'))denied('WRITE_CAPABLE_NODE_DENIED');
  }
  for(const n of Object.keys(route.nodes))if(!seen.has(n))
    denied('PUBLISHED_REQUIRED_NODE_MISSING');
  const actual=snapshot.edges.map(x=>Array.isArray(x)&&x.length===2?x.join('>'):'!INVALID!').sort();
  const expected=route.edges.map(x=>x.join('>')).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    denied('PUBLISHED_READ_PATH_CHANGED');
  return Object.freeze({operation,workflowId:route.id,
    pinnedPublishedVersionId:route.published,readOnlyGraphVerified:true});
}
function assessParentCore(snapshot){
  // Even if a later AI Agent removes write-capable tools, this function stays
  // deliberately NO-GO until separately approved by an independent reviewer.
  if(!plain(snapshot)||snapshot.source!=='MOCK_INDEPENDENT_PUBLISHED_GRAPH'||
    snapshot.verified!==true||snapshot.workflowId!==CORE.id||
    snapshot.activeVersionId!==CORE.published||!Array.isArray(snapshot.nodes))
    denied('PARENT_CORE_PUBLISHED_VERSION_UNVERIFIED');
  const hasWriteTool=snapshot.nodes.some(x=>
    x?.name==='Create Sandbox Ticket'&&
    x?.type==='@n8n/n8n-nodes-langchain.toolWorkflow'&&
    x?.workflowId===CORE.demoTicketWriter
  );
  return Object.freeze({
    coreWorkflowId:CORE.id,
    publishedVersionId:CORE.published,
    directAgentAdmission:false,
    reason:hasWriteTool?'AGENT_HAS_REACHABLE_TICKET_WRITE_TOOL':
      'AGENT_PATH_UNREVIEWED_AND_NOT_ALLOWED',
    allowedOnly:['CATALOG_QUERY','CART_PREVIEW'],
    realN8nInvocations:0
  });
}
function validateBrowserInput(data){
  if(!plain(data)||!ROUTES[data.operation]||
     !exactKeys(data,browserAllowed[data.operation]))
    denied('BROWSER_REQUEST_NOT_READONLY');
  if(data.operation==='CATALOG_QUERY'){
    if(typeof data.query!=='string'||!data.query.trim()||
      data.query.length>240||codeControl.test(data.query))
      denied('CATALOG_QUERY_INVALID');
    return Object.freeze({operation:data.operation,query:data.query.trim()});
  }
  const items=data.items;
  if(!Array.isArray(items)||items.length<1||items.length>10)
    denied('CART_PREVIEW_ITEMS_INVALID');
  const normalized=[],seen=new Set();
  for(const item of items){
    if(!exactKeys(item,['sku','quantity'])||
      typeof item.sku!=='string'||!/^[A-Za-z0-9_-]{2,50}$/.test(item.sku)||
      !Number.isSafeInteger(item.quantity)||item.quantity<1||
      item.quantity>99||seen.has(item.sku))
      denied('CART_PREVIEW_ITEMS_INVALID');
    seen.add(item.sku);
    normalized.push(Object.freeze({sku:item.sku,quantity:item.quantity}));
  }
  return Object.freeze({operation:data.operation,items:Object.freeze(normalized)});
}
function publicResponse(result,scope,operation){
  if(!plain(result)||result.source!=='MOCK_SCOPED_PUBLIC_CORE_CHILD_READBACK'||
    result.verified!==true||result.operation!==operation||
    result.tenantId!==scope.tenantId||result.storeId!==scope.storeId||
    result.writeAllowed!==false||result.privateOrderAccess!==false||
    result.providerSends!==0||result.orderWrites!==0||
    result.previewOnly!==true)
    denied('CORE_CHILD_READBACK_NOT_AUTHORIZED');
  if(operation==='CATALOG_QUERY'){
    if(!Array.isArray(result.products)||result.products.length>10)
      denied('PUBLIC_CATALOG_INVALID');
    const products=[];
    for(const product of result.products){
      if(!plain(product)||typeof product.name!=='string'||
        !product.name.trim()||product.name.length>100||
        typeof product.sku!=='string'||!/^[A-Za-z0-9_-]{2,50}$/.test(product.sku)||
        !Number.isSafeInteger(product.priceVnd)||product.priceVnd<0||
        !Number.isSafeInteger(product.stock)||product.stock<0||
        !(product.imageUrl===null||product.imageUrl===undefined))
        denied('PUBLIC_CATALOG_INVALID');
      products.push(Object.freeze({name:product.name,sku:product.sku,
        priceVnd:product.priceVnd,stock:product.stock,imageUrl:null}));
    }
    return Object.freeze({operation,previewOnly:true,orderWrites:0,
      providerSends:0,privateOrderAccess:false,products:Object.freeze(products)});
  }
  if(!Array.isArray(result.lines)||result.lines.length>10||
    !Number.isSafeInteger(result.subtotalVnd)||result.subtotalVnd<0||
    result.canConfirm!==false)
    denied('PUBLIC_CART_PREVIEW_INVALID');
  return Object.freeze({operation,previewOnly:true,orderWrites:0,
    providerSends:0,privateOrderAccess:false,canConfirm:false,
    subtotalVnd:result.subtotalVnd,
    lineCount:result.lines.length});
}
function createOfflinePublishedCoreAdmission({
  qaMode='DENY',mode,serverScope,readPublishedGraph,
  invokeExistingReadOnlyChild
}={}){
  if(qaMode!=='OFFLINE_SYNTHETIC_QA'||!MODES.includes(mode)||
    typeof readPublishedGraph!=='function'||
    typeof invokeExistingReadOnlyChild!=='function')
    denied('HOSTED_N8N_ADMISSION_NOT_APPROVED');
  const scope=checkScope(serverScope,mode);
  return Object.freeze({
    coreWorkflowId:CORE.id,mode,pinnedCorePublished:CORE.published,
    directAgentAdmission:false,
    async preview(input){
      const query=validateBrowserInput(input);
      const route=ROUTES[query.operation];
      const graph=await readPublishedGraph({workflowId:route.id,
        requireActiveVersionId:route.published,publicOnly:true});
      const admission=graphVerified(graph,query.operation);
      // No general agent invocation. Only a mocked existing Catalog/Cart
      // child in offline QA. Real authenticated caller still NOT admitted.
      const result=await invokeExistingReadOnlyChild(Object.freeze({
        operation:query.operation,workflowId:admission.workflowId,
        requiredPublishedVersionId:admission.pinnedPublishedVersionId,
        parentCoreId:CORE.id,parentCorePublishedVersionId:CORE.published,
        tenantId:scope.tenantId,storeId:scope.storeId,widgetId:scope.widgetId,
        channel:'WEB_WIDGET',mode,readOnly:true,publicOnly:true,sandboxOnly:true,
        orderWritesAllowed:false,providerSendsAllowed:false,
        privateOrderAccess:false,
        ...(query.operation==='CATALOG_QUERY'?{query:query.query}:
          {cartJson:JSON.stringify(query.items)})
      }));
      return publicResponse(result,scope,query.operation);
    },
    releaseState:Object.freeze({
      sourceOnly:true,realN8nExecuted:false,hostedGatewayInstalled:false,
      parentAgentToolAllowlistVerified:false,realStoreDataAccess:false,
      realOrdersRead:0,realOrdersWritten:0,realProviderSends:0,
      productionReady:false
    })
  });
}
module.exports={CORE,RESOLVER,ROUTES,MODES,graphVerified,assessParentCore,
  createOfflinePublishedCoreAdmission};
