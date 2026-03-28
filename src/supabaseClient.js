import { createClient } from '@supabase/supabase-js';

function getViteEnv() {
  try {
    // eslint-disable-next-line no-new-func
    return Function('try { return import.meta?.env || {}; } catch (e) { return {}; }')();
  } catch (e) {
    return {};
  }
}

const viteEnv = getViteEnv();
const supabaseUrl =
  viteEnv?.VITE_SUPABASE_URL ||
  process.env?.NEXT_PUBLIC_SUPABASE_URL ||
  process.env?.REACT_APP_SUPABASE_URL;
const supabaseKey =
  viteEnv?.VITE_SUPABASE_ANON_KEY ||
  process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env?.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  const missing = [];
  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / REACT_APP_SUPABASE_URL');
  }
  if (!supabaseKey) {
    missing.push('VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY / REACT_APP_SUPABASE_ANON_KEY');
  }
  console.error('[Supabase Init] Missing environment variable(s):', missing.join(', '));
  console.error('[Supabase Init] Ensure your frontend env vars are defined for your build tool.');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export default supabase;
