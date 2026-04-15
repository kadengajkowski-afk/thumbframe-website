import { useState, useEffect, useCallback } from 'react';
import supabase from '../../supabaseClient';

export default function useStreak(user) {
  const [streak, setStreak] = useState({ current: 0, longest: 0, freezeAvailable: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoaded(true); return; }
    supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setStreak({ current: data.current_streak, longest: data.longest_streak, freezeAvailable: data.streak_freeze_available });
        }
        setLoaded(true);
      });
  }, [user?.id]);

  const recordActivity = useCallback(async () => {
    if (!user?.id) return;
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const last = existing?.last_active_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let newCurrent = 1;
    let freeze = existing?.streak_freeze_available ?? false;
    const longest = existing?.longest_streak ?? 0;

    if (last === today) {
      setLoaded(true);
      return;
    } else if (last === yesterday) {
      newCurrent = (existing?.current_streak ?? 0) + 1;
    } else if (last && freeze) {
      newCurrent = (existing?.current_streak ?? 0) + 1;
      freeze = false;
    }

    const newLongest = Math.max(longest, newCurrent);

    await supabase.from('user_streaks').upsert({
      user_id: user.id,
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_active_date: today,
      streak_freeze_available: freeze,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    setStreak({ current: newCurrent, longest: newLongest, freezeAvailable: freeze });
  }, [user?.id]);

  return { streak, loaded, recordActivity };
}
