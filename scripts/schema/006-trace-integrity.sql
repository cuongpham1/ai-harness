-- Harness v0 schema - migration 006
-- Tamper-evident trace audit: hash-chain columns. Each new trace stores its own
-- sha256 (entry_hash) computed over its content plus the previous trace's hash
-- (prev_hash). Editing or deleting a recorded trace breaks the chain, which
-- `harness-cli verify-chain` detects. Pre-migration rows keep NULL hashes and
-- are skipped by verification.

ALTER TABLE trace ADD COLUMN entry_hash TEXT;
ALTER TABLE trace ADD COLUMN prev_hash TEXT;

INSERT INTO schema_version (version) VALUES (6);
