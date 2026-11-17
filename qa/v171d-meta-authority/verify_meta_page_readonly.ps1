# TIEN404 V17.1-D — Meta Page/App authority READ-ONLY on Windows PowerShell.
# Does not modify Page, App, callback, subscription, credential or any order.
# PRIVATE OPERATOR RUN:
#   .\verify_meta_page_readonly.ps1 -PageId 'your-page-id' -AppId 'your-app-id' -LiveReadOnly
# The token is prompted securely; never paste it into chat, GitHub, logs or command-line args.
param(
 [Parameter(Mandatory=$false)][string]$PageId = '',
 [Parameter(Mandatory=$false)][string]$AppId = '',
 [switch]$LiveReadOnly
)
$ErrorActionPreference = 'Stop'
function Result([string]$status, [string]$reason, [bool]$canRead, [bool]$subscribed){
 return [ordered]@{
   contract = 'T404_V171D_META_PAGE_APP_READONLY_V1'
   status = $status
   reason = $reason
   page_token_can_read_page = $canRead
   expected_app_subscription_visible = $subscribed
   verified_merchant_business_owner = $false
   authorized_to_change_callback = $false
   real_shadow_callback_tested = $false
   real_messenger_send_count = 0
   commerce_writes = 0
 } | ConvertTo-Json -Compress
}
if (-not $LiveReadOnly){
 Write-Output (Result 'BLOCKED' 'EXPLICIT_LIVE_READONLY_OPT_IN_REQUIRED' $false $false)
 exit 2
}
if ($PageId -notmatch '^\d{5,30}$' -or $AppId -notmatch '^\d{5,30}$'){
 Write-Output (Result 'BLOCKED' 'VALID_PAGE_AND_APP_IDS_REQUIRED' $false $false)
 exit 2
}
# Never store tokens on disk, in URLs, in scripts or as shell history parameters.
$secure = Read-Host 'Meta PAGE access token (hidden; never paste into chat)' -AsSecureString
$ptr = [IntPtr]::Zero
$plain = $null
try {
 $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 if ([string]::IsNullOrWhiteSpace($plain)){
  Write-Output (Result 'BLOCKED' 'PAGE_TOKEN_NOT_SUPPLIED' $false $false)
  exit 2
 }
 $headers = @{Authorization = 'Bearer ' + $plain; Accept = 'application/json'}
 $base = 'https://graph.facebook.com/v27.0/'
 $page = Invoke-RestMethod -Method Get -Uri ($base + $PageId + '?fields=id') -Headers $headers -MaximumRedirection 0 -TimeoutSec 12
 if ([string]$page.id -ne $PageId){
  Write-Output (Result 'BLOCKED' 'PAGE_TOKEN_SCOPE_MISMATCH' $false $false)
  exit 2
 }
 $subs = Invoke-RestMethod -Method Get -Uri ($base + $PageId + '/subscribed_apps?fields=id') -Headers $headers -MaximumRedirection 0 -TimeoutSec 12
 $found = $false
 if ($null -ne $subs.data){
  foreach ($item in $subs.data){
   if ([string]$item.id -eq $AppId){$found=$true; break}
  }
 }
 if ($found){
  Write-Output (Result 'APP_SUBSCRIPTION_VISIBLE_OWNER_UNVERIFIED' 'READ_ONLY_APP_INSTALLATION_EVIDENCE_NOT_OWNER_PROOF' $true $true)
  exit 0
 }
 Write-Output (Result 'APP_SUBSCRIPTION_NOT_VISIBLE' 'APP_INSTALLATION_MISSING_OR_NOT_VISIBLE' $true $false)
 exit 2
} catch {
 # Never output exception detail: provider errors may contain sensitive account metadata.
 Write-Output (Result 'BLOCKED' 'GRAPH_READ_FAILED_OR_SCOPE_NOT_GRANTED' $false $false)
 exit 2
} finally {
 $plain = $null
 $secure = $null
 if ($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
