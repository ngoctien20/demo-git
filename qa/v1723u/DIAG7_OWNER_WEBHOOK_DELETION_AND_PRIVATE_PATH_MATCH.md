# V17.23U-DIAG7 — Owner Webhook Deletion × Private Route Mismatch Review

**Classification:** VERIFIED Cloudflare locked; OWNER-ATTESTED Zalo webhook deleted; actual Zalo provider deletion API status PENDING; prior HTTP 404 reason and sender UNPROVEN; no hosted changes.

## Owner rollback confirmation

User explicitly confirmed **"Đã xóa webhook QA"** following the 2026-11-18 06:32 JST challenge attempt. This is **OWNER-ATTESTED only**, not a Zalo Bot API `getWebhookInfo` result. Do not promote this to independently verified provider deletion.

## Direct Cloudflare postflight (read-only)

At approximately **2026-11-18 06:35:55 JST**, account-scoped Cloudflare API verified:
- Worker `tien404-v1723u-qa-inbound-locked-staging`: `workers.dev=false`; preview URLs `false`; no custom domain attached.
- Deployed version still `20f281c4-c568-45c9-bd7b-e63a0e7d1fc4`.
- `QA_CANARY_MODE=OWNER_SCOPED_PRIVATE_NO_SEND_ONCE`; bounded window at time of check `QA_START_MS=1794950538271` and `QA_END_MS=1794951738271`.
- Disposable D1 `qa_canary_once` accepted receipt count **0**.
- Existing `QA_HEADER_SECRET`, `QA_CALLBACK_PATH`, `QA_CHALLENGE`, `QA_EVENT_PEPPER` remain `secret_text`; their values were not retrieved.

At a second read-only analytics check for **2026-11-17 21:30–21:36 UTC**, `events.workersInvocations` (sampled/delayed) showed only weighted **HTTP 404=1 at 21:32 UTC**. There were no observed 200 responses in this filtered sample. This cannot prove whether Zalo, the owner, or a probe made the request.

GitHub source branch implementation:
- Before all checks: `QA_CANARY_MODE !== OWNER_SCOPED_PRIVATE_NO_SEND_ONCE` -> 404.
- After mode: `url.pathname !== env.QA_CALLBACK_PATH || url.search` -> 404.
- Only then method != POST -> 405, window wrong -> 410, missing prerequisites -> 503, header mismatch -> 403.
- Therefore a **true request reaching this Worker that returned 404** would not have reached its Webhook Secret Token check. As the mode is verified correct, unmatched path/query is a credible leading hypothesis. It is not proof of request origin or mismatch between the provider's URL and Cloudflare's opaque secret.

## Privacy-safe offline operator URL structure test

Run on the owner's local Windows PowerShell machine only. Enter the **previously saved QA webhook full URL** at a masked prompt. The script emits only coarse classifications, never echoes hostname/path/URL. It does NOT call Zalo or Cloudflare and does NOT change Worker or webhook.

```powershell
& {
  $secret = Read-Host "Dan URL webhook QA da luu" -AsSecureString
  $ptr = [IntPtr]::Zero
  try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $parsed = $null
    $expectedHost = 'tien404-v1723u-qa-inbound-locked-staging.tienmobi208.workers.dev'
    if (-not [Uri]::TryCreate($url,[UriKind]::Absolute,[ref]$parsed)) {
      'QA_URL_FORMAT_INVALID'
    }
    elseif ($parsed.Scheme -cne 'https' -or $parsed.Host -cne $expectedHost -or $parsed.Port -ne 443) {
      'QA_URL_HOST_MISMATCH'
    }
    elseif ($parsed.AbsolutePath -cnotmatch '^/qa/zalo-bot/[A-Za-z0-9_-]{24,80}$') {
      'QA_URL_PATH_SHAPE_INVALID'
    }
    elseif ($parsed.Query -ne '' -or $parsed.Fragment -ne '' -or $parsed.UserInfo -ne '' -or
            $url -cne ('https://' + $expectedHost + $parsed.AbsolutePath)) {
      'QA_URL_HAS_EXTRA_OR_ENCODING'
    }
    elseif ((Get-Variable -Name QA_CALLBACK_PATH -ErrorAction SilentlyContinue) -and
            $QA_CALLBACK_PATH -cne $parsed.AbsolutePath) {
      'QA_LOCAL_PATH_MISMATCH'
    }
    elseif (Get-Variable -Name QA_CALLBACK_PATH -ErrorAction SilentlyContinue) {
      'QA_LOCAL_URL_PATH_MATCH_BUT_CLOUDFLARE_UNVERIFIED'
    }
    else {
      'QA_URL_FORMAT_PASS_CLOUDFLARE_SECRET_UNVERIFIED'
    }
  }
  finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    Remove-Variable -Name url,parsed,secret -ErrorAction SilentlyContinue
  }
}
```

**Important limitation:** Even `QA_LOCAL_URL_PATH_MATCH_BUT_CLOUDFLARE_UNVERIFIED` compares only local strings. The deployed `QA_CALLBACK_PATH` is an encrypted Cloudflare Secret and is not readable through connector. It does **not** independently verify the hosted route matches.

## Safe next admission

1. Owner privately verifies webhook absence with read-only `getWebhookInfo` for the **new QA Bot** (current provider status). A lack of URL with `ok=true` is positive evidence for no current registration; JSON error 404 remains ambiguous.
2. Run offline URL-structure check above and report **only classification string**, without printing URL/token/path/challenge.
3. If URL shape is valid but hosted secret equality remains unknown, **do not restart a blind live test**. In a separate owner-approved action, rebind **only** existing dedicated QA Worker's `QA_CALLBACK_PATH` from the path component of the locally saved URL while worker is OFF, preserving other secret values and the rollback version. Do not store callback path in GitHub/chat. Rebind causes version change and must be checked after deployment.
4. Expired previous window cannot be reused; create a fresh approved <=20-minute UTC-ms window shortly before the next deliberate single-event attempt, with deletion/off rollback plan. Re-enable only dedicated workers.dev and keep previews OFF.
5. No n8n change, no credentials copied, no Zalo OA, no Commerce, no hosted QA diagnostics unless separately approved.

**Decision:** `DIAG7_ROLLBACK_OWNER_ATTESTED / WORKER_OFF_VERIFIED / D1_ZERO_VERIFIED / HTTP_404_ROUTING_SUSPECTED / NEXT_TEST_BLOCKED_PENDING_PATH_ATTESTATION`.

## Owner offline result — QA_LOCAL_PATH_MATCH

- **OWNER-TESTED:** The provided private PowerShell URL-shape check returned `QA_LOCAL_PATH_MATCH`. This means the **owner-supplied local saved webhook URL** has the expected exact HTTPS host + allowed path form, no visible extras, and its path is exactly equal (case-sensitive) to the **local** `$QA_CALLBACK_PATH` variable in that PowerShell session.
- **LIMITATION:** The test does **not** read or attest the encrypted **hosted Cloudflare** `QA_CALLBACK_PATH` binding and does not confirm exactly which URL was registered with Zalo during the live attempt. It does not identify the earlier HTTP 404 source; do not promote to `CLOUDFLARE_PATH_MATCH_VERIFIED` or claim Zalo delivery.
- **DIRECT HOSTED POSTFLIGHT 2026-11-18 ~06:40:31 JST:** Worker `workers.dev=false` and previews=false; mode `OWNER_SCOPED_PRIVATE_NO_SEND_ONCE`; `QA_CALLBACK_PATH` binding type `secret_text`; deployed version `20f281c4-c568-45c9-bd7b-e63a0e7d1fc4`; D1 accepted receipts=0. No hosted changes made in DIAG7.
- **NEXT ADMISSION:** Do not reopen for another live test. The minimum targeted correction is to re-save **only** the QA Worker's `QA_CALLBACK_PATH` from the already-validated local value while Worker is OFF, after owner authorizes that isolated secret mutation and confirms the provider webhook is deleted. This eliminates unknown hosted-vs-local path equality without disclosing either value. Record new Worker version, keep previews/public OFF, and use a **fresh** approved time window later. No old Bot, n8n or Commerce mutations.
- **Current classification:** `LOCAL_WEBHOOK_URL_MATCH_OWNER_TESTED / HOSTED_SECRET_VALUE_UNKNOWN / CLOUDFLARE_OFF_VERIFIED / D1_ZERO / TARGETED_REBIND_PROPOSED`.
