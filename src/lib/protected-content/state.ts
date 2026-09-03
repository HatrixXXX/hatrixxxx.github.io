import { PROTECTED_CONTENT } from '../../config/protected-content';
import type { EncryptedEnvelope } from './crypto';
import { fromBase64 } from './encoding';

const COOLDOWN_STEPS = [0, 0, 5_000, 15_000, 60_000] as const;
const DATABASE_NAME = 'hatrix-protected-content';
const CREDENTIAL_STORE = 'credentials';
const SESSION_REFERENCE = 'hatrix-admin-session';
const REMEMBERED_REFERENCE = 'hatrix-admin-remembered';
const COOLDOWN_STATE = 'hatrix-admin-cooldown';

export interface CredentialReference {
  id: string;
  version: number;
  expiresAt?: number;
}

export interface CredentialRecord {
  id: string;
  version: number;
  key: CryptoKey;
}

export interface FailureState {
  failures: number;
  until: number;
}

export interface ProtectedManifest {
  version: number;
  salt: string;
  argon2: {
    memorySizeKiB: number;
    iterations: number;
    parallelism: number;
  };
  rememberForMs: number;
  routes: string[];
  verifier: EncryptedEnvelope;
}

export type FeedbackKind = 'corrupt' | 'network';

export class ProtectedContentError extends Error {
  constructor(readonly kind: FeedbackKind) {
    super(kind);
  }
}

export function cooldownMs(failures: number): number {
  if (!Number.isFinite(failures) || failures <= 0) return 0;
  const attempt = Math.floor(failures);
  return COOLDOWN_STEPS[attempt - 1] ?? 300_000;
}

export function remainingCooldown(until: number, now = Date.now()): number {
  return Math.max(0, until - now);
}

export function credentialExpired(expiresAt: unknown, now = Date.now()): boolean {
  return typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= now;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseProtectedEnvelope(value: unknown): EncryptedEnvelope {
  if (
    !isRecord(value)
    || value.version !== PROTECTED_CONTENT.formatVersion
    || typeof value.iv !== 'string'
    || typeof value.ciphertext !== 'string'
  ) {
    throw new ProtectedContentError('corrupt');
  }
  try {
    if (fromBase64(value.iv).byteLength !== 12 || fromBase64(value.ciphertext).byteLength < 16) {
      throw new ProtectedContentError('corrupt');
    }
  } catch (error) {
    if (error instanceof ProtectedContentError) throw error;
    throw new ProtectedContentError('corrupt');
  }
  return value as unknown as EncryptedEnvelope;
}

function parseManifest(value: unknown): ProtectedManifest {
  if (!isRecord(value) || !isRecord(value.argon2)) {
    throw new ProtectedContentError('corrupt');
  }
  const manifest = value as Record<string, unknown> & { argon2: Record<string, unknown> };
  if (
    manifest.version !== PROTECTED_CONTENT.formatVersion
    || typeof manifest.salt !== 'string'
    || typeof manifest.rememberForMs !== 'number'
    || !Number.isFinite(manifest.rememberForMs)
    || !Array.isArray(manifest.routes)
    || !manifest.routes.every((route) => typeof route === 'string')
    || typeof manifest.argon2.memorySizeKiB !== 'number'
    || typeof manifest.argon2.iterations !== 'number'
    || typeof manifest.argon2.parallelism !== 'number'
  ) {
    throw new ProtectedContentError('corrupt');
  }
  return {
    version: manifest.version,
    salt: manifest.salt,
    argon2: {
      memorySizeKiB: manifest.argon2.memorySizeKiB,
      iterations: manifest.argon2.iterations,
      parallelism: manifest.argon2.parallelism
    },
    rememberForMs: manifest.rememberForMs,
    routes: manifest.routes,
    verifier: parseProtectedEnvelope(manifest.verifier)
  };
}

export async function loadProtectedManifest(): Promise<ProtectedManifest> {
  let response: Response;
  try {
    response = await fetch('/protected-content/manifest.json', { cache: 'no-store' });
  } catch {
    throw new ProtectedContentError('network');
  }
  if (!response.ok) throw new ProtectedContentError('network');

  try {
    return parseManifest(await response.json());
  } catch (error) {
    if (error instanceof ProtectedContentError) throw error;
    throw new ProtectedContentError('corrupt');
  }
}

export function parseCredentialReference(
  raw: string | null,
  remembered: boolean,
  now = Date.now()
): CredentialReference | null | undefined {
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value)
      || typeof value.id !== 'string'
      || value.id.length === 0
      || typeof value.version !== 'number'
      || !Number.isInteger(value.version)
    ) {
      return null;
    }
    if (remembered && credentialExpired(value.expiresAt, now)) return null;
    if (!remembered && value.expiresAt !== undefined) return null;
    return {
      id: value.id,
      version: value.version,
      ...(remembered ? { expiresAt: value.expiresAt as number } : {})
    };
  } catch {
    return null;
  }
}

export function readCredentialReference(): {
  invalid: boolean;
  reference?: CredentialReference;
} {
  const session = sessionStorage.getItem(SESSION_REFERENCE);
  const sessionReference = parseCredentialReference(session, false);
  if (session !== null) {
    return sessionReference ? { invalid: false, reference: sessionReference } : { invalid: true };
  }

  const remembered = localStorage.getItem(REMEMBERED_REFERENCE);
  const rememberedReference = parseCredentialReference(remembered, true);
  if (remembered !== null) {
    return rememberedReference
      ? { invalid: false, reference: rememberedReference }
      : { invalid: true };
  }
  return { invalid: false };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionFinished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openCredentialDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CREDENTIAL_STORE)) {
        request.result.createObjectStore(CREDENTIAL_STORE, { keyPath: 'id' });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function clearCredentialRecords(): Promise<void> {
  const database = await openCredentialDatabase();
  try {
    const transaction = database.transaction(CREDENTIAL_STORE, 'readwrite');
    transaction.objectStore(CREDENTIAL_STORE).clear();
    await transactionFinished(transaction);
  } finally {
    database.close();
  }
}

export async function loadCredentialRecord(id: string): Promise<CredentialRecord | undefined> {
  const database = await openCredentialDatabase();
  try {
    const transaction = database.transaction(CREDENTIAL_STORE, 'readonly');
    return await requestResult<CredentialRecord | undefined>(
      transaction.objectStore(CREDENTIAL_STORE).get(id)
    );
  } finally {
    database.close();
  }
}

async function putCredentialRecord(record: CredentialRecord): Promise<void> {
  const database = await openCredentialDatabase();
  try {
    const transaction = database.transaction(CREDENTIAL_STORE, 'readwrite');
    transaction.objectStore(CREDENTIAL_STORE).put(record);
    await transactionFinished(transaction);
  } finally {
    database.close();
  }
}

export async function clearCredentialState(): Promise<void> {
  sessionStorage.removeItem(SESSION_REFERENCE);
  localStorage.removeItem(REMEMBERED_REFERENCE);
  try {
    await clearCredentialRecords();
  } catch {
    // References are already gone, so an inaccessible record cannot restore a session.
  }
}

export function validStoredKey(
  record: CredentialRecord | undefined,
  reference: CredentialReference
): record is CredentialRecord {
  return Boolean(
    record
    && record.id === reference.id
    && record.version === reference.version
    && record.key instanceof CryptoKey
    && record.key.type === 'secret'
    && record.key.extractable === false
    && record.key.algorithm.name === 'AES-GCM'
    && record.key.usages.includes('decrypt')
  );
}

export async function persistCredential(
  key: CryptoKey,
  version: number,
  rememberForMs: number,
  remember: boolean
): Promise<void> {
  await clearCredentialState();
  const reference: CredentialReference = {
    id: crypto.randomUUID(),
    version,
    ...(remember ? { expiresAt: Date.now() + rememberForMs } : {})
  };
  await putCredentialRecord({ id: reference.id, version, key });
  try {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(remember ? REMEMBERED_REFERENCE : SESSION_REFERENCE, JSON.stringify(reference));
  } catch (error) {
    await clearCredentialState();
    throw error;
  }
}

export function readFailureState(): FailureState {
  const raw = localStorage.getItem(COOLDOWN_STATE);
  if (!raw) return { failures: 0, until: 0 };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value)
      || typeof value.failures !== 'number'
      || !Number.isInteger(value.failures)
      || value.failures < 0
      || typeof value.until !== 'number'
      || !Number.isFinite(value.until)
    ) {
      throw new Error('invalid cooldown state');
    }
    return { failures: value.failures, until: value.until };
  } catch {
    localStorage.removeItem(COOLDOWN_STATE);
    return { failures: 0, until: 0 };
  }
}

export function recordFailure(now = Date.now()): FailureState {
  const failures = readFailureState().failures + 1;
  const state = { failures, until: now + cooldownMs(failures) };
  localStorage.setItem(COOLDOWN_STATE, JSON.stringify(state));
  return state;
}

export function clearFailureState(): void {
  localStorage.removeItem(COOLDOWN_STATE);
}
