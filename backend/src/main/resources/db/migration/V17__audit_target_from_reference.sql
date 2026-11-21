ALTER TABLE moderation_audit DROP CONSTRAINT moderation_audit_target_fk_check;
ALTER TABLE moderation_audit ADD CONSTRAINT moderation_audit_target_fk_check CHECK ((bathroom_target_id IS NOT NULL AND review_target_id IS NULL) OR (review_target_id IS NOT NULL AND bathroom_target_id IS NULL));
DROP INDEX moderation_audit_target_idx;
ALTER TABLE moderation_audit DROP COLUMN target_type;
ALTER TABLE moderation_audit DROP COLUMN target_id;
