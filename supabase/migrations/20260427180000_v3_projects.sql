-- 20260427180000_v3_projects.sql
-- ThumbFrame v3 Day 20 — separate v3_projects table for editor-v3.
-- Auto-save lives in this table; one row per project, JSONB doc.
--
-- v1 already owns public.projects with a different schema
-- (id text, layers_json text). v3 uses public.v3_projects so the
-- two editors don't collide on schema or row ownership.
--
-- Run manually in the Supabase dashboard SQL editor. Do not run
-- from CI. RLS is mandatory (CLAUDE.md hard rule).

-- updated_at auto-bumps on UPDATE. Pure SQL trigger function,
-- shared with any future v3 tables.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.v3_projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL DEFAULT 'Untitled',
  -- doc holds the serialized {version, layers, canvas} JSON. Image
  -- bitmaps are inlined as base64 PNG dataURLs by lib/projectSerializer.
  doc          jsonb NOT NULL,
  -- nullable until thumbnail upload completes; stores the public URL
  -- of the project-thumbnails bucket entry.
  thumbnail_url text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Hot list-query: "give me my v3 projects, newest first."
CREATE INDEX IF NOT EXISTS v3_projects_user_updated_idx
  ON public.v3_projects (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS v3_projects_set_updated_at ON public.v3_projects;
CREATE TRIGGER v3_projects_set_updated_at
  BEFORE UPDATE ON public.v3_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS — every operation gated on user_id = auth.uid() ──────────────

ALTER TABLE public.v3_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v3_projects_select_own" ON public.v3_projects;
CREATE POLICY "v3_projects_select_own"
  ON public.v3_projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "v3_projects_insert_own" ON public.v3_projects;
CREATE POLICY "v3_projects_insert_own"
  ON public.v3_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "v3_projects_update_own" ON public.v3_projects;
CREATE POLICY "v3_projects_update_own"
  ON public.v3_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "v3_projects_delete_own" ON public.v3_projects;
CREATE POLICY "v3_projects_delete_own"
  ON public.v3_projects FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.v3_projects IS
  'ThumbFrame v3 saved projects. Per-user, RLS-gated. doc holds the serialized layer schema (lib/projectSerializer.ts). v1 uses public.projects separately.';

-- ── Storage bucket for project thumbnails ───────────────────────────
-- Public read is OK (thumbnails are small and the user already chose
-- to save them); write is gated on the auth user. Bucket-level RLS
-- lives in storage.objects via the policies below.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-thumbnails', 'project-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "thumbs_select_public" ON storage.objects;
CREATE POLICY "thumbs_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-thumbnails');

DROP POLICY IF EXISTS "thumbs_insert_own" ON storage.objects;
CREATE POLICY "thumbs_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "thumbs_update_own" ON storage.objects;
CREATE POLICY "thumbs_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "thumbs_delete_own" ON storage.objects;
CREATE POLICY "thumbs_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
