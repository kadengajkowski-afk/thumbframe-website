-- Day 57b emergency IO recovery
-- ===============================
-- Run in Supabase Studio → SQL Editor when the management API
-- connection times out (Claude's MCP couldn't reach it during the
-- crisis; logs show the DB itself is healthy).
--
-- (1) Add covering indexes so the SELECT count(*) (rate limit) and
--     the SUM(cost_usd) (cost cap) hot paths run as index-only
--     scans instead of seq-scanning the partition for every chat
--     message.
-- (2) Truncate aged rows. The cost cap + nudge metering only need
--     the trailing 24h of ai_usage_events; 7 days is generous
--     headroom. moderation_events keeps 30 days for audit; older
--     rows are dead weight given there's no admin UI surfacing
--     them yet.

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON public.ai_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_intent_created
  ON public.ai_usage_events (user_id, intent, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_events_created
  ON public.moderation_events (created_at DESC);

DELETE FROM public.ai_usage_events
  WHERE created_at < now() - interval '7 days';

DELETE FROM public.moderation_events
  WHERE created_at < now() - interval '30 days';

-- Reclaim disk + IO budget after the deletes.
VACUUM (ANALYZE) public.ai_usage_events;
VACUUM (ANALYZE) public.moderation_events;
