# TIEN404 V18.0-P0M — Auth Staging-only QA UI deployment checkpoint

2026-11-18 JST. **Staging-only approved by founder in conversation.** Does not approve production, hosted Store Authority migrations, Auth session impersonation, grant changes, credential changes or Meta/Zalo sends.

## Verified baseline
- Service: Render static `tien404-auth-staging` `srv-dbpj4irm8hqs73e2h2rg`.
- Auto-deploy OFF, branch `work/supabase-auth-staging-v1`.
- Previously LIVE deploy: `dep-dbsa4fl6e07s7399ab30`, commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd`.
- Branch HEAD before P0M: `44c920fef7663488845ec9fdcef722b898659a15`; only 2 postdeploy QA test commits, no runtime source drift.
- Surgical Auth branch commit: `58be5940d18aa5e8fe213a524383bf4bf628421f`. Exactly 6 changed files: new page and 2 modules, Auth preview build allowlist +3 entries, test suite and CI workflow. Git diff proves login/account/client/merchant-portal source unchanged.
- New Render deploy: `dep-dbu9u4tbedkc7397p880` commit `58be5940d18aa5e8fe213a524383bf4bf628421f`, **status LIVE confirmed by Render API**.
- Independent source CI: P0M `44149767970` SUCCESS (11/11 pure Node tests + real Render static build), inherited Auth security suite `44149767733` SUCCESS.

## Scope and risk
The new `/auth-evidence.html` is a public *static shell*; Render IP allowlist is 0.0.0.0/0. **Noindex is not Access control.** Private Auth data is not embedded, authentication requires official Supabase `getUser/getClaims`, scoped owner tenant membership via existing RLS, and explicit consent. Outputs are local nonpersistent HMAC pseudonyms. The page does not validate independent server session revocation, canonical Store A/B owner binding or real cross-store negative UAT. No data writes, secrets, provider sends or new roles.

Auth staging static UI does NOT automatically become production. The deployed origin is `https://tien404-auth-staging.onrender.com`.

## Postdeploy verification
This checkpoint commit adds a separate **public HTTPS no-auth static route** GitHub runner test, `tests/v180-p0m-hosted-smoke.mjs`, without provider tokens, Auth login, user data, or hosted writes. Require HTTP 200 and exact expected file bytes for the new page/JS and existing Auth source assets; verify login/account/merchant routes and sensitive paths return 404. Outcome of that CI must be independently read after the run; do not claim until then.

## Rollback
If the new Auth page or login regressions occur, **STOP** owner QA; retain live deployed commit and logs. Source rollback via revert of surgical commit `58be...` (using branch HEAD and review), restoring the earlier Auth branch source with GitHub Actions CI. After independent acceptance, trigger Render static deploy with auto-deploy still OFF and verify old Auth paths restored. Never force-push or delete active Auth sessions. For urgent recovery, original live deploy `dep-dbsa4fl6e07s7399ab30` remains known; check available Render restore operation before using it.

## Release gate
`P0M_STATIC_STAGE_DEPLOYED / REAL_HOSTED_BROWSER_AUTH_A_B_NOT_RUN / STORES_AND_STORE_MEMBERSHIPS_ABSENT / JWT_NEGATIVE_UAT_NOT_RUN / M0_DEFERRED_READ_ONLY_AND_SOURCE_ONLY / PRODUCTION_NO_GO`.
