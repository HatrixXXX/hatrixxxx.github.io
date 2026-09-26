/**
 * character-idle.ts
 * Controls the CharacterIdle rig:
 *  - Pauses CSS animations when the page/rig is hidden (performance)
 *  - Cursor parallax on desktop (smooth, small amplitude)
 *  - ?characterMeshDebug=1 overlay
 */

const PARALLAX_X_MAX = 2.5;
const PARALLAX_Y_MAX = 1.5;
const PARALLAX_SMOOTH = 0.06;

const PARALLAX_LAYERS: { selector: string; depthX: number; depthY: number }[] = [
  { selector: '.char-coat-back',     depthX: 0.30, depthY: 0.20 },
  { selector: '.char-coat-front',    depthX: 0.40, depthY: 0.25 },
  { selector: '.char-legs',          depthX: 0.50, depthY: 0.30 },
  { selector: '.char-feet',          depthX: 0.55, depthY: 0.35 },
  { selector: '.char-torso',         depthX: 1.00, depthY: 1.00 },
  { selector: '.char-head',          depthX: 1.10, depthY: 1.05 },
  { selector: '.char-arm-r',         depthX: 1.05, depthY: 1.00 },
  { selector: '.char-arm-l',         depthX: 1.05, depthY: 1.00 },
  { selector: '.char-torso-devices', depthX: 1.00, depthY: 1.00 },
  { selector: '.char-cable',         depthX: 1.00, depthY: 1.00 },
  { selector: '.char-cable-arm',     depthX: 1.05, depthY: 1.00 },
  { selector: '.char-waist',         depthX: 0.90, depthY: 0.90 },
  { selector: '.char-waist-devices', depthX: 0.90, depthY: 0.90 },
  { selector: '.char-leg-devices',   depthX: 0.80, depthY: 0.80 },
];

const DEBUG_JOINTS = [
  { name: 'torso',     x: 480, y: 350 },
  { name: 'head',      x: 512, y: 195 },
  { name: 'arm_r',     x: 316, y: 231 },
  { name: 'arm_l',     x: 604, y: 244 },
  { name: 'coat_back', x: 512, y: 620 },
  { name: 'coat_fnt',  x: 512, y: 610 },
  { name: 'cable',     x: 524, y: 370 },
  { name: 'cable_arm', x: 540, y: 430 },
  { name: 'waist',     x: 460, y: 580 },
];

type CleanupFn = () => void;
let activeCleanup: CleanupFn | null = null;

function isMobile(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
}

function initCharacterIdle(): void {
  activeCleanup?.();
  activeCleanup = null;

  const rig = document.querySelector<HTMLElement>('[data-char-rig]');
  if (!rig) return;

  const canvas = rig.querySelector<HTMLElement>('.char-canvas');
  if (!canvas) return;

  const allGroups = Array.from(rig.querySelectorAll<HTMLElement>('.char-group'));
  const cleanupFns: CleanupFn[] = [];

  const controller = new AbortController();
  const { signal } = controller;
  cleanupFns.push(() => controller.abort());

  function pauseAnimations(): void {
    allGroups.forEach((el) => { el.style.animationPlayState = 'paused'; });
  }
  function resumeAnimations(): void {
    allGroups.forEach((el) => { el.style.animationPlayState = ''; });
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? pauseAnimations() : resumeAnimations();
  }, { signal });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.isIntersecting ? resumeAnimations() : pauseAnimations();
    });
  }, { threshold: 0 });
  observer.observe(rig);
  cleanupFns.push(() => observer.disconnect());

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isMobile() && !prefersReducedMotion) {
    const rigEl: HTMLElement = rig;
    const layers = PARALLAX_LAYERS.map(({ selector, depthX, depthY }) => {
      const el = rigEl.querySelector<HTMLElement>(selector);
      return el ? { el, depthX, depthY } : null;
    }).filter((item): item is { el: HTMLElement; depthX: number; depthY: number } => item !== null);

    let targetNX = 0;
    let targetNY = 0;
    let currentNX = 0;
    let currentNY = 0;
    let rafId = 0;

    function applyParallax(): void {
      currentNX += (targetNX - currentNX) * PARALLAX_SMOOTH;
      currentNY += (targetNY - currentNY) * PARALLAX_SMOOTH;
      for (const { el, depthX, depthY } of layers) {
        el.style.setProperty('--par-x', (currentNX * PARALLAX_X_MAX * depthX).toFixed(3) + 'px');
        el.style.setProperty('--par-y', (currentNY * PARALLAX_Y_MAX * depthY).toFixed(3) + 'px');
      }
      rafId = requestAnimationFrame(applyParallax);
    }

    function onMouseMove(event: MouseEvent): void {
      const rect = rigEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetNX = Math.max(-1, Math.min(1, (event.clientX - cx) / (rect.width / 2)));
      targetNY = Math.max(-1, Math.min(1, (event.clientY - cy) / (rect.height / 2)));
    }

    document.addEventListener('mousemove', onMouseMove, { signal });
    document.addEventListener('mouseleave', () => { targetNX = 0; targetNY = 0; }, { signal });
    rafId = requestAnimationFrame(applyParallax);
    cleanupFns.push(() => cancelAnimationFrame(rafId));
  }



  const debugParam = new URLSearchParams(window.location.search).get('characterMeshDebug');
  if (debugParam === '1') {
    const SCALE = 0.697265625;
    const ns = 'http://www.w3.org/2000/svg';
    const overlay = document.createElementNS(ns, 'svg');
    overlay.setAttribute('viewBox', '0 0 1024 1536');
    overlay.style.cssText =
      'position:absolute;top:0;left:0;' +
      'width:' + (1024 * SCALE).toFixed(1) + 'px;' +
      'height:' + (1536 * SCALE).toFixed(1) + 'px;' +
      'pointer-events:none;z-index:9999;overflow:visible;';

    for (const joint of DEBUG_JOINTS) {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(joint.x));
      circle.setAttribute('cy', String(joint.y));
      circle.setAttribute('r', '6');
      circle.setAttribute('fill', '#ff4d4d');
      circle.setAttribute('opacity', '0.85');
      overlay.appendChild(circle);

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(joint.x + 9));
      text.setAttribute('y', String(joint.y + 4));
      text.setAttribute('font-size', '18');
      text.setAttribute('fill', '#fff');
      text.setAttribute('stroke', '#000');
      text.setAttribute('stroke-width', '3');
      text.setAttribute('paint-order', 'stroke');
      text.textContent = joint.name;
      overlay.appendChild(text);
    }

    let frames = 0;
    let fpsLast = performance.now();
    const fpsText = document.createElementNS(ns, 'text');
    fpsText.setAttribute('x', '10');
    fpsText.setAttribute('y', '30');
    fpsText.setAttribute('font-size', '22');
    fpsText.setAttribute('fill', '#0f0');
    fpsText.setAttribute('stroke', '#000');
    fpsText.setAttribute('stroke-width', '3');
    fpsText.setAttribute('paint-order', 'stroke');
    overlay.appendChild(fpsText);

    let fpsRafId = 0;
    function updateFps(): void {
      frames++;
      const now = performance.now();
      if (now - fpsLast >= 500) {
        fpsText.textContent = 'FPS: ' + String(Math.round(frames * 1000 / (now - fpsLast)));
        frames = 0;
        fpsLast = now;
      }
      fpsRafId = requestAnimationFrame(updateFps);
    }
    fpsRafId = requestAnimationFrame(updateFps);
    cleanupFns.push(() => { cancelAnimationFrame(fpsRafId); overlay.remove(); });
    rig.appendChild(overlay);
  }



  activeCleanup = () => { cleanupFns.forEach((fn) => fn()); };
}

document.addEventListener('astro:page-load', initCharacterIdle);
document.addEventListener('astro:before-swap', () => { activeCleanup?.(); activeCleanup = null; });
window.addEventListener('pagehide', () => { activeCleanup?.(); activeCleanup = null; });
window.addEventListener('pageshow', (event) => { if (event.persisted) initCharacterIdle(); });
