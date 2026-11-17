# TIEN404 RPC17.8E — Windows no-Docker private backup operator launcher.
# PowerShell 5.1+ / PowerShell 7+. Never send credentials, backup or key to GitHub.
# Default action: Preflight (NO NETWORK CONTACT).
[CmdletBinding()]
param(
  [ValidateSet('Preflight','SchemaBackup','AppDataBackup','Verify')]
  [string]$Action = 'Preflight',
  [string]$DbHost,
  [string]$DbUser,
  [string]$CaCertPath,
  [string]$AgeRecipient,
  [string]$OutputPath,
  [string]$IdentityPath,
  [string]$PgToolsFolder,
  [string]$AgeFolder,
  [switch]$ApproveSensitiveBackup
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$oldPath=$env:PATH
$oldVars=@{}
$names=@('PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT','PGPASSWORD')
foreach($k in $names) { $oldVars[$k]=[Environment]::GetEnvironmentVariable($k,'Process') }
$root=$PSScriptRoot
$backupScript=Join-Path $root 'stream-encrypted-app-backup.mjs'
$verifyScript=Join-Path $root 'verify-encrypted-app-backup.mjs'
$rawPtr=[IntPtr]::Zero
try {
  if($PgToolsFolder) {
    if(!(Test-Path -LiteralPath $PgToolsFolder -PathType Container)){throw 'PG_CLIENT_FOLDER_MISSING'}
    $env:PATH="$PgToolsFolder;$env:PATH"
  }
  if($AgeFolder) {
    if(!(Test-Path -LiteralPath $AgeFolder -PathType Container)){throw 'AGE_FOLDER_MISSING'}
    $env:PATH="$AgeFolder;$env:PATH"
  }
  $node=Get-Command node -ErrorAction SilentlyContinue
  if(!$node){throw 'NODE_22_OR_LATER_REQUIRED'}
  if($Action -eq 'Preflight') {
    Write-Host 'Dry-run: kiểm tra công cụ, KHÔNG truy cập Supabase và KHÔNG tạo bản sao lưu.'
    & $node.Source $backupScript
    exit $LASTEXITCODE
  }
  if($Action -eq 'Verify') {
    if(!$OutputPath -or !$IdentityPath){throw 'ENCRYPTED_FILE_AND_PRIVATE_IDENTITY_REQUIRED'}
    & $node.Source $verifyScript --verify $OutputPath $IdentityPath
    exit $LASTEXITCODE
  }
  if(!$DbHost -or !$DbUser -or !$CaCertPath -or !$AgeRecipient -or !$OutputPath) {
    throw 'MISSING_CONNECTION_OR_ENCRYPTION_ARGUMENTS'
  }
  if(!(Test-Path -LiteralPath $CaCertPath -PathType Leaf)) {
    throw 'SUPABASE_TRUSTED_CA_FILE_REQUIRED_FOR_VERIFY_FULL'
  }
  if($Action -eq 'AppDataBackup' -and !$ApproveSensitiveBackup){
    throw 'EXPLICIT_SENSITIVE_APP_DATA_APPROVAL_REQUIRED'
  }
  $env:PGHOST=$DbHost
  $env:PGPORT='5432'
  $env:PGDATABASE='postgres'
  $env:PGUSER=$DbUser
  $env:PGSSLMODE='verify-full'
  $env:PGSSLROOTCERT=$CaCertPath
  # SecureString prompt: password is never passed in CLI arguments or printed.
  $secure=Read-Host 'Supabase database password (nhập kín, không sao chép vào chat)' -AsSecureString
  $rawPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($rawPtr)
  $mode=if($Action -eq 'SchemaBackup'){'schema-only'}else{'app-data'}
  $args=@('--execute','--mode',$mode,'--recipient',$AgeRecipient,'--output',$OutputPath)
  if($mode -eq 'app-data'){$args+=@('--accept-sensitive')}
  & $node.Source $backupScript @args
  $exitCode=$LASTEXITCODE
  if($exitCode -ne 0){throw 'ENCRYPTED_LOCAL_BACKUP_NOT_COMPLETED'}
  Write-Host 'Backup mã hóa đã tạo. Chưa nghiệm thu khả năng RESTORE.'
} finally {
  if($rawPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($rawPtr)}
  foreach($k in $names){[Environment]::SetEnvironmentVariable($k,$oldVars[$k],'Process')}
  $env:PATH=$oldPath
}
