#!/usr/bin/env node
// Run ONLY on an approved operator machine outside CI; NEVER paste tokens into chat.
import {operatorRun} from './live-auth-uat.mjs';
const argv=process.argv.slice(2);
const readFlag=(k)=>{const i=argv.indexOf(k);return i<0?null:argv[i+1]};
const configPath=readFlag('--config'),tokenAPath=readFlag('--token-a'),tokenBPath=readFlag('--token-b');
if(!configPath||!tokenAPath||!tokenBPath||argv.length!==6){
 console.error('Usage: node qa/v152-rpc13/uat-operator-cli.mjs --config PRIVATE_FILE --token-a LOCAL_0600_A --token-b LOCAL_0600_B');
 process.exitCode=2;
}else{
 try{const result=await operatorRun({configPath,tokenAPath,tokenBPath});
   console.log(JSON.stringify(result));
 }catch(e){
   // Deliberately avoid error object serialization, which can include URLs or credentials.
   console.error('UAT_BLOCKED:',String(e?.message||'UNVERIFIED').replace(/[\r\n\x00-\x1f]/g,'_').slice(0,100));
   process.exitCode=3;
 }
}