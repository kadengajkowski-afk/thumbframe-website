-- 20260430120000_brand_kits_fonts.sql
-- ThumbFrame v3 Day 33 — Brand Kit font detection.
--
-- Adds `fonts jsonb` to public.brand_kits (per-user). The shared cache
-- table (public.shared_brand_kits) doesn't need a column change because
-- its `payload jsonb` already carries the entire BrandKit response —
-- new `fonts` field on the response goes inside payload automatically.
--
-- Run manually in the Supabase dashboard SQL editor. Idempotent.

ALTER TABLE public.brand_kits
  ADD COLUMN IF NOT EXISTS fonts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.brand_kits.fonts IS
  'Detected fonts as [{ name, confidence }]. Server-side filtered to the 25-OFL bundled set, capped at 3, confidence floor 0.6. Empty array when detection failed or predates Day 33.';
