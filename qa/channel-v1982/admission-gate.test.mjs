import assert from 'node:assert/strict';
import {assessStoreRead,assessBackfillPreview} from './admission-gate.mjs';

function fixture(){
 return {testSource:'SYNTHETIC_QA',environment:'isolated_test',
 session:{proof:'MOCK_JWT_NOT_REAL',active:true,userRef:'OWNER_A'},
 tenantMembership:{source:'SERVER_FIXTURE',active:true,userRef:'OWNER_A',tenantId:'TENANT_SHARED'},
 storeMembership:{source:'SERVER_FIXTURE',active:true,userRef:'OWNER_A',tenantId:'TENANT_SHARED',storeId:'STORE_A',role:'owner'},
 installation:{source:'SERVER_FIXTURE',active:true,channel:'zalo_bot',botRef:'BOT_A',tenantId:'TENANT_SHARED',storeId:'STORE_A'},
 store:{id:'STORE_A',tenantId:'TENANT_SHARED',active:true},
 product:{source:'STORE_SCOPED_FIXTURE',sku:'F01',tenantId:'TENANT_SHARED',storeId:'STORE_A',priceVnd:159000,stock:5},
 receipt:{proof:'MOCK_PROVIDER_ONLY',signed:true,fresh:true,unique:true,privateChat:true,botEcho:false,botRef:'BOT_A'}
 };
}
const cases=[
 ['same tenant owner A',x=>{},'SYNTHETIC_READ_PLAN_ONLY'],
 ['same tenant owner B',x=>{x.session.userRef='OWNER_B';x.tenantMembership.userRef='OWNER_B';x.storeMembership.userRef='OWNER_B';x.storeMembership.storeId='STORE_B';x.installation.storeId='STORE_B';x.installation.botRef='BOT_B';x.store.id='STORE_B';x.product.storeId='STORE_B';x.receipt.botRef='BOT_B'},'SYNTHETIC_READ_PLAN_ONLY'],
 ['owner A cannot read B',x=>{x.product.storeId='STORE_B'},'DENY'],
 ['owner B cannot read A',x=>{x.storeMembership.storeId='STORE_B';x.installation.storeId='STORE_B';x.store.id='STORE_B';x.product.storeId='STORE_A'},'DENY'],
 ['revoked store member',x=>{x.storeMembership.active=false},'DENY'],
 ['revoked tenant member',x=>{x.tenantMembership.active=false},'DENY'],
 ['different tenant membership',x=>{x.tenantMembership.tenantId='OTHER'},'DENY'],
 ['different store membership',x=>{x.storeMembership.storeId='OTHER'},'DENY'],
 ['missing canonical store',x=>{delete x.store},'DENY'],
 ['inactive canonical store',x=>{x.store.active=false},'DENY'],
 ['inactive installation',x=>{x.installation.active=false},'DENY'],
 ['wrong bot',x=>{x.receipt.botRef='BOT_B'},'DENY'],
 ['wrong installation store',x=>{x.installation.storeId='STORE_B'},'DENY'],
 ['changed provider claim',x=>{x.receipt.proof='LIVE_BUT_UNVERIFIED'},'DENY'],
 ['unsigned webhook',x=>{x.receipt.signed=false},'DENY'],
 ['stale event',x=>{x.receipt.fresh=false},'DENY'],
 ['replay event',x=>{x.receipt.unique=false},'DENY'],
 ['group event',x=>{x.receipt.privateChat=false},'DENY'],
 ['bot echo',x=>{x.receipt.botEcho=true},'DENY'],
 ['expired JWT',x=>{x.session.active=false},'DENY'],
 ['other auth user',x=>{x.storeMembership.userRef='OWNER_B'},'DENY'],
 ['client forged store',x=>{x.clientClaims={storeId:'STORE_A'}},'DENY'],
 ['client forged role',x=>{x.clientClaims={serviceRole:true}},'DENY'],
 ['unknown member role',x=>{x.storeMembership.role='viewer'},'DENY'],
 ['product from other tenant',x=>{x.product.tenantId='TENANT_OTHER'},'DENY'],
 ['product without store',x=>{x.product.storeId=null},'DENY'],
 ['invalid product price',x=>{x.product.priceVnd=0},'DENY'],
 ['negative stock',x=>{x.product.stock=-1},'DENY'],
 ['invalid SKU',x=>{x.product.sku='../'},'DENY'],
 ['missing sender membership',x=>{delete x.storeMembership},'DENY'],
 ['invalid test source',x=>{x.testSource='REAL_WEBHOOK'},'DENY']
];
const backfillBase=()=>({source:'SERVER_INVENTORY_FIXTURE',operatorApproval:true,rows:[{tenantId:'T1',storeId:null}],canonicalStores:[{tenantId:'T1',storeId:'S1',ownerVerified:true}],ownershipProofs:[{tenantId:'T1',storeId:'S1',verified:true}],pendingWrites:0,ambiguousLineage:0});
const backfillCases=[
 ['one store exact verified',x=>{},'SYNTHETIC_BACKFILL_PLAN_ONLY'],
 ['multiple stores same tenant',x=>{x.canonicalStores.push({tenantId:'T1',storeId:'S2',ownerVerified:true})},'BLOCKED'],
 ['zero stores',x=>{x.canonicalStores=[]},'BLOCKED'],
 ['no owner verification',x=>{x.canonicalStores[0].ownerVerified=false},'BLOCKED'],
 ['missing proof',x=>{x.ownershipProofs=[]},'BLOCKED'],
 ['row already assigned',x=>{x.rows[0].storeId='S1'},'BLOCKED'],
 ['pending writer',x=>{x.pendingWrites=1},'BLOCKED'],
 ['ambiguous lineage',x=>{x.ambiguousLineage=1},'BLOCKED'],
 ['no approval',x=>{x.operatorApproval=false},'BLOCKED'],
 ['unknown source',x=>{x.source='CUSTOMER_REQUEST'},'BLOCKED']
];
let passed=0;
for(const [name,mutate,expected] of cases){const x=fixture();mutate(x);const r=assessStoreRead(x);assert.equal(r.decision,expected,name);assert.equal(r.canReadHosted,false,name);assert.equal(r.canSend,false,name);assert.equal(r.canWrite,false,name);passed++;}
for(const [name,mutate,expected] of backfillCases){const x=backfillBase();mutate(x);const r=assessBackfillPreview(x);assert.equal(r.decision,expected,name);assert.equal(r.mutated,false,name);assert.equal(r.rowsUpdated,0,name);passed++;}
console.log('TIEN404_V1982_OFFLINE_TEST_PASS='+passed);
