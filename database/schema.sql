-- Esquema vazio do KHKI. PostgreSQL 17. Não executar sobre um banco já populado.
--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS khki;


--
-- Name: SCHEMA khki; Type: COMMENT; Schema: -; Owner: -
--




SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amenity_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.amenity_types (
    code character varying(30) NOT NULL
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.app_users (
    id uuid NOT NULL,
    name character varying(80) NOT NULL,
    email character varying(254) NOT NULL,
    password character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    CONSTRAINT app_users_role_check CHECK (((role)::text = ANY ((ARRAY['USER'::character varying, 'ADMIN'::character varying])::text[])))
);


--
-- Name: bathroom_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.bathroom_images (
    bathroom_id uuid NOT NULL,
    image_order integer NOT NULL,
    image_id uuid NOT NULL,
    url character varying(500) NOT NULL,
    status character varying(20) NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT bathroom_images_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'NEEDS_INFORMATION'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'HIDDEN'::character varying, 'REMOVED'::character varying])::text[])))
);


--
-- Name: bathroom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.bathroom_items (
    bathroom_id uuid NOT NULL,
    item_code character varying(30) NOT NULL
);


--
-- Name: bathroom_type_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.bathroom_type_options (
    code character varying(20) NOT NULL
);


--
-- Name: bathroom_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.bathroom_types (
    bathroom_id uuid NOT NULL,
    type_code character varying(20) NOT NULL
);


--
-- Name: bathrooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.bathrooms (
    id uuid NOT NULL,
    author_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    name character varying(120) NOT NULL,
    address character varying(300) NOT NULL,
    category character varying(80) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    access character varying(20) NOT NULL,
    access_details character varying(300),
    hours character varying(200),
    accessible boolean,
    demo boolean DEFAULT false NOT NULL,
    complement character varying(200),
    usage_restriction character varying(20),
    charging character varying(12),
    fee_amount numeric(8,2),
    step_free_access boolean,
    elevator boolean,
    adapted_cabin boolean,
    grab_bars boolean,
    last_visited date,
    CONSTRAINT bathrooms_coordinates_check CHECK ((((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)) AND ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
    CONSTRAINT bathrooms_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'NEEDS_INFORMATION'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'HIDDEN'::character varying, 'REMOVED'::character varying])::text[])))
);


--
-- Name: image_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.image_deletions (
    image_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: moderation_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.moderation_audit (
    id uuid NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id uuid NOT NULL,
    moderator_id uuid NOT NULL,
    decision character varying(20) NOT NULL,
    reason character varying(500) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    duplicate_of_id uuid,
    bathroom_target_id uuid,
    review_target_id uuid,
    bathroom_image_target_id uuid,
    review_image_target_id uuid,
    CONSTRAINT moderation_audit_target_fk_check CHECK (((((target_type)::text = 'BATHROOM'::text) AND (bathroom_target_id IS NOT NULL) AND (bathroom_target_id = target_id) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'REVIEW'::text) AND (review_target_id IS NOT NULL) AND (review_target_id = target_id) AND (bathroom_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (bathroom_image_target_id IS NOT NULL) AND (bathroom_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (review_image_target_id IS NOT NULL) AND (review_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL))))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.reports (
    id uuid NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id uuid NOT NULL,
    reason character varying(40) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    bathroom_target_id uuid,
    review_target_id uuid,
    bathroom_image_target_id uuid,
    review_image_target_id uuid,
    CONSTRAINT reports_target_fk_check CHECK (((((target_type)::text = 'BATHROOM'::text) AND (bathroom_target_id IS NOT NULL) AND (bathroom_target_id = target_id) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'REVIEW'::text) AND (review_target_id IS NOT NULL) AND (review_target_id = target_id) AND (bathroom_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (bathroom_image_target_id IS NOT NULL) AND (bathroom_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (review_image_target_id IS NOT NULL) AND (review_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL))))
);


--
-- Name: review_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.review_images (
    review_id uuid NOT NULL,
    image_order integer NOT NULL,
    image_id uuid NOT NULL,
    url character varying(500) NOT NULL,
    status character varying(20) NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT review_images_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'NEEDS_INFORMATION'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'HIDDEN'::character varying, 'REMOVED'::character varying])::text[])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.reviews (
    id uuid NOT NULL,
    author_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    bathroom_id uuid NOT NULL,
    cleanliness integer,
    structure integer,
    comment character varying(1500),
    photo_only boolean DEFAULT false NOT NULL,
    CONSTRAINT reviews_cleanliness_check CHECK (((cleanliness >= 1) AND (cleanliness <= 5))),
    CONSTRAINT reviews_rating_kind_check CHECK (((photo_only AND (cleanliness IS NULL) AND (structure IS NULL) AND (comment IS NULL)) OR ((NOT photo_only) AND (cleanliness IS NOT NULL) AND (structure IS NOT NULL)))),
    CONSTRAINT reviews_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'NEEDS_INFORMATION'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'HIDDEN'::character varying, 'REMOVED'::character varying])::text[]))),
    CONSTRAINT reviews_structure_check CHECK (((structure >= 1) AND (structure <= 5)))
);


--
-- Name: spring_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.spring_session (
    primary_id character(36) NOT NULL,
    session_id character(36) NOT NULL,
    creation_time bigint NOT NULL,
    last_access_time bigint NOT NULL,
    max_inactive_interval integer NOT NULL,
    expiry_time bigint NOT NULL,
    principal_name character varying(254)
);


--
-- Name: spring_session_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.spring_session_attributes (
    session_primary_id character(36) NOT NULL,
    attribute_name character varying(200) NOT NULL,
    attribute_bytes bytea NOT NULL
);


--
-- Name: submission_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE khki.submission_receipts (
    id uuid NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    author_id uuid NOT NULL,
    operation character varying(80) NOT NULL,
    fingerprint character varying(64) NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    bathroom_target_id uuid,
    review_target_id uuid,
    bathroom_image_target_id uuid,
    review_image_target_id uuid,
    CONSTRAINT submission_receipts_target_fk_check CHECK (((((target_type)::text = 'BATHROOM'::text) AND (bathroom_target_id IS NOT NULL) AND (bathroom_target_id = target_id) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'REVIEW'::text) AND (review_target_id IS NOT NULL) AND (review_target_id = target_id) AND (bathroom_target_id IS NULL) AND (bathroom_image_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (bathroom_image_target_id IS NOT NULL) AND (bathroom_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (review_image_target_id IS NULL)) OR (((target_type)::text = 'PHOTO'::text) AND (review_image_target_id IS NOT NULL) AND (review_image_target_id = target_id) AND (bathroom_target_id IS NULL) AND (review_target_id IS NULL) AND (bathroom_image_target_id IS NULL))))
);


--
-- Name: amenity_types amenity_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.amenity_types
    ADD CONSTRAINT amenity_types_pkey PRIMARY KEY (code);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: bathroom_images bathroom_images_image_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_images
    ADD CONSTRAINT bathroom_images_image_id_key UNIQUE (image_id);


--
-- Name: bathroom_images bathroom_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_images
    ADD CONSTRAINT bathroom_images_pkey PRIMARY KEY (bathroom_id, image_order);


--
-- Name: bathroom_items bathroom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_items
    ADD CONSTRAINT bathroom_items_pkey PRIMARY KEY (bathroom_id, item_code);


--
-- Name: bathroom_type_options bathroom_type_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_type_options
    ADD CONSTRAINT bathroom_type_options_pkey PRIMARY KEY (code);


--
-- Name: bathroom_types bathroom_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_types
    ADD CONSTRAINT bathroom_types_pkey PRIMARY KEY (bathroom_id, type_code);


--
-- Name: bathrooms bathrooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathrooms
    ADD CONSTRAINT bathrooms_pkey PRIMARY KEY (id);


--
-- Name: image_deletions image_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.image_deletions
    ADD CONSTRAINT image_deletions_pkey PRIMARY KEY (image_id);


--
-- Name: moderation_audit moderation_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: review_images review_images_image_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.review_images
    ADD CONSTRAINT review_images_image_id_key UNIQUE (image_id);


--
-- Name: review_images review_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.review_images
    ADD CONSTRAINT review_images_pkey PRIMARY KEY (review_id, image_order);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: spring_session_attributes spring_session_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_pkey PRIMARY KEY (session_primary_id, attribute_name);


--
-- Name: spring_session spring_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.spring_session
    ADD CONSTRAINT spring_session_pkey PRIMARY KEY (primary_id);


--
-- Name: submission_receipts submission_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_pkey PRIMARY KEY (id);


--
-- Name: bathroom_images_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bathroom_images_status_idx ON khki.bathroom_images USING btree (status);


--
-- Name: bathroom_items_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bathroom_items_code_idx ON khki.bathroom_items USING btree (item_code);


--
-- Name: bathroom_types_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bathroom_types_code_idx ON khki.bathroom_types USING btree (type_code);


--
-- Name: bathrooms_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bathrooms_author_idx ON khki.bathrooms USING btree (author_id);


--
-- Name: bathrooms_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bathrooms_status_idx ON khki.bathrooms USING btree (status);


--
-- Name: moderation_audit_bathroom_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_audit_bathroom_image_target_id_idx ON khki.moderation_audit USING btree (bathroom_image_target_id);


--
-- Name: moderation_audit_bathroom_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_audit_bathroom_target_id_idx ON khki.moderation_audit USING btree (bathroom_target_id);


--
-- Name: moderation_audit_review_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_audit_review_image_target_id_idx ON khki.moderation_audit USING btree (review_image_target_id);


--
-- Name: moderation_audit_review_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_audit_review_target_id_idx ON khki.moderation_audit USING btree (review_target_id);


--
-- Name: moderation_audit_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_audit_target_idx ON khki.moderation_audit USING btree (target_type, target_id, created_at);


--
-- Name: reports_bathroom_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_bathroom_image_target_id_idx ON khki.reports USING btree (bathroom_image_target_id);


--
-- Name: reports_bathroom_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_bathroom_target_id_idx ON khki.reports USING btree (bathroom_target_id);


--
-- Name: reports_review_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_review_image_target_id_idx ON khki.reports USING btree (review_image_target_id);


--
-- Name: reports_review_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_review_target_id_idx ON khki.reports USING btree (review_target_id);


--
-- Name: review_images_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_images_status_idx ON khki.review_images USING btree (status);


--
-- Name: reviews_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_author_idx ON khki.reviews USING btree (author_id);


--
-- Name: reviews_bathroom_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_bathroom_status_idx ON khki.reviews USING btree (bathroom_id, status);


--
-- Name: spring_session_ix1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spring_session_ix1 ON khki.spring_session USING btree (session_id);


--
-- Name: spring_session_ix2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spring_session_ix2 ON khki.spring_session USING btree (expiry_time);


--
-- Name: spring_session_ix3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spring_session_ix3 ON khki.spring_session USING btree (principal_name);


--
-- Name: submission_receipts_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submission_receipts_author_idx ON khki.submission_receipts USING btree (author_id);


--
-- Name: submission_receipts_bathroom_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submission_receipts_bathroom_image_target_id_idx ON khki.submission_receipts USING btree (bathroom_image_target_id);


--
-- Name: submission_receipts_bathroom_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submission_receipts_bathroom_target_id_idx ON khki.submission_receipts USING btree (bathroom_target_id);


--
-- Name: submission_receipts_review_image_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submission_receipts_review_image_target_id_idx ON khki.submission_receipts USING btree (review_image_target_id);


--
-- Name: submission_receipts_review_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submission_receipts_review_target_id_idx ON khki.submission_receipts USING btree (review_target_id);


--
-- Name: bathroom_images bathroom_images_bathroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_images
    ADD CONSTRAINT bathroom_images_bathroom_id_fkey FOREIGN KEY (bathroom_id) REFERENCES khki.bathrooms(id);


--
-- Name: bathroom_items bathroom_items_bathroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_items
    ADD CONSTRAINT bathroom_items_bathroom_id_fkey FOREIGN KEY (bathroom_id) REFERENCES khki.bathrooms(id);


--
-- Name: bathroom_items bathroom_items_item_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_items
    ADD CONSTRAINT bathroom_items_item_code_fkey FOREIGN KEY (item_code) REFERENCES khki.amenity_types(code);


--
-- Name: bathroom_types bathroom_types_bathroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_types
    ADD CONSTRAINT bathroom_types_bathroom_id_fkey FOREIGN KEY (bathroom_id) REFERENCES khki.bathrooms(id);


--
-- Name: bathroom_types bathroom_types_type_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathroom_types
    ADD CONSTRAINT bathroom_types_type_code_fkey FOREIGN KEY (type_code) REFERENCES khki.bathroom_type_options(code);


--
-- Name: bathrooms bathrooms_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.bathrooms
    ADD CONSTRAINT bathrooms_author_id_fkey FOREIGN KEY (author_id) REFERENCES khki.app_users(id);


--
-- Name: moderation_audit moderation_audit_bathroom_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_bathroom_image_target_id_fkey FOREIGN KEY (bathroom_image_target_id) REFERENCES khki.bathroom_images(image_id);


--
-- Name: moderation_audit moderation_audit_bathroom_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_bathroom_target_id_fkey FOREIGN KEY (bathroom_target_id) REFERENCES khki.bathrooms(id);


--
-- Name: moderation_audit moderation_audit_duplicate_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_duplicate_of_id_fkey FOREIGN KEY (duplicate_of_id) REFERENCES khki.bathrooms(id);


--
-- Name: moderation_audit moderation_audit_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES khki.app_users(id);


--
-- Name: moderation_audit moderation_audit_review_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_review_image_target_id_fkey FOREIGN KEY (review_image_target_id) REFERENCES khki.review_images(image_id);


--
-- Name: moderation_audit moderation_audit_review_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.moderation_audit
    ADD CONSTRAINT moderation_audit_review_target_id_fkey FOREIGN KEY (review_target_id) REFERENCES khki.reviews(id);


--
-- Name: reports reports_bathroom_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reports
    ADD CONSTRAINT reports_bathroom_image_target_id_fkey FOREIGN KEY (bathroom_image_target_id) REFERENCES khki.bathroom_images(image_id);


--
-- Name: reports reports_bathroom_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reports
    ADD CONSTRAINT reports_bathroom_target_id_fkey FOREIGN KEY (bathroom_target_id) REFERENCES khki.bathrooms(id);


--
-- Name: reports reports_review_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reports
    ADD CONSTRAINT reports_review_image_target_id_fkey FOREIGN KEY (review_image_target_id) REFERENCES khki.review_images(image_id);


--
-- Name: reports reports_review_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reports
    ADD CONSTRAINT reports_review_target_id_fkey FOREIGN KEY (review_target_id) REFERENCES khki.reviews(id);


--
-- Name: review_images review_images_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.review_images
    ADD CONSTRAINT review_images_review_id_fkey FOREIGN KEY (review_id) REFERENCES khki.reviews(id);


--
-- Name: reviews reviews_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reviews
    ADD CONSTRAINT reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES khki.app_users(id);


--
-- Name: reviews reviews_bathroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.reviews
    ADD CONSTRAINT reviews_bathroom_id_fkey FOREIGN KEY (bathroom_id) REFERENCES khki.bathrooms(id);


--
-- Name: spring_session_attributes spring_session_attributes_session_primary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_session_primary_id_fkey FOREIGN KEY (session_primary_id) REFERENCES khki.spring_session(primary_id) ON DELETE CASCADE;


--
-- Name: submission_receipts submission_receipts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_author_id_fkey FOREIGN KEY (author_id) REFERENCES khki.app_users(id);


--
-- Name: submission_receipts submission_receipts_bathroom_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_bathroom_image_target_id_fkey FOREIGN KEY (bathroom_image_target_id) REFERENCES khki.bathroom_images(image_id);


--
-- Name: submission_receipts submission_receipts_bathroom_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_bathroom_target_id_fkey FOREIGN KEY (bathroom_target_id) REFERENCES khki.bathrooms(id);


--
-- Name: submission_receipts submission_receipts_review_image_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_review_image_target_id_fkey FOREIGN KEY (review_image_target_id) REFERENCES khki.review_images(image_id);


--
-- Name: submission_receipts submission_receipts_review_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY khki.submission_receipts
    ADD CONSTRAINT submission_receipts_review_target_id_fkey FOREIGN KEY (review_target_id) REFERENCES khki.reviews(id);


--
-- PostgreSQL database dump complete
--


INSERT INTO khki.amenity_types (code) VALUES ('PAPER'), ('SOAP'), ('SINK'), ('DRYER'), ('BIN'), ('CHANGING_TABLE');
INSERT INTO khki.bathroom_type_options (code) VALUES ('INDIVIDUAL'), ('FEMALE'), ('MALE');
REVOKE ALL ON SCHEMA khki FROM PUBLIC;
ALTER TABLE khki.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.bathrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.moderation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.submission_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.spring_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.spring_session_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.amenity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.bathroom_type_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.bathroom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.bathroom_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.bathroom_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE khki.image_deletions ENABLE ROW LEVEL SECURITY;
