const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const core=read('engine.cjs').split('module.exports=')[0];
const editor=process.argv[2]==='editor';
const js=editor ? core+read('editor.cjs')+'\nreturn [{json:{output:replayTranscript($json.chatInput)}}];' :
  core+read('suite.cjs').split('\n').slice(1).join('\n').split('if(require.main')[0]+'\nreturn [{json:evaluate()}];';
const start=editor ? {type:'@n8n/n8n-nodes-langchain.chatTrigger',version:1.3,config:{name:'Editor QA chat',parameters:{public:false,options:{}}}} : {type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Manual QA'}};
const node={type:'n8n-nodes-base.code',version:2,config:{name:editor?'Offline sales conversation':'Sandbox conversation and safety assertions',parameters:{jsCode:js}}};
const name=editor?'TIEN404_ZALO_AGENT_V2_EDITOR_CHAT':'TIEN404_ZALO_AGENT_LAB_V2_STAGING';
console.log("import {workflow,node,trigger} from '@n8n/workflow-sdk';\nconst start=trigger("+JSON.stringify(start)+");\nconst run=node("+JSON.stringify(node)+");\nexport default workflow('zalo-v2',"+JSON.stringify(name)+").add(start).to(run);");
