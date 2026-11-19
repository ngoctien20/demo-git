# TIEN404 V18.7.6B — RPC Dependency Audit

Date: 2026-11-19 JST | VERIFIED METADATA / P1 CALLER INVENTORY STILL OPEN

## Verified via Supabase pg_catalog (read-only)
- Three public SECURITY DEFINER RPCs: qa_shop_b_zalo_claim (anon can EXECUTE); qa_owner_pairing and save_merchant_product (authenticated can EXECUTE).
- The last two function definitions reference auth.uid and tenant_memberships. Their definitions have not been proven to check canonical store_memberships/store_id.
- qa_shop_b_zalo_claim's definition has channel/challenge-related references but no auth.uid. It may be intentionally called from anonymous verified claim flows; inspect the actual implementation before changing privileges.
- All three have an explicit search_path configuration. This alone does NOT establish safe authorization.
- SQL function-body metadata search found SIX QA-schema functions whose definitions mention qa_owner_pairing:
  1. tien404_r1_qa.claim_owner_pairing_v3_synthetic
  2. tien404_r1_qa.confirm_owner_pairing_v3_qa
  3. tien404_r1_qa.issue_owner_challenge
  4. tien404_r1_qa.pair_owner_authorized_qa
  5. tien404_r1_qa.pair_owner_authorized_v2_qa
  6. tien404_r1_qa.pair_owner_qa
- This is a textual reference inventory, not confirmation of six direct runtime calls.
- A separate pg_trigger query found no trigger function-body references to these three RPC names; indirect calls are not excluded.
- GitHub search-code on indexed repository returned no matches for the three names. This does not prove no app callers: other branches, generated bundles and n8n HTTP/RPC expressions may not be indexed or visible.
- n8n name discovery found several owner/pairing/product QA workflows, but has NOT established all RPC call sites. Thus P1 dependency review remains OPEN.

## Risk and owner-review matrix
| RPC | Current grant | Candidate risk | Required next evidence |
| --- | --- | --- | --- |
| qa_shop_b_zalo_claim | anon | Public privileged pairing endpoint with unverified provider/owner proof | Check rate limits, challenge expiry, one-time claim, origin, dependencies |
| qa_owner_pairing | authenticated | Tenant-only auth boundary, may not distinguish two Stores in one Tenant | Check real user/store binding, challenge audit, caller graph |
| save_merchant_product | authenticated | Price/product write authorization might use only tenant membership | Check role, expected price, tenant/store scope, writer compatibility |

## Explicit NO-CHANGE
Do not REVOKE EXECUTE, ALTER FUNCTION, DROP RPC or modify RLS from this finding alone. Current grants do not prove exploitation. Complete the n8n/website caller inventory, design compatible replacement, backup/rollback, obtain owner approval and run independent QA first.

Supabase guidance:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
