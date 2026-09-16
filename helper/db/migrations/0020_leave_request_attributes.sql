-- FRM-LVE-02 records more about a leave request than its dates and day count:
-- half-day markers, the contact and address during leave, the handover person and
-- the supporting document. leave_requests predates the canonical envelope shape and
-- so never received the `attributes` bag every 0008 table carries; this adds it so
-- those keys need no further column per field.
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
