-- RLS predicates execute as the application role and need namespace access.
-- This does not grant schema creation or any RLS-bypass privilege.
GRANT USAGE ON SCHEMA app TO app_runtime;
