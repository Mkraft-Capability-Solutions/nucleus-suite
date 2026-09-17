-- One reaction per person per post.
--
-- The recognition feed promises a single kudos per colleague per post. Without a
-- constraint that promise holds only while the application logic is correct and
-- nothing races: two concurrent requests can both observe "no existing reaction"
-- and both insert. `post_reactions` is a canonical envelope table created by
-- migration 0008 and has never been written by any code, so there are no existing
-- duplicates to reconcile and the index can be added safely.
--
-- Partial on employee_id because the column is nullable in the canonical topology;
-- a reaction with no author is not a person's reaction and is not constrained here.
CREATE UNIQUE INDEX IF NOT EXISTS post_reactions_tenant_post_employee_uq
  ON public.post_reactions (tenant_id, feed_post_id, employee_id)
  WHERE employee_id IS NOT NULL;
