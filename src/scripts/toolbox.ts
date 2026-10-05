const boundToolboxes = new WeakSet<HTMLElement>();

const setModuleTilt = (module: HTMLElement, event: PointerEvent) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const bounds = module.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  module.style.setProperty('--module-rx', `${(-y * 8).toFixed(2)}deg`);
  module.style.setProperty('--module-ry', `${(x * 9).toFixed(2)}deg`);
};

const resetModuleTilt = (module: HTMLElement) => {
  module.style.removeProperty('--module-rx');
  module.style.removeProperty('--module-ry');
};

const bindToolbox = (toolbox: HTMLElement) => {
  if (boundToolboxes.has(toolbox)) return;
  boundToolboxes.add(toolbox);

  const readout = toolbox.querySelector<HTMLElement>('[data-tool-readout]');
  const readoutName = readout?.querySelector<HTMLElement>('[data-tool-readout-name]');
  const readoutDescription = readout?.querySelector<HTMLElement>('[data-tool-readout-description]');
  const readoutKind = readout?.querySelector<HTMLElement>('[data-tool-readout-kind]');
  const readoutIndex = readout?.querySelector<HTMLElement>('[data-tool-readout-index]');
  const modules = toolbox.querySelectorAll<HTMLElement>('[data-tool-module]');

  const inspectModule = (module: HTMLElement) => {
    if (!readout || !readoutName || !readoutDescription || !readoutKind || !readoutIndex) return;

    readoutName.textContent = module.dataset.toolName ?? '';
    readoutDescription.textContent = module.dataset.toolDescription ?? '';
    readoutKind.textContent = module.dataset.toolKindLabel ?? '';
    readoutIndex.textContent = `${module.dataset.toolIndex ?? '00'} / ${module.dataset.toolTotal ?? '00'}`;
    readout.dataset.tone = module.dataset.toolTone ?? 'cyan';
    readout.dataset.active = '';
  };

  modules.forEach((module) => {
    module.addEventListener('pointerenter', () => inspectModule(module));
    module.addEventListener('focusin', () => inspectModule(module));
    module.addEventListener('pointermove', (event) => setModuleTilt(module, event));
    module.addEventListener('pointerleave', () => resetModuleTilt(module));
    module.addEventListener('blur', () => resetModuleTilt(module));
  });
};

const bindToolboxes = () => {
  document.querySelectorAll<HTMLElement>('[data-toolbox]').forEach(bindToolbox);
};

document.addEventListener('astro:page-load', bindToolboxes);
bindToolboxes();
