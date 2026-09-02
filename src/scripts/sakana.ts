import type { SakanaApi, SakanaInstance } from 'sakana';

const IDLE_TIMEOUT_MS = 1_000;
const FALLBACK_DELAY_MS = 200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let instances: SakanaInstance[] = [];
let sakanaApi: SakanaApi | undefined;

function applyMotionPreference(reduce: boolean): void {
  const layer = document.querySelector<HTMLElement>('[data-sakana-layer]');
  if (layer) layer.dataset.sakanaMotion = reduce ? 'reduced' : 'full';
  sakanaApi?.setMute(reduce);
  if (reduce) instances.forEach((instance) => instance.pause());
}

async function initializeSakanaCharacters(layer: HTMLElement): Promise<void> {
  if (layer.dataset.sakanaState === 'ready' || layer.dataset.sakanaState === 'loading') return;
  layer.dataset.sakanaState = 'loading';

  try {
    const chisatoMount = layer.querySelector<HTMLElement>('[data-sakana-mount="chisato"]');
    const takinaMount = layer.querySelector<HTMLElement>('[data-sakana-mount="takina"]');
    if (!chisatoMount || !takinaMount) throw new Error('Sakana mount points are missing');

    const { default: Sakana } = await import('sakana');
    sakanaApi = Sakana;

    const baseOptions = {
      r: 0,
      y: 0,
      scale: 1,
      canSwitchCharacter: false
    } as const;

    instances = [
      Sakana.init({ ...baseOptions, el: chisatoMount, character: 'chisato' }),
      Sakana.init({ ...baseOptions, el: takinaMount, character: 'takina' })
    ];
    instances.forEach((instance) => instance.pause());
    layer.dataset.sakanaState = 'ready';
    applyMotionPreference(reducedMotion.matches);
  } catch (error) {
    instances = [];
    sakanaApi = undefined;
    layer.dataset.sakanaState = 'error';
    console.error('Unable to initialize Sakana characters', error);
  }
}

function scheduleSakanaInitialization(): void {
  const layer = document.querySelector<HTMLElement>('[data-sakana-layer]');
  if (!layer || layer.dataset.sakanaState) return;
  layer.dataset.sakanaState = 'scheduled';

  const run = () => {
    if (!layer.isConnected) return;
    void initializeSakanaCharacters(layer);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(run, FALLBACK_DELAY_MS);
  }
}

reducedMotion.addEventListener('change', (event) => applyMotionPreference(event.matches));
document.addEventListener('astro:page-load', scheduleSakanaInitialization);
scheduleSakanaInitialization();
