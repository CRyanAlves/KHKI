ALTER TABLE bathrooms ADD COLUMN complement VARCHAR(200);
ALTER TABLE reports ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE moderation_audit ADD COLUMN duplicate_of_id UUID REFERENCES bathrooms(id);
CREATE INDEX moderation_audit_target_idx ON moderation_audit(target_type, target_id, created_at);