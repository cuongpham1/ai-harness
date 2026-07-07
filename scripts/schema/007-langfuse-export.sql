-- Harness v0 schema - migration 007
-- Optional Langfuse exporter metadata for external trace correlation.

ALTER TABLE trace ADD COLUMN langfuse_trace_id TEXT;
ALTER TABLE trace ADD COLUMN langfuse_exported_at TEXT;

INSERT INTO schema_version (version) VALUES (7);
