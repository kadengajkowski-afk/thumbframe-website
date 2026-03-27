import { createClient } from '@supabase/supabase-js';

console.log('[SUPABASE] Initializing client...');
console.log('[SUPABASE] URL:', process.env.REACT_APP_SUPABASE_URL);
console.log('[SUPABASE] Key exists:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  console.error('[SUPABASE] ERROR: Missing environment variables!');
  console.error('[SUPABASE] REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
  console.error('[SUPABASE] REACT_APP_SUPABASE_ANON_KEY exists:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);
}

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: 'thumbframe-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

console.log('[SUPABASE] Client created:', !!supabase);

export default supabase;
