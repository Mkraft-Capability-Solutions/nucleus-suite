-- 0011: worker claim functions use the frozen status vocabulary.
--
-- scheduled_tasks: pending|leased|succeeded|failed|dead|cancelled.
-- transactional_outbox: pending|leased|published|failed|dead.
-- (0010 used running/publishing/dead_letter, which violate the CHECKs.)

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
  SET status = 'leased',
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
  SET status = 'leased',
      lease_owner = owner,
      attempts = o.attempts + 1
  FROM due
  WHERE o.id = due.id
  RETURNING o.*;
END;
$$;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.worker_claim_tasks(uuid, text, integer) TO PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.worker_claim_outbox(uuid, text, integer) TO PUBLIC;
