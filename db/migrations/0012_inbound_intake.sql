-- 0012: inbound webhook intake (additive, no table changes).
--
-- Public provider deliveries carry no user session, so tenant RLS cannot
-- authorize them. This single SECURITY DEFINER function is the narrow intake
-- point: it resolves the connection, enforces nonce uniqueness atomically,
-- records the delivery, and returns the sealed secret for Node-side HMAC
-- verification. It never returns raw secrets and never exposes rows from
-- other tenants (every predicate pins the resolved tenant).

--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.inbound_intake(
  connection_id uuid,
  nonce text,
  event_name text
)
RETURNS TABLE (tenant_id uuid, sealed_secret text, duplicate boolean, delivery_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  connection_tenant uuid;
  connection_secret text;
  existing_id uuid;
BEGIN
  SELECT c.tenant_id INTO connection_tenant
  FROM public.integration_connections AS c
  WHERE c.id = connection_id;

  IF connection_tenant IS NULL THEN
    RAISE EXCEPTION 'unknown connection' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT s.attributes->>'sealed' INTO connection_secret
  FROM public.integration_secrets AS s
  WHERE s.tenant_id = connection_tenant
    AND s.integration_connection_id = connection_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF connection_secret IS NULL THEN
    RAISE EXCEPTION 'no inbound secret provisioned' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT e.id INTO existing_id
  FROM public.inbound_events AS e
  WHERE e.tenant_id = connection_tenant
    AND e.integration_connection_id = connection_id
    AND e.attributes->>'nonce' = nonce
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN QUERY SELECT connection_tenant, connection_secret, true, existing_id;
    RETURN;
  END IF;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.inbound_events (tenant_id, integration_connection_id, attributes)
    VALUES (
      connection_tenant, connection_id,
      jsonb_build_object(
        'event', event_name,
        'nonce', nonce,
        'received_at', now(),
        'status', 'received'
      )
    )
    RETURNING id
  )
  SELECT connection_tenant, connection_secret, false, inserted.id FROM inserted;
END;
$$;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.inbound_intake(uuid, text, text) TO PUBLIC;
