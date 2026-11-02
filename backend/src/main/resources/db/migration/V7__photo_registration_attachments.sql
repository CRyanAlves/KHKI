ALTER TABLE photos ADD COLUMN registration_attachment BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE photos ADD CONSTRAINT photos_attachment_parent_check CHECK (NOT registration_attachment OR review_id IS NULL);
UPDATE photos SET registration_attachment = TRUE
WHERE review_id IS NULL AND EXISTS (
  SELECT 1 FROM bathrooms bathroom
  WHERE bathroom.id = photos.bathroom_id AND bathroom.author_id = photos.author_id
  AND (
    photos.created_at <= (SELECT MIN(audit.created_at) FROM moderation_audit audit WHERE audit.target_type = 'BATHROOM' AND audit.target_id = bathroom.id AND audit.decision = 'APPROVED')
    OR (bathroom.status IN ('PENDING', 'NEEDS_INFORMATION', 'REJECTED') AND NOT EXISTS (SELECT 1 FROM moderation_audit audit WHERE audit.target_type = 'BATHROOM' AND audit.target_id = bathroom.id AND audit.decision = 'APPROVED'))
  )
);
CREATE INDEX photos_standalone_queue_idx ON photos(status, registration_attachment, review_id);
