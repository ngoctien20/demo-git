/** Offline-only converter for Meta Dashboard's displayed sample modal.
 * NEVER use as an ingress verifier or as a live Meta wire-format guarantee.
 */
const FIELDS=Object.freeze({
 messaging_postbacks:"postback", messages:"message", message_deliveries:"delivery",
 message_reads:"read", message_echoes:"message", messaging_handovers:"pass_thread_control"
});
export function displaySampleToSyntheticFixture(x){
 if(!x||typeof x!=="object"||Array.isArray(x))return null;
 const sample=x.sample;
 if(!sample||typeof sample!=="object"||Array.isArray(sample)||
  !Object.hasOwn(FIELDS,sample.field)||!sample.value||
  typeof sample.value!=="object")return null;
 const key=FIELDS[sample.field],fieldPayload=sample.value[key];
 if(!fieldPayload||typeof fieldPayload!=="object"||Array.isArray(fieldPayload))return null;
 // No sender, recipient, Page, PSID, message body, referral or payload retained.
 const synthetic=sample.field==="message_echoes"?{is_echo:true}:{};
 return {object:"page",entry:[{messaging:[{[key]:synthetic}]}]};
}
