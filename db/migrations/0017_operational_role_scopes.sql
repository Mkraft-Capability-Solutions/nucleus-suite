-- Register capabilities only. Existing role assignments are unchanged.
INSERT INTO permissions(permission_key,field_domain,risk)
SELECT domain || '.' || action,'ordinary',CASE WHEN action LIKE '%read' THEN 'standard' ELSE 'high' END
FROM unnest(ARRAY['hr.helpdesk','workforce.travel','workforce.timesheets']) domain
CROSS JOIN unnest(ARRAY['self.read','self.write','team.read','team.approve']) action
ON CONFLICT(permission_key) DO NOTHING;
