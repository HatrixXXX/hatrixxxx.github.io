const DESKTOP_QUERY = '(min-width: 1280px)';
const FIXED_TOP_GAP = 8;
const FIXED_BOTTOM_GAP = 8;

let sidebarLayoutFrame: number | undefined;
let sidebarResizeObserver: ResizeObserver | undefined;

function clearFixedSidebar(sidebar: HTMLElement): void {
  delete sidebar.dataset.sidebarFixed;
  sidebar.style.removeProperty('--post-sidebar-fixed-top');
  sidebar.style.removeProperty('--post-sidebar-fixed-left');
  sidebar.style.removeProperty('--post-sidebar-fixed-width');
}

function updatePostSidebarLayout(): void {
  const sidebar = document.querySelector<HTMLElement>('.post-sidebar');
  if (!sidebar) return;

  clearFixedSidebar(sidebar);
  if (!window.matchMedia(DESKTOP_QUERY).matches) return;

  const naturalBounds = sidebar.getBoundingClientRect();
  const headerHeight = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--header-height')
  ) || 56;
  const fixedTop = headerHeight + FIXED_TOP_GAP;
  const availableHeight = window.innerHeight - fixedTop - FIXED_BOTTOM_GAP;
  if (sidebar.scrollHeight > availableHeight) return;

  sidebar.style.setProperty('--post-sidebar-fixed-top', `${fixedTop}px`);
  sidebar.style.setProperty('--post-sidebar-fixed-left', `${naturalBounds.left}px`);
  sidebar.style.setProperty('--post-sidebar-fixed-width', `${naturalBounds.width}px`);
  sidebar.dataset.sidebarFixed = 'true';
}

function schedulePostSidebarLayout(): void {
  if (sidebarLayoutFrame !== undefined) cancelAnimationFrame(sidebarLayoutFrame);
  sidebarLayoutFrame = requestAnimationFrame(() => {
    sidebarLayoutFrame = undefined;
    updatePostSidebarLayout();
  });
}

function initializePostSidebarLayout(): void {
  sidebarResizeObserver?.disconnect();
  sidebarResizeObserver = undefined;

  const sidebar = document.querySelector<HTMLElement>('.post-sidebar');
  if (!sidebar) return;

  updatePostSidebarLayout();
  sidebarResizeObserver = new ResizeObserver(schedulePostSidebarLayout);
  sidebarResizeObserver.observe(sidebar);
}

initializePostSidebarLayout();
document.addEventListener('astro:page-load', initializePostSidebarLayout);
document.addEventListener('hatrix:protected-content-ready', initializePostSidebarLayout);
window.addEventListener('resize', schedulePostSidebarLayout);
