// RPC13.1 — locally held Auth JWT file admission, Windows NTFS / POSIX.
// Fails closed. No tokens or private identities leave the process.
// The PowerShell child receives only a base64-encoded FILE PATH, never JWT data.
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const runFile=promisify(execFile);
const ERR='PRIVATE_TOKEN_FILE_MODE_OR_SIZE_DENIED';
const WIN_ERR='PRIVATE_TOKEN_WINDOWS_ACL_DENIED';
const reject=code=>{throw new Error(code);};

export async function verifyWindowsPrivateFileAcl(filepath){
 if(process.platform!=='win32')return reject('WINDOWS_ACL_INSPECTION_ONLY_ON_WINDOWS');
 const encoded=Buffer.from(resolve(filepath),'utf8').toString('base64');
 // Validate real Windows account SID rather than localized account names.
 const ps=[
  "$ErrorActionPreference='Stop'",
  "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"'))",
  "$item=Get-Item -LiteralPath $p -Force -ErrorAction Stop",
  "if($item.PSIsContainer){exit 21}",
  "if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){exit 22}",
  "$current=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
  "$acl=Get-Acl -LiteralPath $p -ErrorAction Stop",
  "$owner=(New-Object -TypeName Security.Principal.NTAccount -ArgumentList $acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value",
  "if($owner -ne $current){exit 23}",
  "$allowed=@($current,'S-1-5-18','S-1-5-32-544')",
  "$rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])",
  "$hasRead=$false",
  "foreach($r in $rules){",
  "if($r.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow){exit 24}",
  "if($allowed -notcontains $r.IdentityReference.Value){exit 25}",
  "if($r.IdentityReference.Value -eq $current -and (($r.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadData) -ne 0)){$hasRead=$true}",
  "}",
  "if(-not $hasRead){exit 26}",
  "Write-Output 'ACL_OK'"
 ].join('\n');
 try{
  const {stdout}=await runFile('powershell.exe',
   ['-NoProfile','-NonInteractive','-Command',ps],
   {windowsHide:true,timeout:12000,maxBuffer:4096});
  if(stdout.trim()!=='ACL_OK')reject(WIN_ERR);
 }catch{reject(WIN_ERR);}
 return true;
}

function sameFile(a,b){
 return a.isFile()&&b.isFile()&&!a.isSymbolicLink()&&!b.isSymbolicLink()
   &&a.dev===b.dev&&a.ino===b.ino;
}

export async function readPrivateToken(filepath){
 const path=resolve(filepath);
 const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||
    before.size<100||before.size>10000)reject(ERR);
 if(process.platform==='win32')await verifyWindowsPrivateFileAcl(path);
 else if((before.mode&0o077)!==0)reject(ERR);
 const fd=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try {
  const opened=await fd.stat();
  if(!sameFile(before,opened)||opened.size<100||opened.size>10000)reject(ERR);
  if(process.platform!=='win32'&&(opened.mode&0o077)!==0)reject(ERR);
  const text=(await fd.readFile({encoding:'utf8'})).trim();
  const after=await lstat(path);
  if(!sameFile(opened,after)||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs)reject(ERR);
  if(!/^[A-Za-z0-9._-]+$/.test(text)||text.split('.').length!==3)reject('INVALID_TOKEN_FILE');
  return text;
 }finally{await fd.close();}
}
