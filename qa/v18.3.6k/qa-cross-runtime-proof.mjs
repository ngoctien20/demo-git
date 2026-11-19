/**
 * V18.3.6K cross-language HMAC fixture proof, invoked ONLY in isolated CI.
 * All identifiers, key bytes and authority inputs below are synthetic.
 */
import {signRpcProof} from './fail-closed-signed-rpc.mjs';
const epoch=Number(process.argv[2]);
if(!Number.isSafeInteger(epoch)||epoch<1_500_000_000)process.exit(2);
const req={
 kid:'qa-k-key-1',
 issuer:'tien404-private-authority-staging',
 audience:'tien404-private-commerce-readonly',
 jti:'00000000-0000-4000-8000-000000009999',
 tenantHash:'d'.repeat(64),storeHash:'e'.repeat(64),
 subjectHash:'c'.repeat(64),sessionBindingHash:'a'.repeat(64),
 membershipRevisionHash:'5'.repeat(64),authorityDigest:'9'.repeat(64),
 capability:'CATALOG_READ',expiresAt:epoch+60,
 resourceId:'00000000-0000-4000-8000-000000000101',
 authCheckedAt:epoch,authValidUntil:epoch+2,
};
process.stdout.write(signRpcProof(req,Buffer.alloc(64,75)));
