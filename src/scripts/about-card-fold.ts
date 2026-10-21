let cleanup: (() => void) | undefined;

function initializeAboutCardFold(): void {
  cleanup?.();
  cleanup = undefined;

  const stage = document.querySelector<HTMLElement>('.about-main');
  const card = stage?.querySelector<HTMLElement>('.identity-card');
  if (!stage || !card) return;

  const controller = new AbortController();
  const { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let bounds = card.getBoundingClientRect();
  let tiltLimit = 7;
  let frame = 0;
  let previousTime = 0;
  let pitch = 0;
  let yaw = 0;
  let targetPitch = 0;
  let targetYaw = 0;

  card.style.transformOrigin = 'center center';

  const clearTilt = (): void => {
    card.style.transform = '';
    card.style.willChange = '';
  };

  const render = (time: number): void => {
    frame = 0;
    const blend = 1 - Math.exp(-Math.min(time - (previousTime || time - 16), 64) / 85);
    previousTime = time;
    pitch += (targetPitch - pitch) * blend;
    yaw += (targetYaw - yaw) * blend;
    if (Math.abs(targetPitch - pitch) < 0.01 && Math.abs(targetYaw - yaw) < 0.01) {
      pitch = targetPitch;
      yaw = targetYaw;
    }
    if (pitch === 0 && yaw === 0) {
      clearTilt();
      return;
    }
    card.style.transform = `perspective(4500px) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
    if (pitch !== targetPitch || yaw !== targetYaw) frame = requestAnimationFrame(render);
    else card.style.willChange = '';
  };

  const schedule = (): void => {
    if (frame) return;
    card.style.willChange = 'transform';
    previousTime = 0;
    frame = requestAnimationFrame(render);
  };

  const stop = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    pitch = yaw = targetPitch = targetYaw = 0;
    clearTilt();
  };

  const settle = (): void => {
    targetPitch = 0;
    targetYaw = 0;
    if (pitch === 0 && yaw === 0) stop();
    else schedule();
  };

  const measure = (): void => {
    stop();
    bounds = card.getBoundingClientRect();
    const sideRoom = Math.max(0, Math.min(bounds.left, window.innerWidth - bounds.right));
    tiltLimit = Math.min(7, 2.5 + sideRoom / 45);
  };

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !pointer.matches || motion.matches || document.hidden) return;
    const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    if (Math.abs(x) > 1 || Math.abs(y) > 1) {
      settle();
      return;
    }
    targetPitch = -y * tiltLimit;
    targetYaw = x * tiltLimit;
    schedule();
  }, { passive: true, signal });
  stage.addEventListener('pointerleave', settle, { signal });
  window.addEventListener('blur', settle, { signal });
  window.addEventListener('resize', measure, { signal });
  window.addEventListener('scroll', measure, { passive: true, signal });
  motion.addEventListener('change', () => { if (motion.matches) stop(); }, { signal });
  pointer.addEventListener('change', () => { if (!pointer.matches) stop(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  const observer = new ResizeObserver(measure);
  observer.observe(card);
  measure();

  cleanup = () => {
    controller.abort();
    observer.disconnect();
    stop();
    card.style.transformOrigin = '';
  };
}

document.addEventListener('astro:page-load', initializeAboutCardFold);
document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pagehide', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pageshow', (event) => { if (event.persisted) initializeAboutCardFold(); });
