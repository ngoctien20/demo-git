/** Metadata-only source inventory from user-supplied 96 and 36 QA CSVs.
 * No message text, expected reply, output, customer PII or credentials.
 * 36-case "multi-turn" PACK has 9 cases with one turn; 27 have >=2 turns.
 * This is real FILE STRUCTURE, not a model evaluation result.
 */
export const SINGLE_CASES=Object.freeze(Array.from({length:96},(_,i)=>Object.freeze({
 case_id:'QA'+String(i+1).padStart(2,'0')
})));
const TURN_COUNTS=Object.freeze([
 2,3,1,2,3,3,4,4,2,2,2,2,2,2,2,2,1,1,3,2,2,2,2,2,1,1,1,2,1,1,2,2,2,2,2,1
]);
export const MULTI_PACK=Object.freeze(TURN_COUNTS.map((turn_count,i)=>Object.freeze({
 case_id:'QA'+String(i+1).padStart(2,'0'),turn_count
})));
export const MANIFEST_METADATA=Object.freeze({
 single_count:SINGLE_CASES.length,multi_pack_count:MULTI_PACK.length,
 multi_pack_true_multi:MULTI_PACK.filter(x=>x.turn_count>1).length,
 multi_pack_one_turn:MULTI_PACK.filter(x=>x.turn_count===1).length,
 total_turns_in_multi_pack:MULTI_PACK.reduce((n,x)=>n+x.turn_count,0),
 source:'USER_UPLOADED_CSV_STRUCTURE_READ_ONLY',model_calls:0,quality_pass:0
});
