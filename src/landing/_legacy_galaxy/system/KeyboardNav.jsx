// Keyboard navigation — v3 §7.
//   ←  prev planet
//   →  next planet
//   Esc return to galaxy
//   1-5 jump directly
//   Space toggle audio (placeholder until Phase I)

import { useEffect } from 'react';
import { useGalaxyStore, PLANET_IDS } from '../state/galaxyStore';

const KEY_TO_INDEX = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };

export default function KeyboardNav() {
  useEffect(() => {
    const handler = (e) => {
      // Never hijack inputs / buttons / textareas / content-editable.
      const tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) {
        return;
      }

      const { activePlanet, goToPlanet, returnToGalaxy, toggleAudio } = useGalaxyStore.getState();

      if (e.key === 'Escape') {
        if (activePlanet !== null) {
          e.preventDefault();
          returnToGalaxy();
        }
        return;
      }

      if (KEY_TO_INDEX[e.key] !== undefined) {
        e.preventDefault();
        goToPlanet(PLANET_IDS[KEY_TO_INDEX[e.key]]);
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dir = e.key === 'ArrowLeft' ? -1 : +1;
        if (activePlanet === null) {
          // From overview, arrows pick the first or last planet.
          goToPlanet(dir > 0 ? PLANET_IDS[0] : PLANET_IDS[PLANET_IDS.length - 1]);
          return;
        }
        const idx = PLANET_IDS.indexOf(activePlanet);
        const next = (idx + dir + PLANET_IDS.length) % PLANET_IDS.length;
        goToPlanet(PLANET_IDS[next]);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleAudio();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
