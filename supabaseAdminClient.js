const { createClient } = require('@supabase/supabase-js');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!process.env.SUPABASE_URL || !serviceRoleKey) {
  console.error('[SUPABASE ADMIN] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — Supabase disabled.');
}

const supabaseAdmin = (process.env.SUPABASE_URL && serviceRoleKey)
  ? createClient(process.env.SUPABASE_URL, serviceRoleKey)
  : null;

module.exports = supabaseAdmin;
