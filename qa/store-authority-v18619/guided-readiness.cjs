'use strict';
/* TIEN404 V18.6.19 — OWNER WINDOWS READINESS DIAGNOSTIC ONLY.
 * Deliberately has no remote connections, subprocess execution, backup/export/restore,
 * file creation, credential prompts, or mutation. All outputs are fixed status codes.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const {stdin,stdout} = require('node:process');
const EXPECTED_REF = 'ifxlvrhyjhbzbrkdsida';
const BLOCKED = /^(?:onedrive(?:[- _].*)?|dropbox(?:[- _].*)?|google ?drive(?:[- _].*)?|icloud ?drive(?:[- _].*)?|appdata|programdata|downloads|windows|system32|temp|tmp|\.git|node_modules)$/i;
const CODES = Object.freeze({
  OWNER_WINDOWS_ONLY:'OWNER_WINDOWS_ONLY', NODE_22_REQUIRED:'NODE_22_REQUIRED',
  SUPABASE_CLI_MISSING:'SUPABASE_CLI_MISSING', DOCKER_CLI_MISSING:'DOCKER_CLI_MISSING',
  PATHS_REQUIRED:'PATHS_REQUIRED', ABSOLUTE_PATHS_REQUIRED:'ABSOLUTE_PATHS_REQUIRED',
  PROJECT_FOLDER_MISSING:'PROJECT_FOLDER_MISSING', BACKUP_FOLDER_MISSING:'BACKUP_FOLDER_MISSING',
  LINKED_PROJECT_MARKER_NOT_FOUND:'LINKED_PROJECT_MARKER_NOT_FOUND',
  WRONG_LINKED_PROJECT:'WRONG_LINKED_PROJECT',
  OUTPUT_UNSAFE_LOCATION:'OUTPUT_UNSAFE_LOCATION', OUTPUT_NOT_EMPTY:'OUTPUT_NOT_EMPTY',
  CI_FORBIDDEN:'CI_FORBIDDEN'
});
const safeCheck=(predicate,code,errors)=>{if(!predicate)errors.push(code);};
function inside(child,parent,platform=process.platform){
  const p=platform==='win32'?path.win32:path;
  const norm=x=>platform==='win32'?p.normalize(x).toLowerCase():p.normalize(x);
  const a=norm(child),b=norm(parent);
  return a===b || a.startsWith(b.endsWith(p.sep)?b:b+p.sep);
}
function gitAncestor(target,{fsApi=fs,platform=process.platform}={}){
  const p=platform==='win32'?path.win32:path;
  let current=target;
  while(true){if(fsApi.existsSync(p.join(current,'.git')))return true;
    const parent=p.dirname(current);if(parent===current)return false;current=parent;}
}
function commandPresent(name,{fsApi=fs,env=process.env,platform=process.platform}={}){
  const p=platform==='win32'?path.win32:path;
  const entries=(env.PATH||env.Path||'').split(platform==='win32'?';':':');
  const extensions=platform==='win32'?['.exe','.cmd','.bat','']:[''];
  for(const dir of entries){if(!dir)continue;
    for(const ext of extensions){const full=p.join(dir,name+ext);
      try{if(fsApi.statSync(full).isFile())return true;}catch{}}
  }
  return false;
}
function diagnose({projectRoot,outputDir}={},opts={}){
  const env=opts.env||process.env,fsApi=opts.fsApi||fs,platform=opts.platform||process.platform;
  const p=platform==='win32'?path.win32:path;
  const hasCommand=opts.hasCommand||((name)=>commandPresent(name,{fsApi,env,platform}));
  const errors=[];
  const major=Number((opts.nodeVersion||process.versions.node).split('.')[0]);
  safeCheck(platform==='win32',CODES.OWNER_WINDOWS_ONLY,errors);
  safeCheck(!env.CI&&!env.GITHUB_ACTIONS,CODES.CI_FORBIDDEN,errors);
  safeCheck(Number.isFinite(major)&&major>=22,CODES.NODE_22_REQUIRED,errors);
  safeCheck(hasCommand('supabase'),CODES.SUPABASE_CLI_MISSING,errors);
  safeCheck(hasCommand('docker'),CODES.DOCKER_CLI_MISSING,errors);
  if(!projectRoot||!outputDir) errors.push(CODES.PATHS_REQUIRED);
  else if(!p.isAbsolute(projectRoot)||!p.isAbsolute(outputDir))errors.push(CODES.ABSOLUTE_PATHS_REQUIRED);
  else {
    let project,output;
    try{project=fsApi.realpathSync(projectRoot);if(!fsApi.statSync(project).isDirectory())throw Error();}
    catch{errors.push(CODES.PROJECT_FOLDER_MISSING);}
    try{
      if(fsApi.lstatSync(outputDir).isSymbolicLink())throw Error();
      output=fsApi.realpathSync(outputDir);
      if(!fsApi.statSync(output).isDirectory())throw Error();
    }catch{errors.push(CODES.BACKUP_FOLDER_MISSING);}
    if(project){
      const marker=p.join(project,'supabase','.temp','project-ref');
      const config=p.join(project,'supabase','config.toml');
      if(!fsApi.existsSync(marker)||!fsApi.existsSync(config))errors.push(CODES.LINKED_PROJECT_MARKER_NOT_FOUND);
      else {
        try{if(fsApi.readFileSync(marker,'utf8').trim()!==EXPECTED_REF)errors.push(CODES.WRONG_LINKED_PROJECT);}
        catch{errors.push(CODES.LINKED_PROJECT_MARKER_NOT_FOUND);}
      }
    }
    if(output){
      const blockedSegment=output.split(/[\\/]+/).some(x=>BLOCKED.test(x));
      const unsafe=output===p.parse(output).root || blockedSegment || gitAncestor(output,{fsApi,platform}) || (project && (inside(output,project,platform)||inside(project,output,platform)));
      if(unsafe)errors.push(CODES.OUTPUT_UNSAFE_LOCATION);
      try{if(fsApi.readdirSync(output).length!==0)errors.push(CODES.OUTPUT_NOT_EMPTY);}catch{errors.push(CODES.BACKUP_FOLDER_MISSING);}
    }
  }
  return {
    version:'V18.6.19',status:errors.length?'GUIDED_READINESS_BLOCKED':'GUIDED_READINESS_ONLY_PASS',
    codes:[...new Set(errors)],targetRefConfirmed:!errors.includes(CODES.WRONG_LINKED_PROJECT)&&!errors.includes(CODES.LINKED_PROJECT_MARKER_NOT_FOUND)&&!errors.includes(CODES.PROJECT_FOLDER_MISSING)&&!errors.includes(CODES.PATHS_REQUIRED)&&!errors.includes(CODES.ABSOLUTE_PATHS_REQUIRED),
    exportExecuted:false,restoreExecuted:false,authRecoveryVerified:false,vaultRecoveryVerified:false,
    fullPlatformBackupVerified:false,productionReady:false
  };
}
function parseArgs(args){
  const out={help:false};
  for(let i=0;i<args.length;i++){
    const k=args[i];
    if(k==='--help' && args.length===1){out.help=true;continue;}
    if((k==='--project-root'||k==='--output-dir') && args[i+1]&&!args[i+1].startsWith('--')){out[k==='--project-root'?'projectRoot':'outputDir']=args[++i];continue;}
    throw Error('UNSUPPORTED_ARGUMENT_NO_EXPORT');
  }
  return out;
}
async function main(argv=process.argv.slice(2),deps={}){
  let args;
  try{args=parseArgs(argv);}catch{console.error('GUIDED_READINESS_BLOCKED:UNSUPPORTED_ARGUMENT_NO_EXPORT');return 2;}
  if(args.help){console.log('READINESS ONLY: node guided-readiness.cjs [--project-root ABSOLUTE --output-dir ABSOLUTE]. Does not export or restore.');return 0;}
  if(process.platform!=='win32'||process.env.CI||process.env.GITHUB_ACTIONS){console.log('GUIDED_READINESS_BLOCKED:OWNER_WINDOWS_ONLY');return 2;}
  if(!args.projectRoot||!args.outputDir){
    if(!stdin.isTTY||!stdout.isTTY){console.log('GUIDED_READINESS_BLOCKED:INTERACTIVE_TERMINAL_REQUIRED');return 2;}
    console.log('TIEN404: chỉ kiểm tra. KHONG nhập password, token hoặc URL chứa mật khẩu. KHONG backup.');
    const rl=(deps.createInterface||readline.createInterface)({input:stdin,output:stdout});
    try{
      args.projectRoot=(await rl.question('Thư mục Supabase CLI đã link (ví dụ C:\\TIEN404_LINKED_CLI): ')).trim().replace(/^"|"$/g,'');
      args.outputDir=(await rl.question('Thư mục trống trên ổ mã hóa (ví dụ D:\\TIEN404_PRIVATE_BACKUPS\\snapshot): ')).trim().replace(/^"|"$/g,'');
    }finally{rl.close();}
  }
  // No user path or user data is printed; status only.
  const result=diagnose(args);console.log(JSON.stringify(result,null,2));
  if(result.status==='GUIDED_READINESS_ONLY_PASS')console.log('ĐÃ KIỂM TRA ĐIỀU KIỆN CƠ BẢN. Chưa backup và chưa restore. B-00 vẫn BLOCKED.');
  else console.log('CHƯA ĐẠT. Xem codes trong kết quả; không chia sẻ thư mục hay credentials.');
  return result.status==='GUIDED_READINESS_ONLY_PASS'?0:2;
}
if(require.main===module){main().then(c=>{process.exitCode=c}).catch(()=>{console.error('GUIDED_READINESS_BLOCKED:UNEXPECTED_ERROR');process.exitCode=2;});}
module.exports={EXPECTED_REF,CODES,inside,gitAncestor,commandPresent,diagnose,parseArgs,main};
