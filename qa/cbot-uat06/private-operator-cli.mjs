#!/usr/bin/env node
/**
 * CBOT-UAT-06 private workstation offline CLI.
 * Usage: node qa/cbot-uat06/private-operator-cli.mjs < private-packet.json
 *
 * SAFE: stdin only, bounded read, no network, no secret access, no file writes,
 * no printing private input, IDs, hashes, paths or full packet. Outputs only
 * aggregated QA metadata and hard-coded, non-authorizing NO-GO decision.
 */
import {readFileSync} from 'node:fs';
import {auditPrivateOperatorPacket} from './private-m0-owner-native-gates.mjs';

try{
 const data=readFileSync(0);
 if(data.byteLength<=0||data.byteLength>65536)throw Object.assign(
   new Error('PRIVATE_PACKET_SIZE_OUT_OF_BOUNDS'),{code:'PRIVATE_PACKET_SIZE_OUT_OF_BOUNDS'});
 const packet=JSON.parse(data.toString('utf8'));
 const r=auditPrivateOperatorPacket(packet);
 const output={
   contract:r.contract,status:r.status,
   roles_shape_count:r.roles_shape_count,
   archive_prior_reference_matches:r.archive_prior_reference_matches,
   archive_partial_coverage_possible:r.archive_partial_coverage_possible,
   archive_restore_reference_present:r.archived_external_restore_ref_present,
   m0_domain_ref_count:r.m0_evidence_domain_count,
   row_claim_count:r.legacy_business_rows_claimed,
   unreviewed_row_count:r.business_rows_missing_review,
   meta_domain_ref_count:r.meta_proof_domain_count,
   zalo_domain_ref_count:r.zalo_proof_domain_count,
   missing_evidence:r.missing_evidence,
   release_authorization:{
     complete_m0_accepted:false,hosted_store_read:false,
     rpc_revoke:false,provider_send:false,production:false
   },
   next:"Independent real Controller+Reviewer+Backup Operator and Merchant/Page/OA authority; reuse H11R11 #205 private intake and PR #198 local archive script."
 };
 process.stdout.write(JSON.stringify(output,null,2)+'\n');
} catch(e){
 const safeCode=typeof e?.code==='string'&&/^[A-Z0-9_]{5,120}$/.test(e.code)?e.code:'PRIVATE_PACKET_INVALID';
 process.stderr.write('CBOT06_PRIVATE_METADATA_REJECTED:'+safeCode+'\n');
 process.exitCode=3;
}
