-- FRM-PLT-01 Legal Entity Master captures far more than the five typed columns
-- legal_entities carries (code, legal_name, registration, currency, status): the
-- statutory identifiers, both address blocks, the fiscal settings and the signing
-- authority. legal_entities predates the canonical envelope shape and so never received
-- the `attributes` bag every 0008 table carries; this adds it so those keys need no
-- further column per field.
ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
