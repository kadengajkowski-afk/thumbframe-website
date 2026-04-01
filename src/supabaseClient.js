import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.REACT_APP_SUPABASE_URL;
const rawKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const fallbackUrl = 'http://localhost:54321';
const fallbackKey = 'public-anon-key';

// Treat placeholder/missing values as absent — only accept real HTTP(S) URLs
const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl : null;
const supabaseKey = (rawKey && rawKey.length > 20 && !rawKey.includes('_here')) ? rawKey : null;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Supabase Init] Missing or invalid environment variables.\n' +
    '  REACT_APP_SUPABASE_URL =', rawUrl || '(not set)', '\n' +
    '  REACT_APP_SUPABASE_ANON_KEY =', rawKey ? '(set but invalid)' : '(not set)', '\n' +
    'Add real values to your .env file. Falling back to localhost so the app does not crash.'
  );
}

const supabase = createClient(supabaseUrl || fallbackUrl, supabaseKey || fallbackKey);

export default supabase;
