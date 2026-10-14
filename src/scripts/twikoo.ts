const TWIKOO_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js';
const TWIKOO_SCRIPT_INTEGRITY = 'sha384-4NeeZc0tIujxxq7kkMjvDpA4MwaKREjyVNMVeV2+hQgonShrBsu+UG26QGAWBpLD';

export {};

interface TwikooClient {
  init: (options: {
    envId: string;
    el: string;
    path: string;
    lang: 'zh-CN';
    onCommentLoaded: () => void;
  }) => Promise<unknown>;
}

declare global {
  interface Window {
    twikoo?: TwikooClient;
  }
}

let clientPromise: Promise<TwikooClient> | undefined;
let controlsObserver: MutationObserver | undefined;
let loadingControlTemplates: HTMLElement[] = [];
let adminReturnFocus: HTMLElement | null = null;

function labelControl(element: HTMLElement, label: string): void {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.title = label;
  if (element.dataset.twikooKeyboardReady) return;
  element.dataset.twikooKeyboardReady = 'true';
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    element.click();
  });
}

function enhanceControls(root: HTMLElement): void {
  const isGuestbook = !!root.closest('[data-twikoo-variant="guestbook"]');
  const actionGroup = root.querySelector<HTMLElement>('.tk-comments-actions');
  const actions = [...(actionGroup?.querySelectorAll<HTMLElement>(':scope > .tk-icon.__comments:not([data-twikoo-loading-control])') ?? [])];
  const labels = actions.length === 1 ? ['设置'] : ['搜索评论', '刷新评论', '设置'];
  actions.forEach((action, index) => labelControl(action, labels[index]));
  if (isGuestbook && actions.length >= 2) {
    loadingControlTemplates = actions.slice(0, 2).map((action) => action.cloneNode(true) as HTMLElement);
    actionGroup?.querySelectorAll('[data-twikoo-loading-control]').forEach((placeholder) => placeholder.remove());
  } else if (isGuestbook && actionGroup && loadingControlTemplates.length === 2 && !actionGroup.querySelector('[data-twikoo-loading-control]')) {
    loadingControlTemplates.forEach((template, index) => {
      const placeholder = template.cloneNode(true) as HTMLElement;
      placeholder.dataset.twikooLoadingControl = index === 0 ? 'search' : 'refresh';
      placeholder.setAttribute('aria-disabled', 'true');
      placeholder.tabIndex = -1;
      actionGroup.insertBefore(placeholder, actions[0] ?? null);
    });
  }
  if (isGuestbook) {
    const adminOpen = !!root.querySelector('.tk-admin.__show');
    const wasAdminOpen = actionGroup?.hasAttribute('data-admin-open') ?? false;
    if (adminOpen && !wasAdminOpen) {
      adminReturnFocus = actions.at(-1) ?? null;
    }
    actionGroup?.toggleAttribute('data-admin-open', adminOpen);
    actionGroup?.toggleAttribute('inert', adminOpen);
    if (adminOpen && !wasAdminOpen) {
      root.querySelector<HTMLElement>('.tk-admin.__show input, .tk-admin.__show button')?.focus();
    } else if (!adminOpen && wasAdminOpen) {
      adminReturnFocus?.focus();
      adminReturnFocus = null;
    }
  }

  root.querySelectorAll<HTMLElement>('.tk-comment').forEach((comment) => {
    const nick = comment.querySelector<HTMLElement>(':scope > .tk-main > .tk-row .tk-nick');
    if (!comment.hasAttribute('tabindex')) {
      comment.tabIndex = 0;
      comment.setAttribute('role', 'group');
      comment.setAttribute('aria-label', `${nick?.textContent?.trim() || '访客'}的留言`);
    }

    const nickLink = comment.querySelector<HTMLAnchorElement>(':scope > .tk-main > .tk-row .tk-nick-link');
    if (nickLink?.hasAttribute('href')) {
      nickLink.removeAttribute('href');
      nickLink.removeAttribute('target');
      nickLink.removeAttribute('rel');
      nickLink.tabIndex = -1;
    }

    const buttons = [...comment.querySelectorAll<HTMLButtonElement>(':scope > .tk-main > .tk-row > .tk-action > .tk-action-link')];
    const names = buttons.length === 4 ? ['删除留言', '点赞', '点踩', '回复'] : buttons.length === 3 ? ['点赞', '点踩', '回复'] : ['点赞', '回复'];
    buttons.forEach((button, index) => {
      const name = names[index];
      if (!name) return;
      button.type = 'button';
      button.setAttribute('aria-label', name);
      button.title = name;
      button.dataset.twikooAction = name === '删除留言' ? 'delete' : name;
    });
  });
}

function observeControls(root: HTMLElement): void {
  controlsObserver?.disconnect();
  loadingControlTemplates = [];
  adminReturnFocus = null;
  enhanceControls(root);
  controlsObserver = new MutationObserver(() => enhanceControls(root));
  controlsObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class'] });
}

function loadTwikoo(): Promise<TwikooClient> {
  if (window.twikoo?.init) return Promise.resolve(window.twikoo);
  if (clientPromise) return clientPromise;

  document.querySelector(`script[src="${TWIKOO_SCRIPT_URL}"]`)?.remove();

  clientPromise = new Promise<TwikooClient>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TWIKOO_SCRIPT_URL;
    script.integrity = TWIKOO_SCRIPT_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', () => {
      if (window.twikoo?.init) resolve(window.twikoo);
      else reject(new Error('Twikoo client did not initialize'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Twikoo client could not load')), { once: true });
    document.head.append(script);
  }).catch((error) => {
    clientPromise = undefined;
    throw error;
  });

  return clientPromise;
}

async function mountSection(section: HTMLElement): Promise<void> {
  const state = section.dataset.twikooState;
  if (state === 'loading' || state === 'ready' || state === 'error') return;

  const status = section.querySelector<HTMLElement>('[data-twikoo-status]');
  const root = section.querySelector<HTMLElement>('[data-twikoo-root]');
  if (!status || !root) return;

  const envId = section.dataset.twikooEnvId?.trim();
  if (!envId) {
    status.textContent = '评论服务尚未配置。';
    section.dataset.twikooState = 'unconfigured';
    return;
  }

  section.dataset.twikooState = 'loading';
  status.hidden = false;
  status.textContent = '评论正在加载…';
  const slowTimer = window.setTimeout(() => {
    if (section.isConnected && section.dataset.twikooState === 'loading') {
      status.textContent = '评论加载较慢，请检查网络或稍后刷新页面。';
    }
  }, 12000);

  try {
    const twikoo = await loadTwikoo();
    if (!section.isConnected) return;
    await twikoo.init({
      envId,
      el: `#${root.id}`,
      path: section.dataset.twikooPath || window.location.pathname,
      lang: 'zh-CN',
      onCommentLoaded: () => {
        if (!section.isConnected) return;
        section.dataset.twikooState = 'ready';
        status.hidden = true;
      }
    });
    if (!section.isConnected) return;
    section.dataset.twikooState = 'ready';
    status.hidden = true;
    observeControls(root);
  } catch {
    if (!section.isConnected) return;
    root.replaceChildren();
    section.dataset.twikooState = 'error';
    status.textContent = '评论暂时无法连接，请稍后刷新页面重试。';
    status.hidden = false;
  } finally {
    window.clearTimeout(slowTimer);
  }
}

function mountTwikoo(): void {
  document.querySelectorAll<HTMLElement>('[data-twikoo-comments]').forEach((section) => {
    void mountSection(section);
  });
}

document.addEventListener('astro:before-swap', (raw) => {
  controlsObserver?.disconnect();
  controlsObserver = undefined;
  loadingControlTemplates = [];
  adminReturnFocus = null;
  const next = (raw as unknown as { newDocument?: Document }).newDocument;
  const style = document.head.querySelector<HTMLStyleElement>('style[data-twikoo]');
  if (next && style && !next.head.querySelector('style[data-twikoo]')) {
    // Twikoo loads once, so its injected stylesheet must survive later page swaps.
    next.head.append(style.cloneNode(true));
  }
});
document.addEventListener('astro:page-load', mountTwikoo);
document.addEventListener('hatrix:protected-content-ready', mountTwikoo);
mountTwikoo();
