let mermaidModule: Promise<(typeof import('mermaid'))['default']> | undefined;

function loadMermaid() {
  mermaidModule ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    return mermaid;
  });
  return mermaidModule;
}

async function renderMermaidTargets(): Promise<void> {
  const codeBlocks = Array.from(
    document.querySelectorAll<HTMLElement>('.language-mermaid:not([data-mermaid-pending])')
  );
  if (codeBlocks.length === 0) return;

  codeBlocks.forEach((code) => (code.dataset.mermaidPending = 'true'));
  const mermaid = await loadMermaid();

  await Promise.all(
    codeBlocks.map(async (code) => {
      const sourceBlock = code.closest('pre');
      if (!sourceBlock) return;

      const target = document.createElement('div');
      target.className = 'mermaid';
      target.dataset.mermaid = '';
      target.textContent = code.textContent ?? '';
      sourceBlock.after(target);

      try {
        await mermaid.run({ nodes: [target] });
        sourceBlock.remove();
      } catch {
        target.remove();
        delete code.dataset.mermaidPending;
      }
    })
  );
}

void renderMermaidTargets();
document.addEventListener('astro:page-load', () => void renderMermaidTargets());
document.addEventListener('hatrix:protected-content-ready', () => void renderMermaidTargets());
