import { useState, useEffect, useCallback } from 'react';
import supabase from '../../supabaseClient';
import { ACHIEVEMENTS } from './achievements';
import { playAchievement } from './SoundEngine';

export default function useAchievements(user) {
  const [unlocked, setUnlocked] = useState(new Set());
  const [pendingToast, setPendingToast] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setUnlocked(new Set(data.map(r => r.achievement_id)));
      });
  }, [user?.id]);

  const unlock = useCallback(async (achievementId) => {
    if (unlocked.has(achievementId)) return;
    const def = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!def) return;

    setUnlocked(prev => new Set([...prev, achievementId]));
    setPendingToast(def);
    playAchievement();

    if (user?.id) {
      try {
        await supabase.from('user_achievements').insert({
          user_id: user.id,
          achievement_id: achievementId,
        });
        await supabase.rpc('add_xp', { p_amount: def.xp });
      } catch { /* ignore */ }
    }

    window.dispatchEvent(new CustomEvent('tf:achievement', { detail: def }));
  }, [unlocked, user?.id]);

  const checkTriggers = useCallback((context) => {
    if (context.exportCount === 1)   unlock('first_export');
    if (context.exportCount === 10)  unlock('ten_exports');
    if (context.exportCount === 50)  unlock('fifty_exports');
    if (context.exportCount === 69)  unlock('nice_exports');
    if (context.layerCount >= 5)     unlock('five_layers');
    if (context.usedColorGrade)      unlock('used_color_grade');
    if (context.usedTemplate)        unlock('template_applied');
    if (context.bgRemoved)           unlock('bg_removed');
    if (context.aiGenerated)         unlock('ai_generated');
    if (context.thumbfriendChat)     unlock('thumbfriend_chat');
    if (context.ctrScore >= 70)      unlock('ctr_score_70');
    if (context.ctrScore >= 90)      unlock('ctr_score_90');
    if (context.streak >= 3)         unlock('streak_3');
    if (context.streak >= 7)         unlock('streak_7');
    if (context.streak >= 30)        unlock('streak_30');
    if (context.hour >= 0 && context.hour < 4) unlock('night_owl');
    if (context.sessionMinutes < 3 && context.exportCount >= 1) unlock('speed_demon');
    if (context.undoCount >= 10)     unlock('undo_master');
    if (context.hasText)             unlock('first_text');
    if (context.faceEnhanced)        unlock('face_enhanced');
    if (context.styleTransferred)    unlock('style_transferred');
    if (context.youtubeConnected)    unlock('youtube_connected');
    if (context.showcaseSubmitted)   unlock('showcase_submitted');
  }, [unlock]);

  return { unlocked, unlock, checkTriggers, pendingToast, setPendingToast };
}
