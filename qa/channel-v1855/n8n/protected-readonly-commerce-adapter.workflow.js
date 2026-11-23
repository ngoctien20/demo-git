import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const adapterInput = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Protected Adapter Internal Input',
    position: [240, 320],
    parameters: {
      workflowInputs: {
        values: [
          { name: 'installationId', type: 'string' },
          { name: 'operation', type: 'string' },
          { name: 'query', type: 'string' },
          { name: 'limit', type: 'number' },
          { name: 'cartJson', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'issuedAt', type: 'number' },
          { name: 'accountId', type: 'string' },
          { name: 'channelType', type: 'string' },
          { name: 'tenantId', type: 'string' },
          { name: 'storeId', type: 'string' },
          { name: 'customerId', type: 'string' },
          { name: 'orderId', type: 'string' }
        ]
      }
    }
  },
  output: [{ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'xi măng', limit: 5, requestId: 'v1855-qa-01-catalog', issuedAt: 1795000000000 }]
});

const validateRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Trusted Installation and Read Scope',
    position: [520, 320],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const input = $input.first().json || {};\n" +
        "const clean = v => String(v ?? '').trim();\n" +
        "const fail = reason => [{ json: { allowed: false, success: false, reason, operation: clean(input.operation).slice(0, 40), installationId: clean(input.installationId).slice(0, 80), requestId: clean(input.requestId).slice(0, 80), environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false } }];\n" +
        "const forbidden = ['accountId','channelType','tenantId','storeId','customerId','orderId'];\n" +
        "for (const key of forbidden) if (input[key] !== undefined && input[key] !== null && clean(input[key]) !== '') return fail('caller_authority_fields_forbidden');\n" +
        "const installationId = clean(input.installationId);\n" +
        "const installations = { 'v1855-materials-sandbox': { channelType: 'website', accountId: 'demo-materials-website' }, 'v1855-grocery-sandbox': { channelType: 'website', accountId: 'demo-grocery-website' } };\n" +
        "const installation = installations[installationId];\n" +
        "if (!installation) return fail('unknown_installation');\n" +
        "const operation = clean(input.operation);\n" +
        "if (!['catalog.search','cart.preview'].includes(operation)) return fail('operation_not_allowed');\n" +
        "const requestId = clean(input.requestId);\n" +
        "if (!/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) return fail('invalid_request_id');\n" +
        "const issuedAt = Number(input.issuedAt);\n" +
        "if (!Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > 60000) return fail('request_timestamp_expired');\n" +
        "if (operation === 'catalog.search') {\n" +
        "  const query = clean(input.query); const limit = Number(input.limit ?? 5);\n" +
        "  if (!query || query.length > 240 || !Number.isInteger(limit) || limit < 1 || limit > 8) return fail('invalid_catalog_query');\n" +
        "  return [{ json: { allowed: true, operation, installationId, channelType: installation.channelType, accountId: installation.accountId, query, limit, requestId, environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false } }];\n" +
        "}\n" +
        "let cart; try { cart = typeof input.cartJson === 'string' ? JSON.parse(input.cartJson) : input.cartJson; } catch { return fail('invalid_cart_json'); }\n" +
        "if (!Array.isArray(cart) || cart.length < 1 || cart.length > 30) return fail('invalid_cart_size');\n" +
        "const seen = new Set(); const items = [];\n" +
        "for (const line of cart) { const sku = clean(line?.sku); const quantity = Number(line?.quantity); if (!sku || sku.length > 64 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 50000 || Math.round(quantity * 1000) !== quantity * 1000) return fail('invalid_cart_line'); if (seen.has(sku)) return fail('duplicate_sku'); seen.add(sku); items.push({ sku, quantity }); }\n" +
        "return [{ json: { allowed: true, operation, installationId, channelType: installation.channelType, accountId: installation.accountId, cartJson: JSON.stringify(items), requestId, environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false } }];"
    }
  },
  output: [{ allowed: true, operation: 'catalog.search', installationId: 'v1855-materials-sandbox', channelType: 'website', accountId: 'demo-materials-website', query: 'xi măng', limit: 5, requestId: 'v1855-qa-01-catalog', environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false }]
});

const isAllowed = ifElse({
  version: 2.2,
  config: {
    name: 'Trusted Read Request Accepted?',
    position: [820, 320],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.allowed }}'), operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and'
      }
    }
  },
  output: [{ allowed: true }]
});

const isCatalog = ifElse({
  version: 2.2,
  config: {
    name: 'Catalog Search Operation?',
    position: [1100, 180],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.operation }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'catalog.search' }],
        combinator: 'and'
      }
    }
  },
  output: [{ operation: 'catalog.search' }]
});

const catalogQuery = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Call Existing Published Catalog Query',
    position: [1400, 100],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'oOOXicKXGkBskKqh', cachedResultName: 'TIEN404_COMMERCE_CATALOG_QUERY' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          channelType: expr('{{ $json.channelType }}'),
          accountId: expr('{{ $json.accountId }}'),
          query: expr('{{ $json.query }}'),
          limit: expr('{{ $json.limit }}')
        },
        schema: [
          { id: 'channelType', displayName: 'channelType', type: 'string' },
          { id: 'accountId', displayName: 'accountId', type: 'string' },
          { id: 'query', displayName: 'query', type: 'string' },
          { id: 'limit', displayName: 'limit', type: 'number' }
        ]
      },
      mode: 'once',
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ success: true, shopName: 'Materials Sandbox', environment: 'sandbox', products: [], count: 0, canWrite: false }]
});

const formatCatalog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Return Safe Catalog Result',
    position: [1700, 100],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const raw = $input.first().json || {};\n" +
        "const request = $('Validate Trusted Installation and Read Scope').first().json || {};\n" +
        "const products = Array.isArray(raw.products) ? raw.products.slice(0, 8).map(p => ({ sku: String(p.sku ?? '').slice(0, 64), name: String(p.name ?? '').slice(0, 180), category: String(p.category ?? '').slice(0, 80), unit: String(p.unit ?? '').slice(0, 30), priceVnd: Number.isSafeInteger(Number(p.priceVnd)) && Number(p.priceVnd) >= 0 ? Number(p.priceVnd) : null, stock: Number.isSafeInteger(Number(p.stock)) && Number(p.stock) >= 0 ? Number(p.stock) : null, attributes: p.attributes && typeof p.attributes === 'object' ? p.attributes : {} })) : [];\n" +
        "return [{ json: { success: raw.success === true, operation: 'catalog.search', environment: 'sandbox', shopName: String(raw.shopName ?? '').slice(0, 120), products, count: products.length, limited: raw.limited === true, note: String(raw.note ?? 'Dữ liệu Sandbox; chưa có giao dịch thật.').slice(0, 240), requestId: request.requestId, readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false } }];"
    }
  },
  output: [{ success: true, operation: 'catalog.search', environment: 'sandbox', shopName: 'Materials Sandbox', products: [], count: 0, requestId: 'v1855-qa-01-catalog', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false }]
});

const isCart = ifElse({
  version: 2.2,
  config: {
    name: 'Cart Preview Operation?',
    position: [1400, 420],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.operation }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'cart.preview' }],
        combinator: 'and'
      }
    }
  },
  output: [{ operation: 'cart.preview' }]
});

const cartPreview = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Call Existing Published Cart Preview',
    position: [1700, 360],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'igPOsSbEgd4NgtRA', cachedResultName: 'TIEN404_COMMERCE_CART_PREVIEW' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          channelType: expr('{{ $json.channelType }}'),
          accountId: expr('{{ $json.accountId }}'),
          cartJson: expr('{{ $json.cartJson }}')
        },
        schema: [
          { id: 'channelType', displayName: 'channelType', type: 'string' },
          { id: 'accountId', displayName: 'accountId', type: 'string' },
          { id: 'cartJson', displayName: 'cartJson', type: 'string' }
        ]
      },
      mode: 'once',
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ success: true, shopName: 'Materials Sandbox', environment: 'sandbox', lines: [], subtotalVnd: 237000, previewOnly: true, canConfirm: false, canWrite: false }]
});

const formatCart = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Return Safe Cart Preview',
    position: [2000, 360],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const raw = $input.first().json || {};\n" +
        "const request = $('Validate Trusted Installation and Read Scope').first().json || {};\n" +
        "const lines = Array.isArray(raw.lines) ? raw.lines.slice(0, 30).map(line => ({ sku: String(line.sku ?? '').slice(0, 64), name: String(line.name ?? '').slice(0, 180), unit: String(line.unit ?? '').slice(0, 30), quantity: Number(line.quantity), unitPriceVnd: Number(line.unitPriceVnd), lineTotalVnd: Number(line.lineTotalVnd), stock: Number(line.stock), needsQuote: line.needsQuote === true })) : [];\n" +
        "const subtotal = Number(raw.subtotalVnd);\n" +
        "return [{ json: { success: raw.success === true, operation: 'cart.preview', environment: 'sandbox', shopName: String(raw.shopName ?? '').slice(0, 120), lines, subtotalVnd: Number.isSafeInteger(subtotal) && subtotal >= 0 ? subtotal : null, errors: Array.isArray(raw.errors) ? raw.errors.map(e => String(e).slice(0, 120)).slice(0, 30) : [], requiresHumanQuote: raw.requiresHumanQuote === true, previewOnly: true, requestId: request.requestId, readOnly: true, canConfirm: false, canWrite: false, privateOrderAccess: false } }];"
    }
  },
  output: [{ success: true, operation: 'cart.preview', environment: 'sandbox', shopName: 'Materials Sandbox', lines: [], subtotalVnd: 237000, errors: [], requiresHumanQuote: false, previewOnly: true, requestId: 'v1855-qa-02-cart', readOnly: true, canConfirm: false, canWrite: false, privateOrderAccess: false }]
});

const deny = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Return Read-Only Denial',
    position: [1120, 600],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const input = $input.first().json || {};\n" +
        "return [{ json: { success: false, operation: String(input.operation ?? '').slice(0, 40), reason: String(input.reason ?? 'operation_not_allowed').slice(0, 80), requestId: String(input.requestId ?? '').slice(0, 80), environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false } }];"
    }
  },
  output: [{ success: false, operation: 'order.create', reason: 'operation_not_allowed', requestId: 'v1855-qa-09-order-create', environment: 'sandbox', readOnly: true, canWrite: false, canConfirm: false, privateOrderAccess: false }]
});

export default workflow('t404-v1855-protected-readonly-commerce-adapter', 'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter')
  .add(adapterInput)
  .to(validateRequest)
  .to(isAllowed
    .onTrue(isCatalog
      .onTrue(catalogQuery.to(formatCatalog))
      .onFalse(isCart
        .onTrue(cartPreview.to(formatCart))
        .onFalse(deny)
      )
    )
    .onFalse(deny)
  )
  .group('Trusted Request Admission', [validateRequest, isAllowed], {
    description: 'Rejects untrusted installation, authority fields, stale requests and every operation outside catalog search/cart preview.'
  })
  .group('Catalog Read Only', [catalogQuery, formatCatalog], {
    description: 'Calls the existing Published Catalog Query and strips tenant identifiers from the response.'
  })
  .group('Cart Preview Only', [cartPreview, formatCart], {
    description: 'Calls the existing Published Cart Preview and returns a non-confirmable, non-writing draft.'
  });
