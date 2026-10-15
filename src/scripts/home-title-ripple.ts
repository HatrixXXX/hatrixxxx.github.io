import { animate } from 'animejs';

let cleanup: (() => void) | undefined;

function initializeTitleRipple(): void {
  cleanup?.();
  cleanup = undefined;
  const wrapper = document.querySelector<HTMLElement>('[data-home-stage] .identity-name');
  const control = wrapper?.querySelector<HTMLButtonElement>('.identity-trigger');
  const title = wrapper?.querySelector<HTMLElement>('h1');
  if (!wrapper || !control || !title) return;
  control.disabled = false;

  const controller = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let finishTimer = 0;
  let glow: ReturnType<typeof animate> | undefined;
  let activation = 0;

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;

    const rect = title.getBoundingClientRect();
    const x = event.detail === 0 ? title.offsetWidth / 2 : Math.min(title.offsetWidth, Math.max(0, (event.clientX - rect.left) * title.offsetWidth / rect.width));
    const y = event.detail === 0 ? title.offsetHeight / 2 : Math.min(title.offsetHeight, Math.max(0, (event.clientY - rect.top) * title.offsetHeight / rect.height));
    title.style.setProperty('--ripple-x', `${x}px`);
    title.style.setProperty('--ripple-y', `${y}px`);
    const radius = Number.parseFloat(getComputedStyle(title, '::after').getPropertyValue('--hatrix-glow-radius')) || 0;
    glow?.cancel();
    title.style.setProperty('--hatrix-glow-radius', `${radius}px`);
    wrapper.removeAttribute('data-rippling');
    void title.offsetWidth;
    wrapper.setAttribute('data-rippling', '');

    window.clearTimeout(finishTimer);
    const current = ++activation;
    const finish = () => {
      if (current !== activation) return;
      wrapper.removeAttribute('data-rippling');
      title.style.removeProperty('--hatrix-glow-radius');
      glow = undefined;
    };
    if (reducedMotion.matches) {
      finishTimer = window.setTimeout(finish, 220);
    } else {
      glow = animate(title, {
        '--hatrix-glow-radius': [`${radius}px`, '230px'],
        duration: 800,
        ease: 'out(3)',
        onComplete: finish,
      });
    }
  };

  control.addEventListener('click', onClick, { signal: controller.signal });
  cleanup = () => {
    controller.abort();
    window.clearTimeout(finishTimer);
    activation += 1;
    glow?.revert();
    wrapper.removeAttribute('data-rippling');
    title.style.removeProperty('--hatrix-glow-radius');
  };
}

document.addEventListener('astro:page-load', initializeTitleRipple);
document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
