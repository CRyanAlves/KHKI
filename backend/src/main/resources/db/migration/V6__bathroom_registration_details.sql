ALTER TABLE bathrooms ADD COLUMN usage_restriction VARCHAR(20);
ALTER TABLE bathrooms ADD COLUMN charging VARCHAR(12);
ALTER TABLE bathrooms ADD COLUMN fee_amount NUMERIC(8, 2);
ALTER TABLE bathrooms ADD COLUMN bathroom_types VARCHAR(80);
ALTER TABLE bathrooms ADD COLUMN step_free_access BOOLEAN;
ALTER TABLE bathrooms ADD COLUMN elevator BOOLEAN;
ALTER TABLE bathrooms ADD COLUMN adapted_cabin BOOLEAN;
ALTER TABLE bathrooms ADD COLUMN grab_bars BOOLEAN;
ALTER TABLE bathrooms ADD COLUMN last_visited DATE;
