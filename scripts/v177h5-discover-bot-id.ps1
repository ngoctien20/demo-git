# TIEN404 V17.7H.5 — PRIVATE WINDOWS GETME-ONLY ID DISCOVERY.
# Run only in a private terminal, no screen recording or transcript.
# Does not call getWebhookInfo, sendMessage, setWebhook, deleteWebhook or getUpdates.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($env:CI -eq 'true' -or $env:GITHUB_ACTIONS -eq 'true') {
 throw 'LOCAL_ONLY_CI_DENIED'
}
$node=Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {throw 'NODE_JS_22_OR_LATER_REQUIRED'}
Write-Host 'TIEN404 Zalo Bot — discover Bot ID by ONE read-only getMe POST.'
Write-Host 'Bot Token must stay on this trusted device. No webhook configuration changes.'
Write-Host 'This only confirms token access to a Bot; it cannot prove the human or Store owner.'
$consent=Read-Host 'Type READID to allow exactly ONE getMe request'
if ($consent -cne 'READID') {throw 'CANCELLED_NO_NETWORK'}
$secret=Read-Host 'Bot Token (private masked input)' -AsSecureString
$bstr=[IntPtr]::Zero
try{
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 $env:T404_H5_BOT_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 $env:T404_H5_CONSENT='OWNER_CONSENT_GETME_DISCOVERY_ONLY'
 $entry=Join-Path $PSScriptRoot 'v177h5-discover-bot-id.mjs'
 if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
  throw 'SOURCE_MISSING_NO_NETWORK'
 }
 & $node.Source $entry
 if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Discovery failed or denied. Do not rotate or modify existing Bot.'
 }
}finally{
 Remove-Item Env:\T404_H5_BOT_TOKEN -ErrorAction SilentlyContinue
 Remove-Item Env:\T404_H5_CONSENT -ErrorAction SilentlyContinue
 if ($bstr -ne [IntPtr]::Zero) {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
 }
 $secret=$null
}
