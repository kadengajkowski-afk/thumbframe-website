import supabase from './supabaseClient';

export async function signIn({ email, password, setLoading }) {
  setLoading(true);
  try {
    console.log('Attempting login with:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('Auth result:', data, error);
    return { data, error };
  } catch (error) {
    console.error('Auth sign-in exception:', error);
    return { data: null, error };
  } finally {
    setLoading(false);
  }
}
