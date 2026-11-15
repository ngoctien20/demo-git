// Compile a credential-free manual regression from the same formatter the PostgreSQL service imports.
import {ownerNotice} from '../lib/owner-notice.mjs';
import {noticeContract} from './notice-contract.mjs';
const jsCode=ownerNotice.toString()+'\n'+noticeContract.toString()+
  '\nconst results=noticeContract(ownerNotice);\nif(results.some(r=>r.status!=="PASS"))throw Error(JSON.stringify(results));\nreturn [{json:{version:"sales-lite-v1",source:"synthetic_qa",cases:results.length,passed:results.length,sent:0,results}}];';
const sdk=[
  "import {workflow, trigger, node} from '@n8n/workflow-sdk';",
  "const manual=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Kiểm thử thủ công'}});",
  "const checks=node({type:'n8n-nodes-base.code',version:2,config:{name:'Kiểm tra thông báo Owner',parameters:{mode:'runOnceForAllItems',language:'javaScript',jsCode:"+JSON.stringify(jsCode)+"}}});",
  "export default workflow('tien404-sales-lite-owner-notice-qa','TIEN404_SALES_LITE_V1_OWNER_NOTICE_SHADOW_QA').add(manual).to(checks);"
];
process.stdout.write(sdk.join('\n'));
