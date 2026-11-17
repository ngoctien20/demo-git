/** RPC17.2 private scanner boundary. No network, storage, upload or external scanner is provisioned.
 * A scanner receipt is required but never grants Merchant intake.
 */
import {createHash} from 'node:crypto';
import {checkFileEnvelope} from '../v152-rpc17/private-admission.mjs';
import {scannerVerdict} from '../v152-rpc171/atomic-admission.mjs';
const deny=reason=>Object.freeze({accepted:false,can_upload:false,can_send:false,reason});
export async function privateScannerPreflight({file,tenant_id,store_id,object_id,scanner_id='scanner-qa',pinnedKeys,scanOffline,now}={}){
 try{
  if(typeof scanOffline!=='function')return deny('SCANNER_UNAVAILABLE');
  const f=checkFileEnvelope(file);
  if(!f.accepted)return deny('FILE_'+f.reason);
  if(!Buffer.isBuffer(file.content)||file.content.length!==file.size)return deny('FULL_BYTES_REQUIRED');
  // Strictly test-supplied callback; NEVER invoke arbitrary network URL or read R2.
  const expected={tenant_id,store_id,object_id,scanner_id,digest:createHash('sha256').update(file.content).digest('hex')};
  const receipt=await scanOffline(Object.freeze({...expected,bytes:Buffer.from(file.content)}));
  const verified=scannerVerdict(receipt,expected,pinnedKeys,now);
  if(!verified.accepted)return deny('SCAN_'+verified.reason);
  return Object.freeze({accepted:true,can_upload:false,can_send:false,reason:'OFFLINE_SCANNER_ONLY'});
 }catch{return deny('SCANNER_FAILURE');}
}
export const scannerHostedGate=()=>deny('NO_HOSTED_ISOLATED_SCANNER');
