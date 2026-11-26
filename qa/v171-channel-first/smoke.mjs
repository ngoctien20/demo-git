import {createSyntheticSandbox,makeSyntheticEnvelope,fixtureEvent,integrationReadiness} from './vertical-slice.mjs';
const scenarios=[
 ['messenger','QA_PAGE_A','QA_STORE_A',159000],
 ['messenger','QA_PAGE_B','QA_STORE_B',259000],
 ['zalo','QA_OA_B','QA_STORE_B',259000],
 ['website','QA_WIDGET_A','QA_STORE_A',159000],
 ['messenger','QA_PAGE_C','QA_STORE_C',309000]
];
const sandbox=createSyntheticSandbox(),steps=[];
for(const [i,row] of scenarios.entries()){
 const [channel,installation_ref,store,price_vnd]=row;
 const event=fixtureEvent({event_id:'QA_EVT_SMOKE_'+(i+1),channel,installation_ref});
 const result=sandbox.process(makeSyntheticEnvelope(event));
 if(result.status!=='QA_READONLY_SUCCESS'||result.trusted.store!==store||result.outbound.price_vnd!==price_vnd||result.outbound.delivery!=='MOCK_ONLY_NOT_SENT')throw Error('SMOKE_FAILED');
 steps.push({channel,store,bot:result.trusted.bot,price_vnd,send:false,status:result.status});
}
const readiness=integrationReadiness();
if(readiness.verified_vendor_webhook_protocols!==0||readiness.verified_hosted_store_isolation)throw Error('FALSE_LIVE_READINESS');
console.log(JSON.stringify({contract:readiness.target_contract,status:'QA_SYNTHETIC_VERTICAL_SLICE_PASS',scenarios:steps.length,real_provider_sends:0,real_model_requests:0,orders_written:0,hosted_release:'NO_GO',steps},null,2));
