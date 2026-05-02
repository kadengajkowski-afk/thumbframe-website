-- Day 55 — moderation_events table.
--
-- Service-role-only writes; no RLS policy means RLS-enabled +
-- nothing readable by anon / authenticated users (admin-only).
-- The DDL event trigger that auto-enables RLS on every table
-- (existing project convention) will fire on this table too.

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  source text NOT NULL,
  scores jsonb,
  image_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the common admin query: "show me all blocked uploads
-- for this user" + "show me all blocks in the last 24h".
CREATE INDEX IF NOT EXISTS moderation_events_user_id_idx
  ON public.moderation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_events_created_at_idx
  ON public.moderation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_events_image_hash_idx
  ON public.moderation_events (image_hash);

COMMENT ON TABLE public.moderation_events IS
  'Day 55 — NSFW / CSAM / flagged-review audit log. Service-role inserts only.';
