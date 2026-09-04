import { argon2id } from 'hash-wasm';
import { PROTECTED_CONTENT } from '../../config/protected-content';
import { base64, fromBase64, utf8 } from './encoding';

export interface KdfConfig {
  saltBase64: string;
  memorySizeKiB: number;
  iterations: number;
  parallelism: number;
}

export interface EncryptedEnvelope {
  version: number;
  iv: string;
  ciphertext: string;
}

const defaultKdfConfig: KdfConfig = {
  saltBase64: PROTECTED_CONTENT.saltBase64,
  memorySizeKiB: PROTECTED_CONTENT.argon2.memorySizeKiB,
  iterations: PROTECTED_CONTENT.argon2.iterations,
  parallelism: PROTECTED_CONTENT.argon2.parallelism
};

const contentKeyLength = 32;

export async function deriveContentKeyBytes(
  key: string,
  config: KdfConfig = defaultKdfConfig
): Promise<Uint8Array> {
  return argon2id({
    password: key,
    salt: fromBase64(config.saltBase64),
    memorySize: Math.max(config.memorySizeKiB, PROTECTED_CONTENT.argon2.memorySizeKiB),
    iterations: Math.max(config.iterations, PROTECTED_CONTENT.argon2.iterations),
    parallelism: Math.max(config.parallelism, PROTECTED_CONTENT.argon2.parallelism),
    hashLength: contentKeyLength,
    outputType: 'binary'
  });
}

export function importContentKey(bytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new Uint8Array(bytes), 'AES-GCM', false, usages);
}

export async function encryptEnvelope(
  plaintext: Uint8Array,
  key: CryptoKey,
  aad: string,
  iv: Uint8Array = crypto.getRandomValues(new Uint8Array(12))
): Promise<EncryptedEnvelope> {
  const nonce = new Uint8Array(iv);

  if (nonce.byteLength !== 12) {
    throw new Error('AES-GCM IV must be 12 bytes');
  }

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: new Uint8Array(utf8(aad)) },
    key,
    new Uint8Array(plaintext)
  );

  return {
    version: PROTECTED_CONTENT.formatVersion,
    iv: base64(nonce),
    ciphertext: base64(new Uint8Array(ciphertext))
  };
}

export async function decryptEnvelope(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
  aad: string
): Promise<Uint8Array> {
  if (envelope.version !== PROTECTED_CONTENT.formatVersion) {
    throw new Error('Unsupported protected content format');
  }

  const iv = new Uint8Array(fromBase64(envelope.iv));
  const ciphertext = new Uint8Array(fromBase64(envelope.ciphertext));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: new Uint8Array(utf8(aad)) },
    key,
    ciphertext
  );

  return new Uint8Array(plaintext);
}
