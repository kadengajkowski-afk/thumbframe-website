import supabase from './supabaseClient';

export async function signIn({ email, password, setLoading }) {
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { data: null, error };
    }

    if (data?.session) {
      // Immediate redirect - no queries, no awaits
      window.location.href = '/';
      return { data, error: null };
    }

    return { data, error: new Error('No session returned') };
  } catch (error) {
    console.error('Auth error:', error);
    return { data: null, error };
  } finally {
    setLoading(false);
  }
}
