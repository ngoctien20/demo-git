'use strict';
// Staging-only public core entrypoint. Intentionally exports NO outbound/send/commit API.
module.exports=Object.freeze({
 ...require('./ingress.cjs'),
 ...require('./catalog.cjs'),
 ...require('./core.cjs'),
 ...require('./ports.cjs'),
 ...require('./postgres-state.cjs'),
 ...require('./budget.cjs'),
 versions:require('./version.cjs')
});