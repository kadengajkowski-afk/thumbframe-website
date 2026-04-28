import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Day 20 — Supabase client. Reads VITE_SUPABASE_URL +
 * VITE_SUPABASE_ANON_KEY from .env.local. When either is missing
 * the client is null and every persistence path silently falls
 * back to localStorage — so the editor still boots in a fresh
 * clone without env wiring.
 *
 * NEVER put the service_role key on the client. The anon key is
 * fine; RLS gates every table and the migrations enable RLS via
 * the DDL pattern. */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = _client;

export function isSupabaseConfigured(): boolean {
  return _client !== null;
}
