# TIEN404 CBOT-UAT08A — native Windows fake-archive operator acceptance.
# NEVER uses a real Merchant backup, real database, token, customer file, or remote provider.
# Runs only against the exact separately checked-out, clean and pinned RPC7 commit.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$expected='4f7bef71f54ee17b88449026b90803ccf9743e30'
$repo=$env:GITHUB_WORKSPACE
if ([string]::IsNullOrWhiteSpace($repo) -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  throw 'CI_WINDOWS_SANDBOX_REQUIRED'
}
$rpc7=Join-Path $repo 'rpc7'
$launcher=Join-Path $repo 'qa\cbot-uat08\Invoke-TIEN404-M0-ReadOnly.ps1'
$head=(& git -C $rpc7 rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $head -cne $expected) { throw 'RPC7_PINNED_REF_MISMATCH' }
$dirty=@(& git -C $rpc7 status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -ne 0) { throw 'RPC7_PINNED_CHECKOUT_NOT_CLEAN' }
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw 'LOCAL_LAUNCHER_MISSING' }
$mock=Join-Path $env:RUNNER_TEMP 't404-windows-fake-pg-restore.cmd'
$fake=Join-Path $env:RUNNER_TEMP 't404-windows-fake-archive.bin'
$env:LOCALAPPDATA=Join-Path $env:RUNNER_TEMP 't404-private-evidence-ci'
New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
# Native .cmd is an actual Windows Application but responds only with synthetic TOC.
$mockLines=@(
 '@echo off',
 'if /I not "%~1"=="--list" exit /b 7',
 'echo 1; 0 101 TABLE DATA public tenants postgres',
 'echo 2; 0 102 TABLE DATA public tenant_memberships postgres',
 'echo 3; 0 103 TABLE DATA public products postgres',
 'echo 4; 0 104 TABLE DATA public orders postgres',
 'echo 5; 0 105 TABLE DATA public customers postgres',
 'exit /b 0'
)
[IO.File]::WriteAllLines($mock,$mockLines,[Text.Encoding]::ASCII)
[IO.File]::WriteAllText($fake,'FAKE-NO-REAL-BACKUP'+[Environment]::NewLine,[Text.Encoding]::ASCII)
if ((Get-Command -Name $mock -CommandType Application -ErrorAction Stop).CommandType -ne 'Application') {
  throw 'WINDOWS_CMD_APPLICATION_NOT_FOUND'
}
function Invoke-FakeLauncher([string]$mode,[string]$checkout,[string]$archive='') {
  $call=@('-NoProfile','-NonInteractive','-File',$launcher,
    '-Mode',$mode,'-Rpc7Checkout',$checkout,'-PgRestoreExe',$mock,'-NodeExe','node')
  if ($archive) { $call+=@('-ArchivePath',$archive) }
  $lines=@(& pwsh @call 2>&1)
  $code=$LASTEXITCODE
  return [pscustomobject]@{ ExitCode=$code; Lines=@($lines | ForEach-Object { [string]$_ }) }
}
function Assert-Status($report,[int]$exit,[string[]]$required) {
  if ($report.ExitCode -ne $exit) { throw 'UNEXPECTED_OFFLINE_LAUNCHER_EXIT' }
  foreach ($flag in $required) {
    if ($report.Lines -cnotcontains $flag) { throw ('MISSING_SANITIZED_FLAG_' + ($flag.Split('=')[0])) }
  }
  if ($report.Lines -match [regex]::Escape($env:RUNNER_TEMP)) { throw 'PRIVATE_LOCAL_PATH_LEAKED' }
  if ($report.Lines -contains 'CBOT08_M0_ACCEPTED=true' -or
      $report.Lines -contains 'CBOT08_HOSTED_MIGRATION_AUTHORIZED=true') {
    throw 'HOSTED_RELEASE_ESCALATION'
  }
}
$preflight=Invoke-FakeLauncher 'Preflight' $rpc7
Assert-Status $preflight 0 @('CBOT08_RESULT=LOCAL_TOOLS_READY','CBOT08_RPC7_COMMIT_PINNED=true',
  'CBOT08_ARCHIVE_INSPECTED=false','CBOT08_M0_ACCEPTED=false',
  'CBOT08_HOSTED_MIGRATION_AUTHORIZED=false')
Write-Output 'T404_WIN_PREFLIGHT_PINNED_OK'
$wrong=Invoke-FakeLauncher 'Preflight' $repo
Assert-Status $wrong 3 @('CBOT08_RESULT=BLOCKED','CBOT08_REASON=RPC7_PINNED_COMMIT_MISMATCH',
  'CBOT08_M0_ACCEPTED=false','CBOT08_HOSTED_MIGRATION_AUTHORIZED=false')
Write-Output 'T404_WIN_WRONG_HEAD_REJECTED'
$marker=Join-Path $rpc7 'T404_UNTRACKED_TEST_ONLY'
try {
  [IO.File]::WriteAllText($marker,'synthetic dirty marker',[Text.Encoding]::ASCII)
  $dirtyResult=Invoke-FakeLauncher 'Preflight' $rpc7
  Assert-Status $dirtyResult 3 @('CBOT08_RESULT=BLOCKED',
    'CBOT08_REASON=RPC7_PINNED_CHECKOUT_NOT_CLEAN','CBOT08_M0_ACCEPTED=false',
    'CBOT08_HOSTED_MIGRATION_AUTHORIZED=false')
  Write-Output 'T404_WIN_DIRTY_PIN_REJECTED'
} finally {
  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
}
$inspected=Invoke-FakeLauncher 'InspectExistingArchive' $rpc7 $fake
Assert-Status $inspected 0 @('CBOT08_RESULT=LOCAL_ARCHIVE_INSPECTED_NOT_CERTIFIED',
  'CBOT08_applicationEntries=5','CBOT08_authEntries=0','CBOT08_storageEntries=0',
  'CBOT08_receiptSavedLocally=true','CBOT08_PRIVATE_RESTORE_WITNESSED=false',
  'CBOT08_M0_ACCEPTED=false','CBOT08_HOSTED_MIGRATION_AUTHORIZED=false')
$receipts=@(Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'RPC7_M0_LOCAL_ARCHIVE_*.json' -File -Recurse)
if ($receipts.Count -ne 1) { throw 'PRIVATE_RECEIPT_FILE_NOT_CREATED_ONCE' }
Write-Output 'T404_WIN_FAKE_M0_RECEIPT_ONLY_NOT_CERTIFIED'
Write-Output 'T404_WIN_NATIVE_QA_COMPLETE_NO_REAL_BACKUP_NO_SEND'
