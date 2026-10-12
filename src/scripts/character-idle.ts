/**
 * character-idle.ts
 * Controls the CharacterIdle rig:
 *  - Pauses CSS animations when the page/rig is hidden (performance)
 *  - ?characterMeshDebug=1 overlay
 */

import { waitForImages, type ReadinessImage } from '@/lib/image-readiness';

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
let activeRig: HTMLElement | null = null;

function cleanupCharacterIdle(): void {
  activeCleanup?.();
  activeCleanup = null;
  activeRig = null;
}

export async function prepareCharacter(rig: HTMLElement, signal: AbortSignal): Promise<void> {
  if (rig.dataset.characterState === 'error') return;
  rig.dataset.characterState = 'loading';
  const images = [...rig.querySelectorAll<HTMLImageElement>('img')] as ReadinessImage[];
  const state = await waitForImages(images, undefined, signal);
  if (signal.aborted || rig.dataset.characterState === 'error') return;
  rig.dataset.characterState = state;
  document.dispatchEvent(new CustomEvent('hatrix:character-state', {
    detail: { state },
  }));
}

function initCharacterIdle(): void {
  const rig = document.querySelector<HTMLElement>('[data-char-rig]');
  if (rig && rig === activeRig) return;
  cleanupCharacterIdle();
  if (!rig) return;

  const canvas = rig.querySelector<HTMLElement>('.char-canvas');
  if (!canvas) return;
  activeRig = rig;

  const allGroups = Array.from(rig.querySelectorAll<HTMLElement>('.char-group'));
  const cleanupFns: CleanupFn[] = [];

  const controller = new AbortController();
  const { signal } = controller;
  cleanupFns.push(() => controller.abort());
  void prepareCharacter(rig, signal);

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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCharacterIdle, { once: true });
} else {
  initCharacterIdle();
}
document.addEventListener('astro:before-swap', cleanupCharacterIdle);
window.addEventListener('pagehide', cleanupCharacterIdle);
window.addEventListener('pageshow', (event) => { if (event.persisted) initCharacterIdle(); });
