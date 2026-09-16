-- FRM-PAY-03 records more about a run than its period and scope: the pay date, whether
-- arrears are included, the population filter, the uploaded input file, and the snapshot
-- and input hashes that make the run reproducible. payroll_runs predates the canonical
-- envelope shape and so never received the `attributes` bag every 0008 table carries;
-- this adds it so those keys need no further column per field.
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
