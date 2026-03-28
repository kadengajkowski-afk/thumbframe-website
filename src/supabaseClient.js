import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Supabase Init] Missing CRA env vars. Expected REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY. ' +
    'In Create React App, frontend variables must use the REACT_APP_ prefix.'
  );
  throw new Error(
    'Supabase client initialization failed: missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
