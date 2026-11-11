-- O ALTER mantém bloqueio exclusivo da tabela durante a transação PostgreSQL.
ALTER TABLE photos ADD COLUMN migration_fence BOOLEAN;
CREATE TABLE image_export_guard (unexported INTEGER NOT NULL CHECK (unexported = 0));
INSERT INTO image_export_guard SELECT COUNT(*) FROM photos WHERE status <> 'REMOVED' AND storage_url IS NULL;
INSERT INTO image_export_guard SELECT COUNT(*) FROM photos p JOIN reviews r ON p.review_id = r.id WHERE p.author_id <> r.author_id OR p.bathroom_id <> r.bathroom_id;
INSERT INTO image_export_guard SELECT COUNT(*) FROM bathrooms WHERE items <> '' AND NOT REGEXP_LIKE(items, '^(PAPER|SOAP|SINK|DRYER|BIN|CHANGING_TABLE)(,(PAPER|SOAP|SINK|DRYER|BIN|CHANGING_TABLE))*$');
INSERT INTO image_export_guard SELECT COUNT(*) FROM bathrooms WHERE bathroom_types IS NOT NULL AND bathroom_types <> '' AND NOT REGEXP_LIKE(bathroom_types, '^(INDIVIDUAL|FEMALE|MALE)(,(INDIVIDUAL|FEMALE|MALE))*$');
DROP TABLE image_export_guard;
CREATE TABLE amenity_types (code VARCHAR(30) PRIMARY KEY);
INSERT INTO amenity_types (code) VALUES ('PAPER'), ('SOAP'), ('SINK'), ('DRYER'), ('BIN'), ('CHANGING_TABLE');
CREATE TABLE bathroom_type_options (code VARCHAR(20) PRIMARY KEY);
INSERT INTO bathroom_type_options (code) VALUES ('INDIVIDUAL'), ('FEMALE'), ('MALE');
CREATE TABLE bathroom_items (bathroom_id UUID NOT NULL REFERENCES bathrooms(id), item_code VARCHAR(30) NOT NULL REFERENCES amenity_types(code), PRIMARY KEY (bathroom_id, item_code));
CREATE TABLE bathroom_types (bathroom_id UUID NOT NULL REFERENCES bathrooms(id), type_code VARCHAR(20) NOT NULL REFERENCES bathroom_type_options(code), PRIMARY KEY (bathroom_id, type_code));
INSERT INTO bathroom_items SELECT b.id, a.code FROM bathrooms b CROSS JOIN amenity_types a WHERE POSITION(',' || a.code || ',' IN ',' || b.items || ',') > 0;
INSERT INTO bathroom_types SELECT b.id, t.code FROM bathrooms b CROSS JOIN bathroom_type_options t WHERE POSITION(',' || t.code || ',' IN ',' || b.bathroom_types || ',') > 0;
ALTER TABLE bathrooms DROP COLUMN items;
ALTER TABLE bathrooms DROP COLUMN bathroom_types;
ALTER TABLE reviews ALTER COLUMN cleanliness DROP NOT NULL;
ALTER TABLE reviews ALTER COLUMN structure DROP NOT NULL;
ALTER TABLE reviews ADD COLUMN photo_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_kind_check CHECK ((photo_only AND cleanliness IS NULL AND structure IS NULL AND comment IS NULL) OR (NOT photo_only AND cleanliness IS NOT NULL AND structure IS NOT NULL));
CREATE TABLE bathroom_images (bathroom_id UUID NOT NULL REFERENCES bathrooms(id), image_order INTEGER NOT NULL, image_id UUID NOT NULL UNIQUE, url VARCHAR(500) NOT NULL, status VARCHAR(20) NOT NULL, reason VARCHAR(500), created_at TIMESTAMP WITH TIME ZONE NOT NULL, version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (bathroom_id, image_order));
CREATE TABLE review_images (review_id UUID NOT NULL REFERENCES reviews(id), image_order INTEGER NOT NULL, image_id UUID NOT NULL UNIQUE, url VARCHAR(500) NOT NULL, status VARCHAR(20) NOT NULL, reason VARCHAR(500), created_at TIMESTAMP WITH TIME ZONE NOT NULL, version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (review_id, image_order));
INSERT INTO reviews (id, author_id, status, reason, created_at, version, bathroom_id, cleanliness, structure, comment, photo_only)
SELECT id, author_id, status, reason, created_at, version, bathroom_id, NULL, NULL, NULL, TRUE FROM photos WHERE review_id IS NULL AND NOT registration_attachment;
INSERT INTO bathroom_images (bathroom_id, image_order, image_id, url, status, reason, created_at, version)
SELECT bathroom_id, ROW_NUMBER() OVER (PARTITION BY bathroom_id ORDER BY created_at, id) - 1, id, COALESCE(storage_url, '/api/photos/' || CAST(id AS VARCHAR(36))), status, reason, created_at, version FROM photos WHERE registration_attachment;
INSERT INTO review_images (review_id, image_order, image_id, url, status, reason, created_at, version)
SELECT COALESCE(review_id, id), ROW_NUMBER() OVER (PARTITION BY COALESCE(review_id, id) ORDER BY created_at, id) - 1, id, COALESCE(storage_url, '/api/photos/' || CAST(id AS VARCHAR(36))), status, reason, created_at, version FROM photos WHERE NOT registration_attachment;
CREATE INDEX bathroom_images_status_idx ON bathroom_images(status);
CREATE INDEX review_images_status_idx ON review_images(status);
CREATE INDEX reviews_author_idx ON reviews(author_id);
CREATE INDEX bathrooms_author_idx ON bathrooms(author_id);
CREATE INDEX bathroom_items_code_idx ON bathroom_items(item_code);
CREATE INDEX bathroom_types_code_idx ON bathroom_types(type_code);
ALTER TABLE bathrooms ADD CONSTRAINT bathrooms_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
ALTER TABLE bathrooms ADD CONSTRAINT bathrooms_status_check CHECK (status IN ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'HIDDEN', 'REMOVED'));
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'HIDDEN', 'REMOVED'));
ALTER TABLE bathroom_images ADD CONSTRAINT bathroom_images_status_check CHECK (status IN ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'HIDDEN', 'REMOVED'));
ALTER TABLE review_images ADD CONSTRAINT review_images_status_check CHECK (status IN ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'HIDDEN', 'REMOVED'));
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('USER', 'ADMIN'));
DROP TABLE photos;
