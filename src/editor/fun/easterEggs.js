import { animateRainbowExplosion, animateUFO, animateLevelUp } from './MicroAnimations';

let logoClickCount = 0;
let logoClickTimer = null;

export function handleLogoClick(unlockAchievement) {
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    animateRainbowExplosion();
    unlockAchievement?.('rainbow_explosion');
  }
}

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiBuffer = [];

export function initKonamiListener(onKonami) {
  const handler = (e) => {
    konamiBuffer.push(e.key);
    if (konamiBuffer.length > KONAMI.length) konamiBuffer.shift();
    if (konamiBuffer.join(',') === KONAMI.join(',')) {
      konamiBuffer = [];
      onKonami?.();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

export function triggerKonami(personality, unlockAchievement) {
  unlockAchievement?.('konami_code');
  const messages = {
    hype_coach:              "YOU FOUND THE KONAMI CODE! +30 LIVES! LET'S GOOOOO! 🎮🔥",
    brutally_honest:         "Oh you actually know the Konami code. Okay, you've earned one compliment: your thumbnails aren't terrible.",
    chill_creative_director: "Haha nice. Old school. I see you. Up up down down... classic. Keep that energy in your thumbnails.",
    data_nerd:               "Konami code detected. Probability of this being a coincidence: 0.0003%. Achievement unlocked. Respect.",
    the_legend:              "The code. The myth. The legend. Konami knew. Now YOU know. The clicks will flow.",
  };
  const msg = messages[personality] || messages.chill_creative_director;
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: msg, type: 'info' } }));
  animateLevelUp();
}

export function handleStarfieldClick(e, unlockAchievement) {
  if (e.shiftKey && e.altKey) {
    animateUFO();
    unlockAchievement?.('ufo_spotter');
  }
}

export function checkMidnightEasterEgg(unlockAchievement) {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 5) {
    unlockAchievement?.('midnight_editor');
    window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: "Editing at midnight? You're either very dedicated or very behind schedule. Respect either way. 🌙", type: 'info' } }));
  }
}

export function checkNiceAchievement(exportCount, unlockAchievement) {
  if (exportCount === 69) {
    unlockAchievement?.('nice_exports');
    window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'Nice. 😎', type: 'success' } }));
  }
}
