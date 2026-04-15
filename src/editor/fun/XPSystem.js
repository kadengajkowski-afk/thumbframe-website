export const XP_REWARDS = {
  export:           50,
  add_text:         10,
  add_layer:         5,
  color_grade:      15,
  template:         20,
  bg_removed:       30,
  ai_generated:     40,
  thumbfriend_chat: 10,
  face_enhanced:    25,
  style_transfer:   15,
};

const LEVELS = [
  { name: 'Rookie',       icon: '🌱', min: 0 },
  { name: 'Creator',      icon: '✏️', min: 100 },
  { name: 'Pro Creator',  icon: '🔥', min: 500 },
  { name: 'YouTube God',  icon: '👑', min: 2000 },
];

export function getLevel(totalXP) {
  const xp = totalXP || 0;
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) level = l;
  }
  const idx  = LEVELS.indexOf(level);
  const next = LEVELS[idx + 1] || null;
  const progress = next
    ? Math.round(((xp - level.min) / (next.min - level.min)) * 100)
    : 100;
  const xpToNext = next ? next.min - xp : 0;
  return { name: level.name, icon: level.icon, progress, nextLevel: next?.name || null, xpToNext };
}
