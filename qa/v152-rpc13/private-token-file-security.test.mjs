import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readPrivateToken,verifyWindowsPrivateFileAcl}
 from './private-token-file-security.mjs';

const run=promisify(execFile);
const FAKE_TOKEN='QA.'+'x'.repeat(145)+'.signature';
async function withToken(fn) {
 const dir=await mkdtemp(join(tmpdir(),'t404-rpc13-fake-'));
 const path=join(dir,'FAKE-NOT-A-REAL-JWT.txt');
 try {
   await writeFile(path,FAKE_TOKEN,{mode:0o600});
   return await fn({dir,path});
 }finally{await rm(dir,{recursive:true,force:true});}
}
function encodePath(s){return Buffer.from(s,'utf8').toString('base64');}
async function setWindowsAcl(path,mode){
 const b64=encodePath(path);
 const lines=[
  "$ErrorActionPreference='Stop'",
  "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+b64+"'))",
  "$user=[Security.Principal.WindowsIdentity]::GetCurrent().User",
  "$acl=New-Object System.Security.AccessControl.FileSecurity",
  "$acl.SetOwner($user)",
  "$acl.SetAccessRuleProtection($true,$false)",
  "$one=[Security.AccessControl.FileSystemAccessRule]::new($user,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)",
  "$acl.AddAccessRule($one)",
  ...(mode==='everyone' ? [
   "$world=New-Object Security.Principal.SecurityIdentifier('S-1-1-0')",
   "$two=[Security.AccessControl.FileSystemAccessRule]::new($world,[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.AccessControlType]::Allow)",
   "$acl.AddAccessRule($two)"
  ] : []),
  "Set-Acl -LiteralPath $p -AclObject $acl"
 ];
 const {stderr}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',lines.join('\n')],
  {windowsHide:true,timeout:15000,maxBuffer:5000});
 assert.equal(stderr.trim(),'');
}
test('no file fails closed, no provider network',async()=>{
 await assert.rejects(readPrivateToken(join(tmpdir(),'t404-rpc13-nonexistent')),/ENOENT/);
});
test('fake JWT 0600 accepted on POSIX; tests contain no live tokens',{
 skip:process.platform==='win32'
},async()=>withToken(async({path})=>{
 assert.equal(await readPrivateToken(path),FAKE_TOKEN);
}));
test('POSIX 0644 world-readable fake JWT denied',{skip:process.platform==='win32'},
 async()=>withToken(async({path})=>{
  await chmod(path,0o644);
  await assert.rejects(readPrivateToken(path),/PRIVATE_TOKEN_FILE_MODE_OR_SIZE_DENIED/);
 }));
test('POSIX symlink rejected even when target itself is 0600',{skip:process.platform==='win32'},
 async()=>withToken(async({dir,path})=>{
  const link=join(dir,'link.jwt');await symlink(path,link);
  await assert.rejects(readPrivateToken(link),/PRIVATE_TOKEN_FILE_MODE_OR_SIZE_DENIED/);
 }));
test('Windows ACL validator cannot accidentally run on non-Windows',{
 skip:process.platform==='win32'
},async()=>assert.rejects(verifyWindowsPrivateFileAcl('/tmp/none'),
  /WINDOWS_ACL_INSPECTION_ONLY_ON_WINDOWS/));
test('Windows NTFS ACL with only current user is accepted for FAKE JWT',{
 skip:process.platform!=='win32'
},async()=>withToken(async({path})=>{
  await setWindowsAcl(path,'private');
  assert.equal(await verifyWindowsPrivateFileAcl(path),true);
  assert.equal(await readPrivateToken(path),FAKE_TOKEN);
 }));
test('Windows NTFS ACL with Everyone read is denied for FAKE JWT',{
 skip:process.platform!=='win32'
},async()=>withToken(async({path})=>{
  await setWindowsAcl(path,'everyone');
  await assert.rejects(readPrivateToken(path),/PRIVATE_TOKEN_WINDOWS_ACL_DENIED/);
 }));
test('Windows fake JWT symlink/reparse point refused',{
 skip:process.platform!=='win32'
},async()=>withToken(async({dir,path})=>{
  const link=join(dir,'link.jwt');
  try{await symlink(path,link,'file');}
  catch(e){ if(e?.code==='EPERM')return; throw e; }
  await assert.rejects(readPrivateToken(link),/PRIVATE_TOKEN_FILE_MODE_OR_SIZE_DENIED/);
 }));
