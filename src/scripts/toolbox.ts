const boundToolboxes = new WeakSet<HTMLElement>();

const bindToolbox = (toolbox: HTMLElement) => {
  if (boundToolboxes.has(toolbox)) return;
  boundToolboxes.add(toolbox);

  const readout = toolbox.querySelector<HTMLElement>('[data-tool-readout]');
  const readoutName = readout?.querySelector<HTMLElement>('[data-tool-readout-name]');
  const readoutDescription = readout?.querySelector<HTMLElement>('[data-tool-readout-description]');
  const modules = toolbox.querySelectorAll<HTMLElement>('[data-tool-module]');

  const inspectModule = (module: HTMLElement) => {
    if (!readout || !readoutName || !readoutDescription) return;

    readoutName.textContent = module.dataset.toolName ?? '';
    readoutDescription.textContent = module.dataset.toolDescription ?? '';
    modules.forEach((item) => item.removeAttribute('data-active'));
    module.setAttribute('data-active', '');
  };

  modules.forEach((module) => {
    module.addEventListener('pointerenter', () => inspectModule(module));
    module.addEventListener('focusin', () => inspectModule(module));
  });

  const firstModule = modules.item(0);
  if (firstModule) inspectModule(firstModule);
};

const bindToolboxes = () => {
  document.querySelectorAll<HTMLElement>('[data-toolbox]').forEach(bindToolbox);
};

document.addEventListener('astro:page-load', bindToolboxes);
bindToolboxes();
