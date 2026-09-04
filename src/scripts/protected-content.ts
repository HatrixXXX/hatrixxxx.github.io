import { PROTECTED_VERIFIER_AAD } from '@/config/protected-content';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  importContentKey,
  type EncryptedEnvelope
} from '@/lib/protected-content/crypto';
import { utf8Decode } from '@/lib/protected-content/encoding';
import {
  clearCredentialState,
  clearFailureState,
  loadProtectedManifest,
  loadCredentialRecord,
  parseProtectedEnvelope,
  persistCredential,
  readCredentialReference,
  readFailureState,
  recordFailure,
  remainingCooldown,
  validStoredKey,
  ProtectedContentError,
  type CredentialRecord,
  type FeedbackKind,
  type ProtectedManifest
} from '@/lib/protected-content/state';

const VERIFIER_TEXT = 'hatrix-protected-content';

const messages = {
  empty: '请输入管理员 key',
  loading: '正在验证…',
  wrong: 'Key 不正确，请重试',
  corrupt: '加密内容无法读取，请稍后再试',
  network: '加密内容加载失败，请检查网络后重试'
} as const;

interface PreparedContent {
  fragment: DocumentFragment;
  urls: string[];
}

class StalePageError extends Error {}

const initializedRoots = new WeakSet<Element>();
const initializedForms = new WeakSet<HTMLFormElement>();
const initializedLogoutButtons = new WeakSet<HTMLButtonElement>();
const blobUrls = new Set<string>();
let cooldownTimer: number | undefined;
let pageGeneration = 0;

async function verifyKey(key: CryptoKey, verifier: EncryptedEnvelope): Promise<void> {
  const value = utf8Decode(await decryptEnvelope(verifier, key, PROTECTED_VERIFIER_AAD));
  if (value !== VERIFIER_TEXT) throw new Error('Invalid protected content verifier');
}

function formParts(form: HTMLFormElement) {
  const key = form.elements.namedItem('key');
  const showKey = form.elements.namedItem('showKey');
  const remember = form.elements.namedItem('remember');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const status = form.querySelector<HTMLElement>('[data-unlock-status]');
  if (
    !(key instanceof HTMLInputElement)
    || !(showKey instanceof HTMLInputElement)
    || !(remember instanceof HTMLInputElement)
    || !submit
    || !status
  ) {
    throw new ProtectedContentError('corrupt');
  }
  return { key, showKey, remember, submit, status };
}

function setFormEnabled(form: HTMLFormElement, enabled: boolean): void {
  const { key, showKey, remember, submit } = formParts(form);
  key.disabled = !enabled;
  showKey.disabled = !enabled;
  remember.disabled = !enabled;
  submit.disabled = !enabled;
}

function setStatus(form: HTMLFormElement, message: string): void {
  formParts(form).status.textContent = message;
}

function clearCooldownTimer(): void {
  if (cooldownTimer !== undefined) window.clearInterval(cooldownTimer);
  cooldownTimer = undefined;
}

function startCooldown(form: HTMLFormElement, until: number): boolean {
  if (remainingCooldown(until) <= 0) return false;
  clearCooldownTimer();
  const update = () => {
    const remaining = remainingCooldown(until);
    if (remaining <= 0) {
      clearCooldownTimer();
      setFormEnabled(form, true);
      setStatus(form, '');
      formParts(form).key.focus();
      return;
    }
    setFormEnabled(form, false);
    setStatus(form, `请等待 ${Math.ceil(remaining / 1_000)} 秒后重试`);
  };
  update();
  cooldownTimer = window.setInterval(update, 250);
  return true;
}

function showFeedback(form: HTMLFormElement, kind: FeedbackKind): void {
  setFormEnabled(form, true);
  setStatus(form, messages[kind]);
  formParts(form).key.focus();
}

function assertCurrentPage(gate: HTMLElement, generation: number): void {
  if (generation !== pageGeneration || !document.contains(gate)) throw new StalePageError();
}

async function decryptProtectedImage(image: HTMLImageElement, key: CryptoKey): Promise<string> {
  const source = image.dataset.protectedSrc;
  const mediaType = image.dataset.protectedType;
  if (!source || !mediaType) throw new ProtectedContentError('corrupt');

  const match = new URL(source, location.href).pathname.match(/\/([^/]+)\.bin$/);
  if (!match) throw new ProtectedContentError('corrupt');

  let response: Response;
  try {
    response = await fetch(source, { cache: 'no-store' });
  } catch {
    throw new ProtectedContentError('network');
  }
  if (!response.ok) throw new ProtectedContentError('network');

  let envelope: EncryptedEnvelope;
  try {
    envelope = parseProtectedEnvelope(JSON.parse(await response.text()));
  } catch (error) {
    if (error instanceof ProtectedContentError) throw error;
    throw new ProtectedContentError('corrupt');
  }

  let bytes: Uint8Array;
  try {
    bytes = await decryptEnvelope(envelope, key, `asset:${match[1]}`);
  } catch {
    throw new ProtectedContentError('corrupt');
  }
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  const url = URL.createObjectURL(new Blob([blobBytes], { type: mediaType }));
  image.src = url;
  delete image.dataset.protectedSrc;
  delete image.dataset.protectedType;
  return url;
}

async function prepareGateContent(
  gate: HTMLElement,
  key: CryptoKey,
  generation: number
): Promise<PreparedContent> {
  const route = gate.dataset.protectedRoute;
  const envelopeNode = gate.querySelector<HTMLElement>('[data-protected-envelope]');
  if (!route || !envelopeNode) throw new ProtectedContentError('corrupt');

  let envelope: EncryptedEnvelope;
  try {
    envelope = parseProtectedEnvelope(JSON.parse(envelopeNode.textContent ?? ''));
  } catch (error) {
    if (error instanceof ProtectedContentError) throw error;
    throw new ProtectedContentError('corrupt');
  }

  let html: string;
  try {
    html = utf8Decode(await decryptEnvelope(envelope, key, `page:${route}`));
  } catch {
    throw new ProtectedContentError('corrupt');
  }
  assertCurrentPage(gate, generation);

  const template = document.createElement('template');
  template.innerHTML = html;
  const urls: string[] = [];
  try {
    for (const image of template.content.querySelectorAll<HTMLImageElement>('img[data-protected-src]')) {
      urls.push(await decryptProtectedImage(image, key));
      assertCurrentPage(gate, generation);
    }
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
  return { fragment: template.content, urls };
}

function mountPreparedContent(gate: HTMLElement, prepared: PreparedContent): void {
  const form = gate.querySelector<HTMLFormElement>('[data-unlock-form]');
  const mount = gate.querySelector<HTMLElement>('[data-protected-mount]');
  if (!form || !mount) {
    prepared.urls.forEach((url) => URL.revokeObjectURL(url));
    throw new ProtectedContentError('corrupt');
  }
  prepared.urls.forEach((url) => blobUrls.add(url));
  mount.replaceChildren(prepared.fragment);
  form.hidden = true;
  gate.dataset.protectedState = 'ready';
  document.dispatchEvent(new CustomEvent('hatrix:protected-content-ready', {
    detail: { route: gate.dataset.protectedRoute }
  }));
}

function revokeBlobUrls(): void {
  blobUrls.forEach((url) => URL.revokeObjectURL(url));
  blobUrls.clear();
}

function showLogout(show: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-logout]').forEach((button) => {
    button.hidden = !show;
  });
}

function restoreGuestForm(gate: HTMLElement | null): void {
  showLogout(false);
  const form = gate?.querySelector<HTMLFormElement>('[data-unlock-form]');
  if (!form) return;
  setStatus(form, '');
  if (!startCooldown(form, readFailureState().until)) {
    setFormEnabled(form, true);
    formParts(form).key.focus();
  }
}

function resetGate(gate: HTMLElement): void {
  const form = gate.querySelector<HTMLFormElement>('[data-unlock-form]');
  const mount = gate.querySelector<HTMLElement>('[data-protected-mount]');
  if (!form || !mount) return;
  mount.replaceChildren();
  form.hidden = false;
  delete gate.dataset.protectedState;
  const { key, showKey } = formParts(form);
  key.value = '';
  key.type = 'password';
  showKey.checked = false;
  setStatus(form, '');
  setFormEnabled(form, true);
  if (!startCooldown(form, readFailureState().until)) key.focus();
}

async function logout(): Promise<void> {
  pageGeneration += 1;
  clearCooldownTimer();
  revokeBlobUrls();
  showLogout(false);
  const gates = document.querySelectorAll<HTMLElement>('[data-protected-gate]');
  if (gates.length === 1) resetGate(gates[0]);
  await clearCredentialState();
}

async function handleSubmit(form: HTMLFormElement, gate: HTMLElement): Promise<void> {
  const generation = pageGeneration;
  const parts = formParts(form);
  if (startCooldown(form, readFailureState().until)) return;
  if (parts.key.value.length === 0) {
    setStatus(form, messages.empty);
    parts.key.focus();
    return;
  }

  const rawKey = parts.key.value;
  const remember = parts.remember.checked;
  setFormEnabled(form, false);
  setStatus(form, messages.loading);

  let manifest: ProtectedManifest;
  try {
    manifest = await loadProtectedManifest();
    assertCurrentPage(gate, generation);
  } catch (error) {
    if (error instanceof StalePageError) return;
    showFeedback(form, error instanceof ProtectedContentError ? error.kind : 'corrupt');
    return;
  }

  let key: CryptoKey;
  try {
    const keyBytes = await deriveContentKeyBytes(rawKey, {
      saltBase64: manifest.salt,
      memorySizeKiB: manifest.argon2.memorySizeKiB,
      iterations: manifest.argon2.iterations,
      parallelism: manifest.argon2.parallelism
    });
    key = await importContentKey(keyBytes, ['decrypt']);
    await verifyKey(key, manifest.verifier);
    assertCurrentPage(gate, generation);
  } catch (error) {
    if (error instanceof StalePageError) return;
    parts.key.value = '';
    const state = recordFailure();
    setStatus(form, messages.wrong);
    if (!startCooldown(form, state.until)) {
      setFormEnabled(form, true);
      parts.key.focus();
    }
    return;
  }

  let prepared: PreparedContent | undefined;
  try {
    prepared = await prepareGateContent(gate, key, generation);
    await persistCredential(
      key,
      manifest.version,
      manifest.rememberForMs,
      remember
    );
    assertCurrentPage(gate, generation);
  } catch (error) {
    if (prepared) resetPreparedContent(prepared);
    if (error instanceof StalePageError) return;
    showFeedback(form, error instanceof ProtectedContentError ? error.kind : 'corrupt');
    return;
  }

  parts.key.value = '';
  clearFailureState();
  mountPreparedContent(gate, prepared);
  showLogout(true);
}

function bindGate(gate: HTMLElement): void {
  const form = gate.querySelector<HTMLFormElement>('[data-unlock-form]');
  if (!form || initializedForms.has(form)) return;
  initializedForms.add(form);
  form.noValidate = true;
  const parts = formParts(form);
  parts.showKey.addEventListener('change', () => {
    parts.key.type = parts.showKey.checked ? 'text' : 'password';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit(form, gate);
  });
  if (!startCooldown(form, readFailureState().until)) parts.key.focus();
}

function bindLogoutButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-logout]').forEach((button) => {
    if (initializedLogoutButtons.has(button)) return;
    initializedLogoutButtons.add(button);
    button.addEventListener('click', () => void logout());
  });
}

function resetPreparedContent(prepared: PreparedContent): void {
  prepared.urls.forEach((url) => URL.revokeObjectURL(url));
}

async function restoreStoredCredential(
  gate: HTMLElement | null,
  generation: number
): Promise<void> {
  const stored = readCredentialReference();
  if (!stored.reference) {
    if (stored.invalid) await clearCredentialState();
    return;
  }

  const form = gate?.querySelector<HTMLFormElement>('[data-unlock-form]');
  if (form) {
    setFormEnabled(form, false);
    setStatus(form, messages.loading);
  }

  let manifest: ProtectedManifest;
  try {
    manifest = await loadProtectedManifest();
  } catch (error) {
    if (error instanceof ProtectedContentError && error.kind === 'corrupt') {
      await clearCredentialState();
      restoreGuestForm(gate);
    }
    if (form) showFeedback(form, error instanceof ProtectedContentError ? error.kind : 'corrupt');
    return;
  }
  if (generation !== pageGeneration || stored.reference.version !== manifest.version) {
    if (generation === pageGeneration) {
      await clearCredentialState();
      restoreGuestForm(gate);
    }
    return;
  }

  let record: CredentialRecord | undefined;
  try {
    record = await loadCredentialRecord(stored.reference.id);
  } catch {
    await clearCredentialState();
    restoreGuestForm(gate);
    return;
  }
  if (!validStoredKey(record, stored.reference)) {
    await clearCredentialState();
    restoreGuestForm(gate);
    return;
  }

  try {
    await verifyKey(record.key, manifest.verifier);
  } catch {
    await clearCredentialState();
    restoreGuestForm(gate);
    return;
  }
  if (generation !== pageGeneration) return;
  showLogout(true);
  if (!gate) return;

  let prepared: PreparedContent;
  try {
    prepared = await prepareGateContent(gate, record.key, generation);
  } catch (error) {
    if (error instanceof StalePageError) return;
    if (error instanceof ProtectedContentError && error.kind === 'corrupt') {
      await clearCredentialState();
      showLogout(false);
    }
    if (form) showFeedback(form, error instanceof ProtectedContentError ? error.kind : 'corrupt');
    return;
  }

  clearFailureState();
  mountPreparedContent(gate, prepared);
}

function failClosedMultipleGates(gates: NodeListOf<HTMLElement>): void {
  pageGeneration += 1;
  clearCooldownTimer();
  revokeBlobUrls();
  showLogout(false);
  gates.forEach((gate) => {
    gate.querySelector<HTMLElement>('[data-protected-mount]')?.replaceChildren();
    const form = gate.querySelector<HTMLFormElement>('[data-unlock-form]');
    if (!form) return;
    form.hidden = false;
    form.noValidate = true;
    if (!initializedForms.has(form)) {
      initializedForms.add(form);
      form.addEventListener('submit', (event) => event.preventDefault());
    }
    setFormEnabled(form, false);
    setStatus(form, messages.corrupt);
  });
}

function initializeProtectedContent(): void {
  bindLogoutButtons();
  const gates = document.querySelectorAll<HTMLElement>('[data-protected-gate]');
  if (gates.length > 1) {
    failClosedMultipleGates(gates);
    return;
  }
  const gate = gates[0] ?? null;
  if (gate) bindGate(gate);
  const root = gate ?? document.querySelector<HTMLButtonElement>('[data-admin-logout]');
  if (!root || initializedRoots.has(root)) return;
  initializedRoots.add(root);
  void restoreStoredCredential(gate, pageGeneration);
}

document.addEventListener('astro:before-swap', () => {
  pageGeneration += 1;
  clearCooldownTimer();
  revokeBlobUrls();
});
document.addEventListener('astro:page-load', initializeProtectedContent);
initializeProtectedContent();
