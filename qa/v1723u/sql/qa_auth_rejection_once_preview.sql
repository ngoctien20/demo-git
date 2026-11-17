-- V17.23U DIAG2: offline/disposable-only migration preview.
-- DO NOT run against hosted D1 without a separate approval.
-- This table stores only one fixed rejection reason per supported category.
CREATE TABLE IF NOT EXISTS qa_auth_rejection_once (
  reason TEXT PRIMARY KEY NOT NULL CHECK (reason IN (
    'CONTENT_TYPE', 'BODY_SIZE', 'BODY_PARSE', 'ENVELOPE',
    'EVENT_KIND', 'MESSAGE_SHAPE', 'CHALLENGE', 'EVENT_TIME'
  ))
) WITHOUT ROWID;
