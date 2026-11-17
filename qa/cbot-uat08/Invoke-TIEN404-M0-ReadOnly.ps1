# TIEN404 CBOT-UAT-08 — PRIVATE WINDOWS EXISTING-ARCHIVE OPERATOR LAUNCHER
# This wrapper reuses the EXACT trusted PR #198 RPC.7 operator script.
# No DB connection, no pg_dump, no hosted backup export, no remote API,
# no credentials, no provider send, no Docker, no Postgres restore -d.
#
# Use with a SEPARATE local checkout of RPC.7 PR #198 at pinned commit.
# Script is Windows PowerShell 5.1+/PowerShell 7 compatible by design.
[CmdletBinding()]
param(
  [ValidateSet("Preflight","InspectExistingArchive")]
  [string]$Mode = "Preflight",
  [string]$Rpc7Checkout = "",
  [string]$ArchivePath = "",
  [string]$PgRestoreExe = "pg_restore",
  [string]$NodeExe = "node",
  [string]$ExpectedArchiveSha256 = "",
  [Nullable[long]]$ExpectedArchiveBytes = $null
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PinnedRpc7Sha = "4f7bef71f54ee17b88449026b90803ccf9743e30"
function Stop-Safely([string]$Code) {
  if ($Code -notmatch '^[A-Z0-9_]{4,90}$') { $Code = "UNSPECIFIED_LOCAL_PRECHECK_FAILURE" }
  Write-Output ("CBOT08_RESULT=BLOCKED")
  Write-Output ("CBOT08_REASON=" + $Code)
  Write-Output "CBOT08_M0_ACCEPTED=false"
  Write-Output "CBOT08_HOSTED_MIGRATION_AUTHORIZED=false"
  exit 3
}
if ([string]::IsNullOrWhiteSpace($Rpc7Checkout)) {
  $Rpc7Checkout = Read-Host "Path to separate RPC7 PR198 local Git checkout"
}
if ([string]::IsNullOrWhiteSpace($Rpc7Checkout)) {
  Stop-Safely "RPC7_CHECKOUT_REQUIRED"
}
 $preflightStage = "CHECKOUT_PATH"
try {
  $root = [IO.Path]::GetFullPath($Rpc7Checkout)
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    Stop-Safely "RPC7_CHECKOUT_MISSING"
  }
  $preflightStage = "GIT_BINARY"
  $gitCmd = Get-Command -Name "git" -CommandType Application -ErrorAction Stop
  $preflightStage = "PINNED_HEAD"
  $headOutput = @(& git -C $root rev-parse HEAD 2>$null)
  $headSucceeded = $?
  if (-not $headSucceeded -or $headOutput.Count -ne 1 -or
      [string]$headOutput[0] -cne $PinnedRpc7Sha) {
    Stop-Safely "RPC7_PINNED_COMMIT_MISMATCH"
  }
  # A pinned HEAD alone is not sufficient if local tracked scripts are modified.
  # Reject all uncommitted/untracked files in the separate RPC7 checkout.
  $preflightStage = "CLEAN_CHECKOUT"
  $dirty = @(& git -C $root status --porcelain --untracked-files=all 2>$null)
  $statusSucceeded = $?
  if (-not $statusSucceeded -or $dirty.Count -gt 0) {
    Stop-Safely "RPC7_PINNED_CHECKOUT_NOT_CLEAN"
  }
  $preflightStage = "RPC7_SOURCE_FILES"
  $src = Join-Path $root "qa\v152-rpc7"
  $inspector = Join-Path $src "Inspect-TIEN404-RPC7-M0.ps1"
  foreach ($name in @(
    "Inspect-TIEN404-RPC7-M0.ps1",
    "local-archive-coverage-cli.cjs",
    "local-m0-archive-receipt-cli.cjs"
  )) {
    if (-not (Test-Path -LiteralPath (Join-Path $src $name) -PathType Leaf)) {
      Stop-Safely "RPC7_PINNED_SOURCE_INCOMPLETE"
    }
  }
  $preflightStage = "NODE_BINARY"
  $node = Get-Command -Name $NodeExe -CommandType Application -ErrorAction Stop
  $preflightStage = "PG_RESTORE_BINARY"
  $pgRestore = Get-Command -Name $PgRestoreExe -CommandType Application -ErrorAction Stop
  if ($null -eq $node -or $null -eq $pgRestore) {
    Stop-Safely "NODE_OR_PG_RESTORE_NOT_AVAILABLE"
  }
} catch {
  # Report only the exception CLASS (never the message or private paths).
  $safeErrorClass = [regex]::Replace([string]$_.Exception.GetType().Name,'[^A-Za-z0-9]','')
  Write-Output ("CBOT08_PRECHECK_EXCEPTION_CLASS=" + $safeErrorClass)
  $safeErrorId = [regex]::Replace([string]$_.FullyQualifiedErrorId, '[^A-Za-z0-9_]', '_')
  if ($safeErrorId.Length -gt 100) { $safeErrorId = $safeErrorId.Substring(0,100) }
  Write-Output ("CBOT08_PRECHECK_ERROR_ID=" + $safeErrorId)
  Stop-Safely ("RPC7_PREFLIGHT_FAILURE_" + $preflightStage)
}
# No archive read occurs during Preflight.
if ($Mode -eq "Preflight") {
  Write-Output "CBOT08_RESULT=LOCAL_TOOLS_READY"
  Write-Output "CBOT08_RPC7_COMMIT_PINNED=true"
  Write-Output "CBOT08_ARCHIVE_INSPECTED=false"
  Write-Output "CBOT08_M0_ACCEPTED=false"
  Write-Output "CBOT08_HOSTED_MIGRATION_AUTHORIZED=false"
  exit 0
}
if ([string]::IsNullOrWhiteSpace($ArchivePath)) {
  $ArchivePath = Read-Host "Path to EXISTING private backup archive (never upload)"
}
try {
  if ([string]::IsNullOrWhiteSpace($ArchivePath) -or
      -not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
    Stop-Safely "EXISTING_PRIVATE_ARCHIVE_NOT_ACCESSIBLE"
  }
  # Avoid accidentally keeping a private archive inside a public Git checkout.
  $archiveAbsolute = [IO.Path]::GetFullPath($ArchivePath)
  $rootAbsolute = [IO.Path]::GetFullPath($root).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
  if ($archiveAbsolute.StartsWith($rootAbsolute,[StringComparison]::OrdinalIgnoreCase)) {
    Stop-Safely "PRIVATE_ARCHIVE_INSIDE_REPOSITORY_NOT_ALLOWED"
  }
  if ($ExpectedArchiveSha256 -ne "" -and $ExpectedArchiveSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    Stop-Safely "EXPECTED_ARCHIVE_SHA256_INVALID"
  }
  if ($null -ne $ExpectedArchiveBytes -and [long]$ExpectedArchiveBytes -le 0) {
    Stop-Safely "EXPECTED_ARCHIVE_BYTES_INVALID"
  }
  $callArgs = @{
    ArchivePath = $archiveAbsolute
    RecoveryScope = "APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN"
    PgRestoreExe = $PgRestoreExe
    NodeExe = $NodeExe
  }
  if ($ExpectedArchiveSha256 -ne "") { $callArgs.ExpectedSha256 = $ExpectedArchiveSha256 }
  if ($null -ne $ExpectedArchiveBytes) { $callArgs.ExpectedBytes = $ExpectedArchiveBytes }
  # This is the existing RPC7 READ-ONLY script. Its receipt is written only
  # under the operator's local private-evidence directory; NEVER public Git.
  $output = @(& $inspector @callArgs 2>$null)
  # Parse ONLY explicitly allowlisted, non-sensitive terminal status keys.
  $allowed = @(
    "classification","localEvidenceStatus","referenceHashMatches",
    "referenceBytesMatches","applicationEntries","authEntries",
    "storageEntries","receiptSavedLocally","m0Approved","m1Authorized"
  )
  $summary = @{}
  foreach ($line in $output) {
    $raw = [string]$line
    $separator = $raw.IndexOf('=')
    if ($separator -lt 1) { continue }
    $key = $raw.Substring(0,$separator)
    $value = $raw.Substring($separator+1)
    if ($key -notmatch '^[A-Za-z][A-Za-z0-9]*
    if ($value -notmatch '^[A-Za-z0-9_+-]{0,100}$') { continue }
    if ($allowed -contains $key) { $summary[$key] = $value }
  }
  if ($summary["receiptSavedLocally"] -ne "true" -or
      $summary["m0Approved"] -ne "false" -or
      $summary["m1Authorized"] -ne "false") {
    Write-Output ("CBOT08_SAFE_RECEIPT_FIELD_COUNT=" + $summary.Count)
    Stop-Safely "RPC7_READ_ONLY_RECEIPT_NOT_CONFIRMED"
  }
  Write-Output "CBOT08_RESULT=LOCAL_ARCHIVE_INSPECTED_NOT_CERTIFIED"
  foreach ($key in $allowed) {
    if ($summary.ContainsKey($key)) {
      Write-Output ("CBOT08_" + $key + "=" + $summary[$key])
    }
  }
  Write-Output "CBOT08_PRIVATE_RESTORE_WITNESSED=false"
  Write-Output "CBOT08_M0_ACCEPTED=false"
  Write-Output "CBOT08_HOSTED_MIGRATION_AUTHORIZED=false"
  Write-Output "CBOT08_NEXT=INDEPENDENT_PRIVATE_AUTH_STORAGE_ACL_OFFHOST_RESTORE"
} catch {
  # Do NOT echo raw exception (may contain local path, script line, input hash).
  Stop-Safely "LOCAL_ARCHIVE_INSPECTION_BLOCKED"
}
) { continue }
    if ($value -notmatch '^[A-Za-z0-9_+-]{0,100}$') { continue }
    if ($allowed -contains $key) { $summary[$key] = $value }
  }
  if ($summary["receiptSavedLocally"] -ne "true" -or
      $summary["m0Approved"] -ne "false" -or
      $summary["m1Authorized"] -ne "false") {
    Write-Output ("CBOT08_SAFE_RECEIPT_FIELD_COUNT=" + $summary.Count)
    Stop-Safely "RPC7_READ_ONLY_RECEIPT_NOT_CONFIRMED"
  }
  Write-Output "CBOT08_RESULT=LOCAL_ARCHIVE_INSPECTED_NOT_CERTIFIED"
  foreach ($key in $allowed) {
    if ($summary.ContainsKey($key)) {
      Write-Output ("CBOT08_" + $key + "=" + $summary[$key])
    }
  }
  Write-Output "CBOT08_PRIVATE_RESTORE_WITNESSED=false"
  Write-Output "CBOT08_M0_ACCEPTED=false"
  Write-Output "CBOT08_HOSTED_MIGRATION_AUTHORIZED=false"
  Write-Output "CBOT08_NEXT=INDEPENDENT_PRIVATE_AUTH_STORAGE_ACL_OFFHOST_RESTORE"
} catch {
  # Do NOT echo raw exception (may contain local path, script line, input hash).
  Stop-Safely "LOCAL_ARCHIVE_INSPECTION_BLOCKED"
}
