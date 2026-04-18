// URL hash router — /#/signal, /#/dead, /#/singularity, /#/docking, /#/science.
// On mount, reads the hash and jumps directly to that planet with no intro
// animation (user's §10 Q4 answer: direct-land). The store is also the
// source of truth — when activePlanet changes, we push a new hash.

import { useEffect } from 'react';
import { useGalaxyStore, PLANET_IDS } from '../state/galaxyStore';

function parseHash() {
  const h = window.location.hash || '';
  const m = h.match(/^#\/(\w+)$/);
  if (!m) return null;
  const id = m[1].toLowerCase();
  return PLANET_IDS.includes(id) ? id : null;
}

function writeHash(id) {
  const next = id ? `#/${id}` : '';
  if (window.location.hash !== next) {
    // Use replaceState when transitioning so back-button goes to previous
    // real navigation, not every planet hop.
    try {
      const url = new URL(window.location.href);
      url.hash = next;
      window.history.replaceState({}, '', url.toString());
    } catch {
      window.location.hash = next;
    }
  }
}

export default function HashRouter() {
  useEffect(() => {
    // On-mount: deep link → direct land.
    const initial = parseHash();
    if (initial) {
      useGalaxyStore.getState().goToPlanet(initial, { skipIntro: true });
    }

    // Back/forward: honour hash changes (with intro animation since the
    // user is actively navigating).
    const onHashChange = () => {
      const id = parseHash();
      if (id === null) {
        useGalaxyStore.getState().returnToGalaxy();
      } else {
        useGalaxyStore.getState().goToPlanet(id);
      }
    };
    window.addEventListener('hashchange', onHashChange);

    // Subscribe: keep URL in sync with store.
    const unsub = useGalaxyStore.subscribe((s) => {
      writeHash(s.activePlanet);
    });

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      unsub();
    };
  }, []);

  return null;
}
