-- 20260421120000_add_editor_version.sql
-- Adds per-user editor version flag for the v2 rebuild staged rollout.
-- Default 'v1' means no one is opted in until Kaden flips them individually.
-- The CHECK constraint ensures only known versions can be written.
--
-- Run manually in the Supabase dashboard SQL editor. Do not run from CI.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS editor_version TEXT DEFAULT 'v1'
    CHECK (editor_version IN ('v1', 'v2'));

COMMENT ON COLUMN profiles.editor_version IS
  'Which editor build the user sees. "v1" is the current PixiJS editor, "v2" is the Phase 0+ rebuild. Controlled per-user for staged rollout.';

-- Backfill: make existing rows explicit rather than relying on the default.
UPDATE profiles SET editor_version = 'v1' WHERE editor_version IS NULL;
