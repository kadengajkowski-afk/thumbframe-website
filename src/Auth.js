import supabase from './supabaseClient';

export async function signIn({ email, password, setLoading }) {
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      return { data: null, error };
    }

    if (data?.session) {
      setLoading(false);
      window.location.href = '/editor';
      return { data, error: null };
    }

    setLoading(false);
    return { data, error: new Error('No session returned') };
  } catch (error) {
    setLoading(false);
    return { data: null, error };
  }
}
