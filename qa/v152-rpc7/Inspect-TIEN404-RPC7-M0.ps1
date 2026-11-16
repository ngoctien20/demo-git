# TIEN404 RPC.7 — LOCAL READ-ONLY EXISTING BACKUP AUDIT
# This script hashes an EXISTING local backup and calls pg_restore --list.
# It never invokes pg_dump, pg_restore -d, docker cp, hosted SQL, network,
# uploads, credential readers or any production mutation.
# Private receipt is written outside the Git working tree by default.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ArchivePath,
  [ValidateSet("FULL_SERVICE","APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN")]
  [string]$RecoveryScope = "APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN",
  [string]$ExpectedSha256 = "",
  [Nullable[long]]$ExpectedBytes = $null,
  [string]$PgRestoreExe = "pg_restore",
  [string]$NodeExe = "node",
  [string]$PrivateEvidenceDir = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
function Deny([string]$Reason) { throw ("RPC7_LOCAL_ONLY: " + $Reason) }
if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
  Deny "EXISTING_ARCHIVE_NOT_ACCESSIBLE_ON_THIS_MACHINE"
}
if ($ExpectedSha256 -ne "" -and $ExpectedSha256 -notmatch '^[0-9a-fA-F]{64}$') {
  Deny "EXPECTED_SHA256_NOT_HEX64"
}
if ($null -ne $ExpectedBytes -and [long]$ExpectedBytes -le 0) {
  Deny "EXPECTED_SIZE_INVALID"
}
$archive = Get-Item -LiteralPath $ArchivePath
if ($archive.Length -le 0) { Deny "ARCHIVE_EMPTY" }
if (-not (Test-Path -LiteralPath "$PSScriptRoot\local-archive-coverage-cli.cjs" -PathType Leaf) -or
    -not (Test-Path -LiteralPath "$PSScriptRoot\local-m0-archive-receipt-cli.cjs" -PathType Leaf)) {
  Deny "RPC7_SOURCE_PACKAGE_INCOMPLETE"
}
try {
  $restoreTool = (Get-Command -Name $PgRestoreExe -CommandType Application -ErrorAction Stop).Source
  $nodeTool = (Get-Command -Name $NodeExe -CommandType Application -ErrorAction Stop).Source
} catch {
  Deny "PG_RESTORE_OR_NODE_NOT_INSTALLED_OR_EXPLICIT_BINARY_PATH_REQUIRED"
}
# Get-FileHash is read-only; do not upload the archive to GitHub or ChatGPT.
$sha = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
# The raw TOC stays in volatile local process memory and is never saved.
# Capture exit status BEFORE running the Node classifier.
$toc = @(& $restoreTool --list $archive.FullName 2>$null)
$restoreExit = $LASTEXITCODE
if ($restoreExit -ne 0 -or $toc.Count -eq 0) {
  Deny "PG_RESTORE_LIST_FAILED"
}
$coverageText = ($toc -join [Environment]::NewLine) |
  & $nodeTool "$PSScriptRoot\local-archive-coverage-cli.cjs"
if ($LASTEXITCODE -ne 0) { Deny "LOCAL_ARCHIVE_COVERAGE_REJECTED" }
try { $coverage = $coverageText | ConvertFrom-Json } catch {
  Deny "LOCAL_ARCHIVE_COVERAGE_JSON_INVALID"
}
# The earlier CLI prints only classification and coverage. Build the full
# internal classifier contract here from its non-sensitive summary.
$entryCounts = $coverage.tableDataCoverage
$tocContract = [ordered]@{
  contract = "T404_RPC7_LOCAL_ARCHIVE_COVERAGE_V1"
  status = [string]$coverage.classification
  coverage = $entryCounts
  completeRestoreProven = $false
}
$expectedSha = $null
if ($ExpectedSha256 -ne "") {
  $expectedSha = $ExpectedSha256.ToLowerInvariant()
}
$expectedSizeValue = $null
if ($null -ne $ExpectedBytes) { $expectedSizeValue = [long]$ExpectedBytes }
$payload = [ordered]@{
  contract = "T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_INPUT_V1"
  observedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  archiveSha256 = $sha
  archiveBytes = [long]$archive.Length
  expectedSha256 = $expectedSha
  expectedBytes = $expectedSizeValue
  scope = $RecoveryScope
  tocResult = $tocContract
}
$receiptText = ($payload | ConvertTo-Json -Depth 12 -Compress) |
  & $nodeTool "$PSScriptRoot\local-m0-archive-receipt-cli.cjs"
if ($LASTEXITCODE -ne 0) { Deny "RPC7_LOCAL_RECEIPT_REJECTED" }
try { $receipt = $receiptText | ConvertFrom-Json } catch {
  Deny "RPC7_LOCAL_RECEIPT_JSON_INVALID"
}
# Local-only receipt storage: never write inside repository by default.
if ($PrivateEvidenceDir -eq "") {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    Deny "EXPLICIT_PRIVATE_EVIDENCE_DIRECTORY_REQUIRED"
  }
  $PrivateEvidenceDir = Join-Path $env:LOCALAPPDATA "TIEN404\private-evidence"
}
New-Item -ItemType Directory -Path $PrivateEvidenceDir -Force | Out-Null
$reportName = "RPC7_M0_LOCAL_ARCHIVE_" + (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmss_fff") + ".json"
$reportPath = Join-Path $PrivateEvidenceDir $reportName
$receiptText | Set-Content -LiteralPath $reportPath -Encoding UTF8 -NoNewline
# Do not print path/hash/raw TOC: only safe summary to terminal.
Write-Output ("classification=" + $receipt.tocClassification)
Write-Output ("localEvidenceStatus=" + $receipt.status)
Write-Output ("referenceHashMatches=" + [string]$receipt.referenceHashMatches)
Write-Output ("referenceBytesMatches=" + [string]$receipt.referenceBytesMatches)
Write-Output ("applicationEntries=" + [string]$receipt.coverage.applicationDataEntries)
Write-Output ("authEntries=" + [string]$receipt.coverage.authDataEntries)
Write-Output ("storageEntries=" + [string]$receipt.coverage.storageDataEntries)
Write-Output "receiptSavedLocally=true"
Write-Output "m0Approved=false"
Write-Output "m1Authorized=false"
if ($receipt.status -eq "LOCAL_ARCHIVE_BASELINE_MISMATCH") {
  Write-Error "RPC7_ARCHIVE_MISMATCH_KEEP_HOSTED_MIGRATION_BLOCKED"
  exit 3
}
# A successful local check never authorizes live export or migration.
