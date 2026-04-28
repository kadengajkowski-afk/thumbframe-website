-- 20260429120000_brand_kits.sql
-- ThumbFrame v3 Day 32 — Brand Kit persistence.
--
-- Two tables:
--   public.brand_kits          → per-user saved kits (RLS, own only)
--   public.shared_brand_kits   → cross-user 24h cache by channel_id
--                                (public read, service-role write only)
--
-- Run manually in the Supabase dashboard SQL editor. Do not run from CI.
-- RLS is mandatory (CLAUDE.md hard rule).

-- ── public.brand_kits — per-user saved kits ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_kits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id        text NOT NULL,
  channel_title     text NOT NULL,
  custom_url        text,
  avatar_url        text,
  banner_url        text,
  primary_accent    text,
  -- colors holds the hex array; recent_thumbnails the {videoId,title,url}
  -- array shape returned by the backend brand-kit endpoint.
  colors            jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_thumbnails jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Hot list-query: "give me my kits, newest first."
CREATE INDEX IF NOT EXISTS brand_kits_user_updated_idx
  ON public.brand_kits (user_id, updated_at DESC);

-- One saved kit per (user, channel). Re-extracting upserts.
CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_user_channel_key
  ON public.brand_kits (user_id, channel_id);

DROP TRIGGER IF EXISTS brand_kits_set_updated_at ON public.brand_kits;
CREATE TRIGGER brand_kits_set_updated_at
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_kits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_kits_select_own" ON public.brand_kits;
CREATE POLICY "brand_kits_select_own"
  ON public.brand_kits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_kits_insert_own" ON public.brand_kits;
CREATE POLICY "brand_kits_insert_own"
  ON public.brand_kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_kits_update_own" ON public.brand_kits;
CREATE POLICY "brand_kits_update_own"
  ON public.brand_kits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_kits_delete_own" ON public.brand_kits;
CREATE POLICY "brand_kits_delete_own"
  ON public.brand_kits FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.brand_kits IS
  'ThumbFrame v3 per-user saved brand kits. RLS-gated, one row per (user, channel).';

-- ── public.shared_brand_kits — cross-user 24h cache ───────────────────────
-- Channel data is public (titles, avatars, thumbnails, extracted colors
-- from public uploads). Caching cross-user saves YouTube quota and
-- repeats latency. Public read; only service-role can write so the API
-- is the only path that populates it.

CREATE TABLE IF NOT EXISTS public.shared_brand_kits (
  channel_id        text PRIMARY KEY,
  payload           jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_brand_kits_updated_idx
  ON public.shared_brand_kits (updated_at DESC);

DROP TRIGGER IF EXISTS shared_brand_kits_set_updated_at ON public.shared_brand_kits;
CREATE TRIGGER shared_brand_kits_set_updated_at
  BEFORE UPDATE ON public.shared_brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shared_brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_brand_kits FORCE ROW LEVEL SECURITY;

-- Anyone (signed-in or anon) can read the cache.
DROP POLICY IF EXISTS "shared_brand_kits_select_all" ON public.shared_brand_kits;
CREATE POLICY "shared_brand_kits_select_all"
  ON public.shared_brand_kits FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies → only service_role bypasses RLS.
-- The Railway API uses SUPABASE_SERVICE_KEY to write.

COMMENT ON TABLE public.shared_brand_kits IS
  'ThumbFrame v3 cross-user cache for /api/youtube/channel-by-url. 24h TTL enforced by the API. Public read, service-role write only.';
