# TIEN404 V17.7H.6 — Private webhook URL comparison. Windows PowerShell 5.1.
# NO Zalo Bot Token, NO webhook Secret Token, NO API calls and NO CONFIG CHANGES.
# Paste the full SAVED URL from Bot Creator, then the n8n PRODUCTION POST URL.
# URLs are masked as typed and never displayed by this script.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($env:CI -eq 'true' -or $env:GITHUB_ACTIONS -eq 'true') {
 throw 'CI_DISALLOWED'
}
$node=Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {throw 'NODE_JS_22_REQUIRED'}
$entry=Join-Path $PSScriptRoot 'v177h6-private-compare-webhook-ui.mjs'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {throw 'SOURCE_MISSING'}
Write-Host 'TIEN404 — compare webhook URL shown in Zalo Bot Creator vs Published POST Production URL in n8n.'
Write-Host 'DO NOT input Bot Token or webhook Secret Token. Do not click Save or Delete Webhook.'
Write-Host 'This uses LOCAL UI strings only; it cannot verify provider-native ownership.'
$consent=Read-Host 'Type COMPARE to check exactly two pasted URLs locally'
if ($consent -cne 'COMPARE') {throw 'CANCELLED_NO_INPUT_NO_NETWORK'}
$creator=Read-Host 'Paste full SAVED Zalo Bot Creator Webhook URL (masked)' -AsSecureString
$n8n=Read-Host 'Paste full n8n Published POST Production URL (masked)' -AsSecureString
$a=[IntPtr]::Zero;$b=[IntPtr]::Zero
try{
 $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($creator)
 $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($n8n)
 $env:T404_H6_CREATOR_WEBHOOK_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a)
 $env:T404_H6_N8N_WEBHOOK_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
 $env:T404_H6_CONSENT='COMPARE_PRIVATE_UI_ONLY'
 & $node.Source $entry
 if ($LASTEXITCODE -ne 0) {
  Write-Warning 'No exact local UI match proven; STOP. Do not change or re-register webhook.'
 }
}finally{
 Remove-Item Env:\T404_H6_CREATOR_WEBHOOK_URL -ErrorAction SilentlyContinue
 Remove-Item Env:\T404_H6_N8N_WEBHOOK_URL -ErrorAction SilentlyContinue
 Remove-Item Env:\T404_H6_CONSENT -ErrorAction SilentlyContinue
 if ($a -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a)}
 if ($b -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 $creator=$null;$n8n=$null
}
