import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start V18.5.5 Manual Read-Only QA', position: [240, 600] },
  output: [{}]
});

const materialsCatalog = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: '01 Materials Catalog Search',
    position: [560, 80],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' },
      workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'xi măng', limit: 5, requestId: 'v1855-qa-01-catalog', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] },
      mode: 'once',
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ success: true, operation: 'catalog.search', environment: 'sandbox', products: [{ sku: 'VL-101' }], canWrite: false, canConfirm: false }]
});
const assertMaterialsCatalog = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Materials Catalog Result', position: [860, 80], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==true||r.operation!=='catalog.search'||!Array.isArray(r.products)||!r.products.some(p=>p.sku==='VL-101')||r.canWrite!==false||r.canConfirm!==false||r.privateOrderAccess!==false) throw new Error('materials_catalog_contract_failed'); return [{json:{case:'materials_catalog',pass:true,productCount:r.products.length,readOnly:r.readOnly,canWrite:r.canWrite}}];" } },
  output: [{ case: 'materials_catalog', pass: true, productCount: 1, readOnly: true, canWrite: false }]
});

const materialsCart = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '02 Materials Cart Preview', position: [560, 200], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cartJson: '[{"sku":"VL-101","quantity":3}]', requestId: 'v1855-qa-02-cart', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'cartJson', displayName: 'cartJson', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: true, operation: 'cart.preview', environment: 'sandbox', subtotalVnd: 237000, previewOnly: true, canConfirm: false, canWrite: false }]
});
const assertMaterialsCart = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Materials Cart Preview', position: [860, 200], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==true||r.operation!=='cart.preview'||r.subtotalVnd!==237000||r.previewOnly!==true||r.canConfirm!==false||r.canWrite!==false||r.privateOrderAccess!==false) throw new Error('materials_cart_contract_failed'); return [{json:{case:'materials_cart',pass:true,subtotalVnd:r.subtotalVnd,previewOnly:r.previewOnly,canWrite:r.canWrite}}];" } },
  output: [{ case: 'materials_cart', pass: true, subtotalVnd: 237000, previewOnly: true, canWrite: false }]
});

const groceryCatalog = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '03 Grocery Catalog Search', position: [560, 320], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-grocery-sandbox', operation: 'catalog.search', query: 'mì gói vị bò', limit: 5, requestId: 'v1855-qa-03-grocery', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: true, operation: 'catalog.search', environment: 'sandbox', products: [{ sku: 'TG-101' }], canWrite: false }]
});
const assertGroceryCatalog = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Grocery Catalog Result', position: [860, 320], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==true||r.operation!=='catalog.search'||!Array.isArray(r.products)||!r.products.some(p=>p.sku==='TG-101')||r.canWrite!==false||r.canConfirm!==false) throw new Error('grocery_catalog_contract_failed'); return [{json:{case:'grocery_catalog',pass:true,productCount:r.products.length,canWrite:r.canWrite}}];" } },
  output: [{ case: 'grocery_catalog', pass: true, productCount: 1, canWrite: false }]
});

const groceryCart = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '04 Grocery Cart Preview', position: [560, 440], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-grocery-sandbox', operation: 'cart.preview', cartJson: '[{"sku":"TG-101","quantity":2}]', requestId: 'v1855-qa-04-grocery-cart', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'cartJson', displayName: 'cartJson', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: true, operation: 'cart.preview', environment: 'sandbox', subtotalVnd: 9000, previewOnly: true, canConfirm: false, canWrite: false }]
});
const assertGroceryCart = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Grocery Cart Preview', position: [860, 440], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==true||r.operation!=='cart.preview'||r.subtotalVnd!==9000||r.previewOnly!==true||r.canConfirm!==false||r.canWrite!==false) throw new Error('grocery_cart_contract_failed'); return [{json:{case:'grocery_cart',pass:true,subtotalVnd:r.subtotalVnd,previewOnly:r.previewOnly,canWrite:r.canWrite}}];" } },
  output: [{ case: 'grocery_cart', pass: true, subtotalVnd: 9000, previewOnly: true, canWrite: false }]
});

const crossTenant = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '05 Materials Cannot Read Grocery SKU', position: [560, 560], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'TG-101', limit: 5, requestId: 'v1855-qa-05-isolation', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: true, operation: 'catalog.search', environment: 'sandbox', products: [], canWrite: false }]
});
const assertCrossTenant = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Cross-Tenant SKU Is Hidden', position: [860, 560], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==true||!Array.isArray(r.products)||r.products.length!==0||r.canWrite!==false) throw new Error('cross_tenant_catalog_leak'); return [{json:{case:'cross_tenant_sku_hidden',pass:true,productsReturned:r.products.length}}];" } },
  output: [{ case: 'cross_tenant_sku_hidden', pass: true, productsReturned: 0 }]
});

const forgedAuthority = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '06 Reject Forged Tenant Store Account', position: [1160, 80], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'TG-101', limit: 5, requestId: 'v1855-qa-06-forged', issuedAt: expr('{{ $now.toMillis() }}'), accountId: 'demo-grocery-website', channelType: 'website', tenantId: 'demo_grocery_qa', storeId: 'store-b' }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }, { id: 'accountId', displayName: 'accountId', type: 'string' }, { id: 'channelType', displayName: 'channelType', type: 'string' }, { id: 'tenantId', displayName: 'tenantId', type: 'string' }, { id: 'storeId', displayName: 'storeId', type: 'string' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'caller_authority_fields_forbidden', canWrite: false }]
});
const assertForgedAuthority = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Forged Authority Rejected', position: [1460, 80], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='caller_authority_fields_forbidden'||r.canWrite!==false) throw new Error('forged_authority_not_rejected'); return [{json:{case:'forged_authority_rejected',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'forged_authority_rejected', pass: true, reason: 'caller_authority_fields_forbidden' }]
});

const unknownInstall = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '07 Reject Unknown Installation', position: [1160, 200], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'unregistered-website-qa', operation: 'catalog.search', query: '*', limit: 5, requestId: 'v1855-qa-07-unknown', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'unknown_installation', canWrite: false }]
});
const assertUnknownInstall = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Unknown Installation Rejected', position: [1460, 200], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='unknown_installation') throw new Error('unknown_installation_not_rejected'); return [{json:{case:'unknown_installation_rejected',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'unknown_installation_rejected', pass: true, reason: 'unknown_installation' }]
});

const orderRead = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '08 Deny Private Order Read', position: [1160, 320], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'order.read', requestId: 'v1855-qa-08-order-read', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'operation_not_allowed', canWrite: false }]
});
const assertOrderRead = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Private Order Read Denied', position: [1460, 320], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='operation_not_allowed'||r.privateOrderAccess!==false) throw new Error('private_order_read_not_denied'); return [{json:{case:'private_order_read_denied',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'private_order_read_denied', pass: true, reason: 'operation_not_allowed' }]
});

const orderCreate = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '09 Deny Order Creation', position: [1160, 440], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'order.create', requestId: 'v1855-qa-09-order-create', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'operation_not_allowed', canWrite: false }]
});
const assertOrderCreate = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Order Creation Denied', position: [1460, 440], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='operation_not_allowed'||r.canWrite!==false) throw new Error('order_creation_not_denied'); return [{json:{case:'order_creation_denied',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'order_creation_denied', pass: true, reason: 'operation_not_allowed' }]
});

const invalidCart = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '10 Reject Invalid Cart JSON', position: [1160, 560], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cartJson: 'not-json', requestId: 'v1855-qa-10-invalid-cart', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'cartJson', displayName: 'cartJson', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'invalid_cart_json', canWrite: false }]
});
const assertInvalidCart = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Invalid Cart Rejected', position: [1460, 560], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='invalid_cart_json') throw new Error('invalid_cart_not_rejected'); return [{json:{case:'invalid_cart_rejected',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'invalid_cart_rejected', pass: true, reason: 'invalid_cart_json' }]
});

const staleRequest = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '11 Reject Stale Request Timestamp', position: [1760, 80], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: '*', limit: 5, requestId: 'v1855-qa-11-stale', issuedAt: expr('{{ $now.minus(2, "minutes").toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'query', displayName: 'query', type: 'string' }, { id: 'limit', displayName: 'limit', type: 'number' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'request_timestamp_expired', canWrite: false }]
});
const assertStaleRequest = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Stale Request Rejected', position: [2060, 80], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='request_timestamp_expired') throw new Error('stale_request_not_rejected'); return [{json:{case:'stale_request_rejected',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'stale_request_rejected', pass: true, reason: 'request_timestamp_expired' }]
});

const duplicateSku = node({
  type: 'n8n-nodes-base.executeWorkflow', version: 1.3,
  config: { name: '12 Reject Duplicate Cart SKU', position: [1760, 200], parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rYwrJfJavcaZcjUI', cachedResultName: 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter' }, workflowInputs: { mappingMode: 'defineBelow', value: { installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cartJson: '[{"sku":"VL-101","quantity":1},{"sku":"VL-101","quantity":2}]', requestId: 'v1855-qa-12-duplicate', issuedAt: expr('{{ $now.toMillis() }}') }, schema: [{ id: 'installationId', displayName: 'installationId', type: 'string' }, { id: 'operation', displayName: 'operation', type: 'string' }, { id: 'cartJson', displayName: 'cartJson', type: 'string' }, { id: 'requestId', displayName: 'requestId', type: 'string' }, { id: 'issuedAt', displayName: 'issuedAt', type: 'number' }] }, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ success: false, reason: 'duplicate_sku', canWrite: false }]
});
const assertDuplicateSku = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Assert Duplicate Cart SKU Rejected', position: [2060, 200], parameters: { mode: 'runOnceForAllItems', jsCode: "const r=$input.first().json||{}; if(r.success!==false||r.reason!=='duplicate_sku') throw new Error('duplicate_sku_not_rejected'); return [{json:{case:'duplicate_sku_rejected',pass:true,reason:r.reason}}];" } },
  output: [{ case: 'duplicate_sku_rejected', pass: true, reason: 'duplicate_sku' }]
});

export default workflow('t404-v1855-protected-readonly-adapter-qa', 'TIEN404 V18.5.5 Protected Read-Only Adapter QA')
  .add(start)
  .to(materialsCatalog.to(assertMaterialsCatalog))
  .add(start)
  .to(materialsCart.to(assertMaterialsCart))
  .add(start)
  .to(groceryCatalog.to(assertGroceryCatalog))
  .add(start)
  .to(groceryCart.to(assertGroceryCart))
  .add(start)
  .to(crossTenant.to(assertCrossTenant))
  .add(start)
  .to(forgedAuthority.to(assertForgedAuthority))
  .add(start)
  .to(unknownInstall.to(assertUnknownInstall))
  .add(start)
  .to(orderRead.to(assertOrderRead))
  .add(start)
  .to(orderCreate.to(assertOrderCreate))
  .add(start)
  .to(invalidCart.to(assertInvalidCart))
  .add(start)
  .to(staleRequest.to(assertStaleRequest))
  .add(start)
  .to(duplicateSku.to(assertDuplicateSku))
  .group('01 Materials Catalog', [materialsCatalog, assertMaterialsCatalog], { description: 'Checks materials Sandbox catalog search through the protected adapter.' })
  .group('02 Materials Cart', [materialsCart, assertMaterialsCart], { description: 'Checks a non-confirmable materials cart preview through the protected adapter.' })
  .group('03 Grocery Catalog', [groceryCatalog, assertGroceryCatalog], { description: 'Checks grocery Sandbox catalog search through the protected adapter.' })
  .group('04 Grocery Cart', [groceryCart, assertGroceryCart], { description: 'Checks a non-confirmable grocery cart preview through the protected adapter.' })
  .group('05 Cross Tenant Isolation', [crossTenant, assertCrossTenant], { description: 'Ensures a materials installation cannot retrieve a grocery SKU.' })
  .group('06 Forged Authority Denial', [forgedAuthority, assertForgedAuthority], { description: 'Rejects caller-supplied account, tenant and store authority fields.' })
  .group('07 Unknown Installation Denial', [unknownInstall, assertUnknownInstall], { description: 'Rejects an installation not present in the server-side registry.' })
  .group('08 Private Order Read Denial', [orderRead, assertOrderRead], { description: 'Rejects all private order reads.' })
  .group('09 Order Write Denial', [orderCreate, assertOrderCreate], { description: 'Rejects all order creation operations.' })
  .group('10 Invalid Cart Denial', [invalidCart, assertInvalidCart], { description: 'Rejects malformed cart payloads before invoking Commerce tools.' })
  .group('11 Stale Request Denial', [staleRequest, assertStaleRequest], { description: 'Rejects requests outside the 60-second timestamp window.' })
  .group('12 Duplicate SKU Denial', [duplicateSku, assertDuplicateSku], { description: 'Rejects duplicate SKUs in a cart preview.' });
