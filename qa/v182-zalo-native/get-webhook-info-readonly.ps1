# TIEN404 V18.2 Zalo QA — READ ONLY. Run locally with secured QA Bot token.
# Never paste tokens into ChatGPT, GitHub, console screenshots, or n8n execution data.
# Does not call setWebhook, deleteWebhook, getUpdates, or sendMessage.
# Requires process environment variable TIEN404_ZALO_QA_BOT_TOKEN.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$qaToken = [Environment]::GetEnvironmentVariable('TIEN404_ZALO_QA_BOT_TOKEN', 'Process')
if ([string]::IsNullOrWhiteSpace($qaToken)) {
    throw 'QA_BOT_TOKEN_NOT_PRESENT_IN_PROCESS_ENVIRONMENT'
}
if ($qaToken.Length -gt 1024 -or $qaToken -match '[\s/?#]') {
    throw 'QA_BOT_TOKEN_FORMAT_NOT_ADMISSIBLE'
}
$apiBase = 'https://bot-api.zaloplatforms.com/bot' + $qaToken
try {
    $who = Invoke-RestMethod -Method Post -Uri ($apiBase + '/getMe') -Body '{}' -ContentType 'application/json' -TimeoutSec 12
    $info = Invoke-RestMethod -Method Post -Uri ($apiBase + '/getWebhookInfo') -Body '{}' -ContentType 'application/json' -TimeoutSec 12
} catch {
    # Do not print exception: an HTTP error may contain the URL with the Bot token.
    throw 'ZALO_QA_READONLY_API_FAILED_DETAILS_REDACTED'
} finally {
    Remove-Variable qaToken -ErrorAction SilentlyContinue
    Remove-Variable apiBase -ErrorAction SilentlyContinue
}
if ($who.ok -ne $true -or $info.ok -ne $true) {
    throw 'ZALO_QA_READONLY_PROVIDER_NOT_OK'
}
$expectedBotId = '1556301397801600805'
$expectedQaPath = '/webhook/tien404-zalo-qa-v18-1-locked'
$expectedN8nHost = 'ngoctien20.app.n8n.cloud'
$rawUrl = [string]$info.result.url
$actualUri = $null
if (![string]::IsNullOrEmpty($rawUrl)) {
    $parsed = $null
    if ([uri]::TryCreate($rawUrl, [uriKind]::Absolute, [ref]$parsed)) {
        $actualUri = $parsed
    }
}
$botMatch = ([string]$who.result.id -ceq $expectedBotId)
$qaTarget = ($null -ne $actualUri -and
             $actualUri.Scheme -eq 'https' -and
             $actualUri.Host -ceq $expectedN8nHost -and
             $actualUri.AbsolutePath -ceq $expectedQaPath -and
             [string]::IsNullOrEmpty($actualUri.Query) -and
             [string]::IsNullOrEmpty($actualUri.Fragment))
$webhookConfigured = (![string]::IsNullOrEmpty($rawUrl))
[pscustomobject]@{
    result                     = 'QA_GETWEBHOOKINFO_READONLY'
    bot_identity_match         = $botMatch
    webhook_configured         = $webhookConfigured
    points_to_n8n_qa_locked    = $qaTarget
    needs_independent_review   = $true
    webhook_modified           = $false
    messages_sent              = 0
    order_writes               = 0
    token_displayed            = $false
    secret_rotated             = $false
}
