import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const fallbackUrl = 'http://localhost:54321';
const fallbackKey = 'public-anon-key';

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase Init] Missing CRA env vars. Expected REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY. ' +
    'In Create React App, frontend variables must use the REACT_APP_ prefix. ' +
    'Using local fallback so editor local save flow can continue.'
  );
}

const supabase = createClient(supabaseUrl || fallbackUrl, supabaseKey || fallbackKey);

export default supabase;
