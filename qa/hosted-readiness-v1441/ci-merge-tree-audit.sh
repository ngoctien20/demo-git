#!/usr/bin/env bash
# V14.4.1 — reproducible ephemeral Git merge-tree audit, NO branch update.
# A clean text merge does NOT mean API/schema/RLS integration is safe.
set -euo pipefail
[[ "$(printenv GITHUB_ACTIONS || true)" == "true" ]] || {
  echo 'BLOCKED: CI_ONLY_MERGE_REHEARSAL'; exit 2;
}
STORE='635e1d8e634556887eb35fd318b892c740177a9e'
REPLAY='ad35baec097a7e8289518ec66ff74b1a19f1b3d3'
V143='02c480d6925234631a94c9ad1c5b705b07c4128d'
V144='67ccf9334e81f346f2aebdc1fbf1bf7ec0275e32'
git fetch --no-tags origin \
  refs/heads/work/v142-store-rls-onboarding-staging:refs/remotes/origin/v142_audit \
  refs/heads/work/v136m7-hosted-evidence-atomic-pg-review-20261115:refs/remotes/origin/v136m7_audit \
  refs/heads/work/v144-secure-gateway-release-preflight-20261115:refs/remotes/origin/v144_audit \
  refs/heads/work/v143-unified-channel-widget-staging-20261115:refs/remotes/origin/v143_audit >/dev/null
[[ "$(git rev-parse refs/remotes/origin/v142_audit)" == "$STORE" ]] || {
 echo 'BLOCKED: PR86 HEAD DRIFT'; exit 2;
}
[[ "$(git rev-parse refs/remotes/origin/v136m7_audit)" == "$REPLAY" ]] || {
 echo 'BLOCKED: PR95 HEAD DRIFT'; exit 2;
}
[[ "$(git rev-parse refs/remotes/origin/v144_audit)" == "$V144" ]] || {
 echo 'BLOCKED: PR97 HEAD DRIFT'; exit 2;
}
[[ "$(git rev-parse refs/remotes/origin/v143_audit)" == "$V143" ]] || {
 echo 'BLOCKED: PR94 HEAD DRIFT'; exit 2;
}
git merge-base --is-ancestor "$V143" "$V144" || {
 echo 'BLOCKED: PR97 does not inherit PR94'; exit 2;
}
git merge-base --is-ancestor "$V144" HEAD || {
 echo 'BLOCKED: PR98 does not inherit PR97'; exit 2;
}

# PR95 and PR86 are expected to be divergent — NO cherry-pick/merge.
if git merge-base --is-ancestor "$REPLAY" HEAD; then
 echo 'UNEXPECTED: PR95 already inherited; require owner re-review'; exit 2;
fi
if git merge-base --is-ancestor "$STORE" HEAD; then
 echo 'UNEXPECTED: PR86 already inherited; require owner re-review'; exit 2;
fi
echo 'PASS expected ancestry: PR94→PR97→V14.4.1; Store and Replay remain divergent'

rehearse(){
  local left="$1" right="$2" label="$3" output code
  set +e
  output=$(git merge-tree --write-tree "$left" "$right" 2>&1)
  code=$?
  set -e
  if [[ "$code" == 0 ]]; then
    MERGED_TREE=$(printf '%s\n' "$output" | head -n 1)
    [[ "$MERGED_TREE" =~ ^[0-9a-f]{40}$ ]] || { echo 'MERGE_TREE_UNEXPECTED_OUTPUT'; exit 2; }
    echo "TEXT_ONLY_REHEARSAL: $label clean at tree $MERGED_TREE"
    return 0
  fi
  echo "TEXT_ONLY_REHEARSAL: $label CONFLICT_OR_ERROR (exit=$code)"
  printf '%s\n' "$output" | grep -E '^(CONFLICT |Auto-merging |error:)' | head -n 16 || true
  return 1
}
MERGED_TREE=''
if rehearse HEAD "$REPLAY" 'V14.4.1 + PR95'; then
  tree_one="$MERGED_TREE"
  # Create an anonymous synthetic merge COMMIT OBJECT only inside the
  # disposable GitHub runner object database; NO git merge, branch or push.
  sandbox_commit=$(GIT_AUTHOR_NAME='TIEN404 CI' GIT_AUTHOR_EMAIL='ci@invalid.example' \
   GIT_COMMITTER_NAME='TIEN404 CI' GIT_COMMITTER_EMAIL='ci@invalid.example' \
   git commit-tree "$tree_one" -p HEAD -p "$REPLAY" <<< 'ephemeral CI tree; do not push')
  if rehearse "$sandbox_commit" "$STORE" 'synthetic union + PR86'; then
    echo 'TEXT_REHEARSAL_RESULT=NO_TEXT_CONFLICTS_NEEDS_CODE_AND_DB_REVIEW'
  else
    echo 'TEXT_REHEARSAL_RESULT=STORE_CONFLICT_MANUAL_PORT_REQUIRED'
  fi
else
 echo 'TEXT_REHEARSAL_RESULT=REPLAY_CONFLICT_MANUAL_PORT_REQUIRED'
fi
echo 'HOSTED_RLS_STATUS=BLOCKED; BRANCHES_NOT_MERGED; NO_PROVIDER_SEND'
