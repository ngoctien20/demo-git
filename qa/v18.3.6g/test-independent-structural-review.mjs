// Second-pass structural review of the actual F predecessor and new G sources.
// This is independently executed CI automation, NOT an independent human audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const file=(p)=>readFileSync(resolve(root,p),'utf8');
const fAdmin=file('qa/v18.3.6f/01_MEMBERSHIP_ADMIN.sql');
const fGateway=file('qa/v18.3.6f/02_GATEWAY_BYPASS_GUARD.sql');
const fPgTap=file('qa/v18.3.6f/03_PGTAP_ADMIN_GATEWAY.sql');
const gAuthority=file('qa/v18.3.6g/signed-authority.mjs');
const gPreflight=file('qa/v18.3.6g/real-auth-ab-preflight.mjs');
test('R01 F executor actually has BYPASSRLS: elevated trust boundary must remain blocked',()=>{
 assert.match(fGateway,/CREATE ROLE tien404_f_executor NOLOGIN BYPASSRLS/);
});
test('R02 F gateway caller has NOBYPASSRLS and no direct Order grant',()=>{
 assert.match(fGateway,/CREATE ROLE tien404_f_gateway NOLOGIN NOBYPASSRLS/);
 assert.match(fGateway,/REVOKE ALL ON public\.orders,public\.stores FROM tien404_f_gateway/);
});
test('R03 F relies on synthetic boolean flags not cryptographic proof',()=>{
 assert.match(fGateway,/server_verified boolean/);
 assert.match(fGateway,/owner_consented boolean/);
});
test('R04 F privileged Gateway uses explicit exact order Store scope and receipt lock',()=>{
 assert.match(fGateway,/FOR UPDATE OF p/);
 assert.match(fGateway,/r\.order_id<>p_order/);
 assert.match(fGateway,/r\.store_id<>p_claimed_store/);
});
test('R05 F uses synthetic GUC-based Auth identity and therefore is not live Auth proof',()=>{
 const eSchema=file('qa/v18.3.6e/01_PG17_DISPOSABLE_SCHEMA.sql');
 assert.match(eSchema,/request\.jwt\.claim\.sub/);
});
test('R06 F last-owner guard serializes competing changes by locking Store row',()=>{
 assert.match(fAdmin,/FOR UPDATE/);
 assert.match(fAdmin,/LAST_ACTIVE_STORE_OWNER/);
});
test('R07 F Store activation guard applies on UPDATE only: privileged direct INSERT still requires gate',()=>{
 assert.match(fAdmin,/BEFORE UPDATE ON public\.stores/);
 assert.doesNotMatch(fAdmin,/BEFORE INSERT OR UPDATE ON public\.stores/);
});
test('R08 F invitation approval is self-attested: independent owner approval is not proven',()=>{
 assert.match(fAdmin,/approved_by=actor/);
});
test('R09 G authority issuer uses actual Ed25519 sign and verifier uses cryptographic verify',()=>{
 assert.match(gAuthority,/cryptoSign\(null/);
 assert.match(gAuthority,/cryptoVerify\(null/);
 assert.match(gAuthority,/CONTRACT\.alg/);
});
test('R10 G never accepts token-derived remote key URLs or arbitrary header fields',()=>{
 assert.match(gAuthority,/exactKeys\(header,HEADER_KEYS\)/);
 assert.match(gAuthority,/trusted\.get\(header\.kid\)/);
});
test('R11 G requires server-side session and DB membership callbacks both at issue/redeem',()=>{
 assert.match(gAuthority,/verifySession:?\b|o\.verifySession\(handle\)/);
 assert.match(gAuthority,/resolveMembership/);
 assert.match(gAuthority,/trustedState\(o,sessionHandle/);
});
test('R12 G caps authority TTL at 120 seconds and binds a specific operation',()=>{
 assert.match(gAuthority,/maxTtlSeconds: 120/);
 assert.match(gAuthority,/claims\.capability!==capability/);
});
test('R13 G supports only read-only capabilities; no writer or message send',()=>{
 assert.match(gAuthority,/allowedCapabilities: \['CATALOG_READ','ORDER_READ'\]/);
 assert.doesNotMatch(gAuthority,/ORDER_WRITE|PROVIDER_SEND|SEND_MESSAGE/);
});
test('R14 G nonce consumption is a required caller-supplied atomic persistence interface',()=>{
 assert.match(gAuthority,/consumeNonce/);
 assert.match(gAuthority,/REPLAY/);
});
test('R15 G session binding uses key-based HMAC, not raw session ID',()=>{
 assert.match(gAuthority,/createHmac\('sha256', bindingKey\)/);
 assert.match(gAuthority,/session_binding:fingerprint/);
});
test('R16 G real Auth A/B preflight cannot claim production admitted',()=>{
 assert.match(gPreflight,/productionAdmitted:false/);
 assert.match(gPreflight,/realAuthVerified:false/);
 assert.match(gPreflight,/CANONICAL_STORE_AUTHORITY_MISSING/);
});
test('R17 G authority modules have no network client/API calls or secret-key literals',()=>{
 const joined=gAuthority+'\n'+gPreflight;
 assert.doesNotMatch(joined,/\bfetch\s*\(|https\.request|http\.request|new WebSocket\(/);
 assert.doesNotMatch(joined,/SUPABASE_SERVICE_ROLE_KEY\s*=|PRIVATE_KEY\s*=|BEGIN PRIVATE KEY/);
});
test('R18 F even a successful pgTAP suite must not be interpreted as real provider grant',()=>{
 assert.match(fPgTap,/synthetic/);
 assert.match(fGateway,/fixture-page-A/);
});
