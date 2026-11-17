# TIEN404 V17.7H.4U — PRIVATE Windows discovery of existing Zalo Bot ID.
# No Docker, no Bot ID prerequisite. Exactly one POST getMe (read only).
# No webhook, provider send, Store, Commerce or credential change.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if($env:CI -eq 'true' -or $env:GITHUB_ACTIONS -eq 'true'){
 throw 'PRIVATE_LOCAL_ONLY_CI_DENIED'
}
$node=Get-Command node -ErrorAction SilentlyContinue
if($null -eq $node){throw 'NODE_JS_REQUIRED'}
$version=& $node.Source --version
if($version -notmatch '^v(2[2-9]|[3-9][0-9])\.'){throw 'NODE_22_OR_LATER_REQUIRED'}
Write-Host 'TIEN404 Zalo Bot: read-only getMe to discover numeric Bot ID.'
Write-Host 'Bot Token stays on this private device. DO NOT paste it into ChatGPT/GitHub.'
Write-Host 'getMe does not change the existing webhook or send messages.'
Write-Host 'WARNING: official Bot API carries the token in an HTTPS URL path; disable URL logging/tracing.'
$confirm=(Read-Host 'Type DISCOVER to authorize ONE read-only getMe now').Trim()
if($confirm -cne 'DISCOVER'){throw 'OPERATOR_CANCELLED_NO_NETWORK'}
$script=Join-Path $PSScriptRoot 'v177h4u-private-bot-id-discovery.mjs'
if(!(Test-Path -LiteralPath $script -PathType Leaf)){throw 'LOCAL_SOURCE_NOT_FOUND'}
$secret=Read-Host 'Enter current existing Bot Token on this private PC (masked)' -AsSecureString
$bstr=[IntPtr]::Zero
try{
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 $env:T404_H4U_BOT_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 $env:T404_H4U_OPERATOR_CONSENT='OWNER_CONSENT_GETME_ONLY_LOCAL'
 & $node.Source $script
 if($LASTEXITCODE -ne 0){
  Write-Warning 'PRIVATE READBACK NO-GO. Existing Bot, webhook and Store unchanged.'
 }else{
  Write-Host 'Bot ID displayed locally. DO NOT share Bot ID, token, log or transcript.'
  Write-Host 'Next: independently verify Bot Creator control and use existing H.4 pinned webhook readback if authorized.'
 }
}finally{
 Remove-Item Env:\T404_H4U_BOT_TOKEN -ErrorAction SilentlyContinue
 Remove-Item Env:\T404_H4U_OPERATOR_CONSENT -ErrorAction SilentlyContinue
 if($bstr -ne [IntPtr]::Zero){
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
 }
 $secret=$null
}
