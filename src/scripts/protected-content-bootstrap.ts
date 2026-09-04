const SESSION_REFERENCE = 'hatrix-admin-session';
const REMEMBERED_REFERENCE = 'hatrix-admin-remembered';

let runtime: Promise<unknown> | undefined;
let failedPath: string | undefined;

function currentPath(): string {
  return `${location.pathname}${location.search}`;
}

function validLookingReference(raw: string | null, remembered: boolean): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== 'object'
      || value === null
      || typeof (value as Record<string, unknown>).id !== 'string'
      || (value as Record<string, unknown>).id === ''
      || !Number.isInteger((value as Record<string, unknown>).version)
    ) {
      return false;
    }
    const expiresAt = (value as Record<string, unknown>).expiresAt;
    return remembered
      ? typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > Date.now()
      : expiresAt === undefined;
  } catch {
    return false;
  }
}

function hasStoredCredentialReference(): boolean {
  try {
    return validLookingReference(sessionStorage.getItem(SESSION_REFERENCE), false)
      || validLookingReference(localStorage.getItem(REMEMBERED_REFERENCE), true);
  } catch {
    return false;
  }
}

function failClosedGate(): void {
  document.querySelectorAll<HTMLElement>('[data-protected-gate]').forEach((gate) => {
    gate.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
      control.disabled = true;
    });
    const status = gate.querySelector<HTMLElement>('[data-unlock-status]');
    if (status) status.textContent = '加密内容加载失败，请检查网络后重试';
  });
}

function loadProtectedRuntime(): void {
  if (!document.querySelector('[data-protected-gate]') && !hasStoredCredentialReference()) return;
  if (failedPath !== undefined) {
    if (currentPath() !== failedPath) location.reload();
    return;
  }
  const requestedPath = currentPath();
  runtime ??= import('@/scripts/protected-content').catch((error: unknown) => {
    runtime = undefined;
    failedPath = requestedPath;
    failClosedGate();
    console.error('Unable to load protected content runtime', error);
  });
}

document.addEventListener('astro:page-load', loadProtectedRuntime);
loadProtectedRuntime();
