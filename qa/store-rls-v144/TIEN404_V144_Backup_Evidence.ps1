# TIEN404 AI V14.4 — Local PostgreSQL 17 backup evidence helper
# Designed for Windows PowerShell. No network calls, secrets, or destructive SQL.
# DEFAULT: inspect-only. Restore requires -RestoreLocal and a manually created
# EMPTY localhost database named tien404_restore_v144_<suffix>.
param(
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$PgBinDir,
  [switch]$RestoreLocal,
  [string]$RestoreDatabase = '',
  [string]$PgUser = 'postgres',
  [ValidateRange(1,65535)][int]$PgPort = 5432
)
$ErrorActionPreference = 'Stop'
function Fail([string]$Message){ throw "TIEN404 V14.4 BLOCKED: $Message" }
$backup = (Resolve-Path -LiteralPath $BackupPath -ErrorAction Stop).Path
$restoreExe = Join-Path $PgBinDir 'pg_restore.exe'
$psqlExe = Join-Path $PgBinDir 'psql.exe'
if(!(Test-Path -LiteralPath $restoreExe)) { Fail "pg_restore.exe not found in PgBinDir" }
if(!(Test-Path -LiteralPath $psqlExe)) { Fail "psql.exe not found in PgBinDir" }
$info = Get-Item -LiteralPath $backup
if($info.Length -le 0){ Fail 'Backup file empty' }
$sha = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
$manifest = & $restoreExe --list $backup 2>&1
if($LASTEXITCODE -ne 0){ Fail 'pg_restore --list failed: archive invalid, incomplete, or incompatible' }
$manifestText = ($manifest | Out-String)
$required = @('public products','public orders','public customers','public order_items','public conversations','public messages')
$objectFlags = @{}
foreach($object in $required){
  $parts = $object.Split(' ')
  $pattern = '(?im)^\s*\d+;.*\bTABLE\s+' + [regex]::Escape($parts[0]) + '\s+' + [regex]::Escape($parts[1]) + '\s'
  $objectFlags[$parts[1]] = [bool]([regex]::IsMatch($manifestText, $pattern))
}
$evidence = [ordered]@{
  checkpoint = 'TIEN404_V144_LOCAL_BACKUP_EVIDENCE'
  timestamp_utc = [DateTime]::UtcNow.ToString('o')
  file_name = $info.Name
  byte_size = $info.Length
  sha256 = $sha
  manifest_parse_success = $true
  expected_tables_present = $objectFlags
  restore_executed = $false
  restore_status = 'NOT_VERIFIED'
  prod_or_staging_modified = $false
}
if($RestoreLocal){
  # A restore is NOT attempted when the purported full Commerce archive lacks
  # any of the six required tables. Catalog listing alone is still not proof
  # of recoverability, and this guard protects against partial archive drills.
  $missingCoreTables = @($required | Where-Object { -not $objectFlags[$_.Split(' ')[1]] })
  if($missingCoreTables.Count -gt 0) {
    Fail 'Incomplete Commerce archive catalog: local restore refused'
  }
  if($RestoreDatabase -notmatch '^tien404_restore_v144_[a-z0-9_]{4,40}$'){
    Fail 'RestoreDatabase must be a disposable name: tien404_restore_v144_<suffix>'
  }
  # Connect only to local PostgreSQL. Never accept remote host, never use --clean/--create.
  # Database must ALREADY exist and have no user tables (no automatic CREATE/DROP).
  $sql = "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%';"
  $countText = & $psqlExe -X -A -t -v ON_ERROR_STOP=1 -h '127.0.0.1' -p $PgPort -U $PgUser -d $RestoreDatabase -c $sql
  if($LASTEXITCODE -ne 0){ Fail 'Cannot verify empty disposable LOCAL restore database' }
  $count = 0
  if(-not [int]::TryParse(($countText | Out-String).Trim(), [ref]$count)){
    Fail 'Could not parse disposable database table count'
  }
  if($count -ne 0){ Fail 'Disposable restore database is not empty. No restore attempted.' }
  $serverVersion = & $psqlExe -X -A -t -v ON_ERROR_STOP=1 -h '127.0.0.1' -p $PgPort -U $PgUser -d $RestoreDatabase -c 'SHOW server_version_num;'
  if($LASTEXITCODE -ne 0){ Fail 'Could not verify local PostgreSQL server version' }
  $versionCode = 0
  if(-not [int]::TryParse(($serverVersion | Out-String).Trim(), [ref]$versionCode) -or $versionCode -lt 170000 -or $versionCode -ge 180000) {
    Fail 'Local restore target must be isolated PostgreSQL 17.x'
  }
  & $restoreExe --exit-on-error --no-owner --no-privileges -h '127.0.0.1' -p $PgPort -U $PgUser -d $RestoreDatabase $backup
  if($LASTEXITCODE -ne 0){ Fail 'Local restore failed. Inspect the local PostgreSQL logs privately; do not treat as verified.' }
  $checks = & $psqlExe -X -A -t -v ON_ERROR_STOP=1 -h '127.0.0.1' -p $PgPort -U $PgUser -d $RestoreDatabase -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');"
  if($LASTEXITCODE -ne 0){ Fail 'Restore finished but post-restore read-only schema check failed' }
  $evidence.restore_executed = $true
  $evidence.restore_status = 'LOCAL_RESTORE_COMPLETED_SCHEMA_COUNTS_ONLY'
  $evidence.restored_public_table_count = ($checks | Out-String).Trim()
  $evidence.restore_target = $RestoreDatabase
}
# Output contains no credentials or row contents. Do not upload the backup itself.
$evidence | ConvertTo-Json -Depth 4