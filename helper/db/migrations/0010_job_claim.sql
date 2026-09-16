-- 0010: background worker claim functions (additive, no table changes).
--
-- The pooled runtime role is bound by tenant RLS, which requires a user
-- membership triple the cron worker does not have. These three SECURITY
-- DEFINER functions are the narrow, auditable escalation for time-driven
-- work: each filters strictly by the caller-supplied tenant_id and only
-- ever returns rows the worker is allowed to execute (due/pending). The
-- HTTP entry point additionally requires CRON_SECRET (see
-- src/app/api/cron/tick/route.ts). Execution itself still runs tenant-scoped
-- with full audit/outbox writes per task.

--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.worker_tenants()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  SELECT t.id FROM public.tenants AS t WHERE t.status = 'active' ORDER BY t.id
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.worker_claim_tasks(
  candidate_tenant_id uuid,
  owner text,
  task_limit integer
)
RETURNS SETOF public.scheduled_tasks
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT st.id
    FROM public.scheduled_tasks AS st
    WHERE st.tenant_id = candidate_tenant_id
      AND st.status = 'pending'
      AND st.available_at <= now()
    ORDER BY st.available_at ASC
    LIMIT task_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scheduled_tasks AS st
  SET status = 'running',
      lease_owner = owner,
      lease_expires_at = now() + interval '120 seconds',
      attempts = st.attempts + 1,
      updated_at = now()
  FROM due
  WHERE st.id = due.id
  RETURNING st.*;
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.worker_claim_outbox(
  candidate_tenant_id uuid,
  owner text,
  event_limit integer
)
RETURNS SETOF public.transactional_outbox
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT o.id
    FROM public.transactional_outbox AS o
    WHERE o.tenant_id = candidate_tenant_id
      AND o.status = 'pending'
      AND o.available_at <= now()
    ORDER BY o.created_at ASC
    LIMIT event_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.transactional_outbox AS o
  SET status = 'publishing',
      lease_owner = owner,
      attempts = o.attempts + 1
  FROM due
  WHERE o.id = due.id
  RETURNING o.*;
END;
$$;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.worker_tenants() TO PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.worker_claim_tasks(uuid, text, integer) TO PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.worker_claim_outbox(uuid, text, integer) TO PUBLIC;
