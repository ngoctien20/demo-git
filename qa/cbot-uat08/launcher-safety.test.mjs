import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('./Invoke-TIEN404-M0-ReadOnly.ps1',import.meta.url);
const text=readFileSync(path,'utf8');
// These tests validate only source shape and safety boundaries.
// The separate CI job exercises the PowerShell runner with a PINNED real
// RPC7 source checkout, including Preflight and invalid local archive.
const source=text.replace(/^\s*#.*$/gm,'');
test('01 trusted exact RPC7 PR198 commit pinned',()=>assert.match(source,/4f7bef71f54ee17b88449026b90803ccf9743e30/));
test('02 avoids creating second archive implementation',()=>assert.match(source,/Inspect-TIEN404-RPC7-M0\.ps1/));
test('03 checks two genuine RPC7 classifier sources',()=>{
 assert.match(source,/local-archive-coverage-cli\.cjs/);
 assert.match(source,/local-m0-archive-receipt-cli\.cjs/);
});
test('04 verifies Git HEAD equality before any file access',()=>{
 assert.ok(source.indexOf('rev-parse HEAD')<source.indexOf('GetFullPath($ArchivePath)'));
 assert.match(source,/RPC7_PINNED_COMMIT_MISMATCH/);
});
test('05 no write, upload, credential or provider transport API call',()=>{
 for(const re of [
  /\bInvoke-RestMethod\b/i,/\bInvoke-WebRequest\b/i,/\bStart-BitsTransfer\b/i,
  /\bcurl(?:\.exe)?\s+/i,/\bpg_dump\s+[-$]/i,/\bdocker\s+(?:exec|cp|run)\b/i,
  /pg_restore\s+[-]d\b/i,/\bSet-AzKeyVaultSecret\b/i,
  /\bCreate-Order\b/i,/\bALTER\s+TABLE\b/i,/\bGRANT\s+EXECUTE\b/i,
  /\bREVOKE\s+EXECUTE\b/i
 ])assert.doesNotMatch(source,re,String(re));
});
test('06 Preflight never prompts for existing archive',()=>{
 const a=source.indexOf('if ($Mode -eq "Preflight")');
 const b=source.indexOf('if ([string]::IsNullOrWhiteSpace($ArchivePath))');
 assert.ok(a>0&&b>a);
});
test('07 private archive cannot be inside public Git checkout',()=>assert.match(source,/PRIVATE_ARCHIVE_INSIDE_REPOSITORY_NOT_ALLOWED/));
test('08 baseline sha and byte mismatches passed to original read only inspector',()=>{
 assert.match(source,/ExpectedSha256/);assert.match(source,/ExpectedBytes/);
});
test('09 original script forced to application with external Auth+Storage plan',()=>assert.match(source,/APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN/));
test('10 private evidence CLI output whitelisted',()=>{
 assert.match(source,/receiptSavedLocally/);assert.match(source,/applicationEntries/);
 assert.match(source,/authEntries/);assert.match(source,/storageEntries/);
});
test('11 script never certifies M0 or hosted migration on successful local check',()=>{
 assert.match(source,/CBOT08_M0_ACCEPTED=false/);
 assert.match(source,/CBOT08_HOSTED_MIGRATION_AUTHORIZED=false/);
 assert.match(source,/CBOT08_PRIVATE_RESTORE_WITNESSED=false/);
});
test('12 catches local tool/archival failure without printing raw exception/path',()=>{
 assert.match(source,/RPC7_LOCAL_INSPECTION_FAILURE_/);
 assert.doesNotMatch(source,/Write-Output\s+\$ArchivePath/i);
 assert.doesNotMatch(source,/Write-Output\s+\$_.Exception/i);
});

test('13 rejects dirty or injected working checkout even when pinned SHA matches',()=>{
 assert.match(source,/status --porcelain --untracked-files=all/);
 assert.match(source,/RPC7_PINNED_CHECKOUT_NOT_CLEAN/);
 assert.ok(source.indexOf('status --porcelain')<source.indexOf('GetFullPath($ArchivePath)'));
});
