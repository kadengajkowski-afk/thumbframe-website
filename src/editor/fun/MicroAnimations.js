function getOverlay() {
  let overlay = document.getElementById('tf-micro-animation-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tf-micro-animation-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;';
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function animateColorGradeApplied(canvasRect) {
  const overlay = getOverlay();
  const cx = canvasRect ? canvasRect.left + canvasRect.width / 2 : window.innerWidth / 2;
  const cy = canvasRect ? canvasRect.top + canvasRect.height / 2 : window.innerHeight / 2;

  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position:absolute;
    width:80px;height:80px;
    border-radius:50%;
    border:2px solid #f97316;
    left:${cx - 40}px;top:${cy - 40}px;
    transform:scale(0);opacity:1;
  `;
  overlay.appendChild(ripple);

  const anim = ripple.animate(
    [{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(3)', opacity: 0 }],
    { duration: 600, easing: 'ease-out' }
  );
  anim.onfinish = () => ripple.remove();
}

export function animateExportSuccess(buttonRect) {
  const overlay = getOverlay();
  const cx = buttonRect ? buttonRect.left + buttonRect.width / 2 : window.innerWidth / 2;
  const cy = buttonRect ? buttonRect.top + buttonRect.height / 2 : window.innerHeight / 2;

  const colors = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  for (let i = 0; i < 30; i++) {
    const dot = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const startX = cx + (Math.random() - 0.5) * 40;
    const startY = cy + (Math.random() - 0.5) * 40;
    const vx = (Math.random() - 0.5) * 8;
    const vy = (Math.random() - 0.5) * 8 - 4;

    dot.style.cssText = `
      position:absolute;
      width:8px;height:8px;
      border-radius:2px;
      background:${color};
      left:${startX}px;top:${startY}px;
    `;
    overlay.appendChild(dot);

    const frames = [];
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = startX + vx * s * 4;
      const y = startY + vy * s * 4 + 0.5 * 9.8 * s * s * 0.4;
      frames.push({ transform: `translate(${x - startX}px, ${y - startY}px)`, opacity: 1 - t * 0.8 });
    }

    const anim = dot.animate(frames, { duration: 1200, easing: 'linear' });
    anim.onfinish = () => dot.remove();
  }

  const star = document.createElement('div');
  star.style.cssText = `
    position:absolute;
    width:120px;height:2px;
    background:linear-gradient(90deg,transparent,white,transparent);
    left:-120px;top:${Math.random() * window.innerHeight * 0.3}px;
    transform:rotate(-15deg);
  `;
  overlay.appendChild(star);
  const starAnim = star.animate(
    [{ left: '-120px', opacity: 1 }, { left: `${window.innerWidth + 120}px`, opacity: 0 }],
    { duration: 800, easing: 'ease-in' }
  );
  starAnim.onfinish = () => star.remove();
}

export function animateLayerAdded(layerElement) {
  if (!layerElement) return;
  layerElement.animate(
    [{ transform: 'translateY(-12px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
    { duration: 250, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
  );
}

export function animateLayerDeleted(layerElement) {
  if (!layerElement) return;
  layerElement.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.8) translateX(20px)' }],
    { duration: 200 }
  );
}

export function animateTemplateApplied(canvasRect) {
  const overlay = getOverlay();
  const wipe = document.createElement('div');
  wipe.style.cssText = `
    position:absolute;
    top:0;left:-100%;
    width:100%;height:100%;
    background:black;
    opacity:0.85;
  `;
  overlay.appendChild(wipe);

  const anim = wipe.animate(
    [
      { left: '-100%', opacity: 0.85 },
      { left: '0%',    opacity: 0.85, offset: 0.4 },
      { left: '100%',  opacity: 0.85, offset: 0.7 },
      { left: '100%',  opacity: 0,    offset: 1 },
    ],
    { duration: 700, easing: 'ease-in-out' }
  );
  anim.onfinish = () => wipe.remove();
}

export function animateUndo(canvasRect) {
  const overlay = getOverlay();
  const cx = canvasRect ? canvasRect.left + canvasRect.width / 2 : window.innerWidth / 2;
  const cy = canvasRect ? canvasRect.top + canvasRect.height / 2 : window.innerHeight / 2;
  const radius = 60;

  for (let i = 0; i < 8; i++) {
    const angle = (i * 45 * Math.PI) / 180;
    const startX = cx + Math.cos(angle) * radius - 4;
    const startY = cy + Math.sin(angle) * radius - 4;

    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute;
      width:8px;height:8px;
      border-radius:50%;
      background:#3b82f6;
      left:${startX}px;top:${startY}px;
    `;
    overlay.appendChild(dot);

    const anim = dot.animate(
      [
        { transform: `translate(0,0)`, opacity: 1 },
        { transform: `translate(${cx - startX - 4}px,${cy - startY - 4}px)`, opacity: 0 },
      ],
      { duration: 500, easing: 'ease-in', delay: i * 20 }
    );
    anim.onfinish = () => dot.remove();
  }
}

export function animateRedo(canvasRect) {
  const overlay = getOverlay();
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:absolute;
    inset:0;
    background:#f97316;
    opacity:0.15;
  `;
  overlay.appendChild(flash);

  const anim = flash.animate(
    [{ opacity: 0.15 }, { opacity: 0 }],
    { duration: 150, easing: 'ease-out' }
  );
  anim.onfinish = () => flash.remove();
}

export function animateSliderGlow(thumbElement) {
  if (!thumbElement) return;
  thumbElement.style.boxShadow = '0 0 8px #f97316';
  setTimeout(() => { thumbElement.style.boxShadow = ''; }, 400);
}

export function animateRainbowExplosion() {
  const overlay = getOverlay();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < 60; i++) {
    const particle = document.createElement('div');
    const color = `hsl(${i * 6},100%,60%)`;
    const angle = (i / 60) * Math.PI * 2;
    const speed = 3 + Math.random() * 5;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    particle.style.cssText = `
      position:absolute;
      width:10px;height:10px;
      border-radius:50%;
      background:${color};
      left:${cx - 5}px;top:${cy - 5}px;
    `;
    overlay.appendChild(particle);

    const steps = 30;
    const frames = Array.from({ length: steps + 1 }, (_, s) => {
      const t = s / steps;
      return {
        transform: `translate(${vx * s * 6}px,${vy * s * 6}px)`,
        opacity: 1 - t,
      };
    });

    const anim = particle.animate(frames, { duration: 1000, easing: 'ease-out' });
    anim.onfinish = () => particle.remove();
  }
}

export function animateUFO() {
  const overlay = getOverlay();
  const y = window.innerHeight * (0.2 + Math.random() * 0.5);
  const ufo = document.createElement('div');
  ufo.textContent = '🛸';
  ufo.style.cssText = `
    position:absolute;
    font-size:32px;
    left:-60px;
    top:${y}px;
  `;
  overlay.appendChild(ufo);

  const duration = 2000;
  const steps = 60;
  const frames = Array.from({ length: steps + 1 }, (_, s) => {
    const t = s / steps;
    const x = -60 + t * (window.innerWidth + 120);
    const sineY = Math.sin(t * Math.PI * 4) * 20;
    return { transform: `translate(${x}px,${sineY}px)` };
  });

  const anim = ufo.animate(frames, { duration, easing: 'linear' });
  anim.onfinish = () => ufo.remove();
}

export function animateAurora() {
  const overlay = getOverlay();
  const aurora = document.createElement('div');
  aurora.style.cssText = `
    position:absolute;
    inset:0;
    background:radial-gradient(ellipse at 50% 30%, #10b98166, #3b82f666, #8b5cf666, transparent);
    opacity:0;
  `;
  overlay.appendChild(aurora);

  const anim = aurora.animate(
    [{ opacity: 0 }, { opacity: 0.4, offset: 0.5 }, { opacity: 0 }],
    { duration: 3000, easing: 'ease-in-out' }
  );
  anim.onfinish = () => aurora.remove();
}

export function animateLevelUp() {
  const overlay = getOverlay();

  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:white;opacity:0.3;';
  overlay.appendChild(flash);
  const flashAnim = flash.animate([{ opacity: 0.3 }, { opacity: 0 }], { duration: 300 });
  flashAnim.onfinish = () => flash.remove();

  const text = document.createElement('div');
  text.textContent = 'LEVEL UP!';
  text.style.cssText = `
    position:absolute;
    left:50%;top:50%;
    transform:translate(-50%,-50%);
    font-size:48px;
    font-weight:900;
    color:#f97316;
    font-family:Inter,-apple-system,sans-serif;
    text-shadow:0 0 30px #f97316;
    white-space:nowrap;
  `;
  overlay.appendChild(text);
  const textAnim = text.animate(
    [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-70%) scale(1.2)' }],
    { duration: 1500, delay: 200, easing: 'ease-out' }
  );
  textAnim.onfinish = () => text.remove();

  const colors = ['#f59e0b', '#fbbf24', '#f97316', '#fcd34d'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 100;
    const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 60;
    const vx = (Math.random() - 0.5) * 10;
    const vy = -4 - Math.random() * 6;

    p.style.cssText = `
      position:absolute;
      width:8px;height:8px;
      border-radius:2px;
      background:${color};
      left:${startX}px;top:${startY}px;
    `;
    overlay.appendChild(p);

    const steps = 20;
    const frames = Array.from({ length: steps + 1 }, (_, s) => {
      const t = s / steps;
      return {
        transform: `translate(${vx * s * 5}px,${vy * s * 5 + 0.5 * 9.8 * s * s * 0.5}px)`,
        opacity: 1 - t,
      };
    });

    const anim = p.animate(frames, { duration: 1400, easing: 'linear', delay: Math.random() * 200 });
    anim.onfinish = () => p.remove();
  }
}
