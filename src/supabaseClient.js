import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
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

export default supabase;
