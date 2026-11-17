# TIEN404 V17.7H.4 — Windows operator ONLY. NO DOCKER.
# Purpose: at most TWO official read-only Zalo Bot API POST requests:
#   getMe, getWebhookInfo. NO webhook changes, messages or Commerce access.
# This script requires explicit human consent, a Bot ID independently visible
# in Bot Creator, and a token typed locally into a masked prompt.
# NEVER paste the token, URL, receipt, JWT or screenshots containing secrets
# into ChatGPT, GitHub, CI logs, or shared documents.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($env:CI -eq 'true' -or $env:GITHUB_ACTIONS -eq 'true') {
  throw 'PRIVATE_LOCAL_OPERATOR_ONLY_CI_DENIED'
}
$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) { throw 'NODE_JS_22_OR_LATER_REQUIRED' }
$botId = (Read-Host 'Bot ID (digits only, from Bot Creator on your own device)').Trim()
if ($botId -notmatch '^[0-9]{8,24}$') { throw 'BOT_ID_FORMAT_INVALID_STOP' }
Write-Host 'Only POST getMe and getWebhookInfo. No sendMessage, setWebhook, deleteWebhook, getUpdates.'
Write-Host 'WARNING: Token appears in the HTTPS API path but NEVER in output; keep this terminal private.'
Write-Host 'Any existing webhook is preserved. This is not legal proof of Bot Creator/Store ownership.'
$accept = Read-Host 'To authorize these TWO read-only calls now type READONLY'
if ($accept -cne 'READONLY') { throw 'OPERATOR_CANCELLED_NO_NETWORK' }
$secret = Read-Host 'Enter Bot Token locally (masked, never share)' -AsSecureString
$bstr = [IntPtr]::Zero
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $env:T404_H4_BOT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:T404_H4_EXPECTED_BOT_ID = $botId
  $env:T404_H4_OPERATOR_CONSENT = 'OWNER_CONSENT_TWO_READONLY_METHODS_ONLY'
  $entry = Join-Path $PSScriptRoot 'v177h4-private-bot-readback.mjs'
  if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    throw 'LOCAL_SOURCE_NOT_FOUND_STOP'
  }
  & $node.Source $entry
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'NO-GO or existing webhook: do not alter Bot or existing callback.'
  }
}
finally {
  Remove-Item Env:\T404_H4_BOT_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\T404_H4_EXPECTED_BOT_ID -ErrorAction SilentlyContinue
  Remove-Item Env:\T404_H4_OPERATOR_CONSENT -ErrorAction SilentlyContinue
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $secret = $null
  $botId = $null
}
