import type { SakanaApi, SakanaInstance } from 'sakana';

const IDLE_TIMEOUT_MS = 1_000;
const FALLBACK_DELAY_MS = 200;
const SAKANA_WIDTH = 500;
const SAKANA_HEIGHT = 800;
const ROD_COLOR = '#182562';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let instances: SakanaInstance[] = [];
let sakanaApi: SakanaApi | undefined;

function resetSakanaValue(instance: SakanaInstance): void {
  const value = instance.getValue();
  value.r = 0;
  value.y = 0;
  value.t = 0;
  value.w = 0;
  instance.pause();
}

function renderRestingPose(mount: HTMLElement): void {
  const character = mount.querySelector<HTMLElement>('.sakana-character');
  const canvas = mount.querySelector<HTMLCanvasElement>('canvas');
  const context = canvas?.getContext('2d');
  if (!character || !canvas || !context) throw new Error('Sakana render targets are missing');

  character.style.transform = 'rotate(0deg) translateX(0px) translateY(0px)';
  context.clearRect(0, 0, SAKANA_WIDTH, SAKANA_HEIGHT);
  context.save();
  context.strokeStyle = ROD_COLOR;
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(250, 780);
  context.quadraticCurveTo(250, 715, 250, 540);
  context.stroke();
  context.restore();
}

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
    instances.forEach(resetSakanaValue);
    renderRestingPose(chisatoMount);
    renderRestingPose(takinaMount);
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
