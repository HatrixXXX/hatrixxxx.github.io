import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64, base64url, fromBase64, fromBase64url, utf8, utf8Decode } from '../../src/lib/protected-content/encoding';
import {
  decryptEnvelope,
  deriveContentKeyBytes,
  encryptEnvelope,
  importContentKey
} from '../../src/lib/protected-content/crypto';

vi.mock('astro:env/server', () => ({
  getSecret: (name: string) => process.env[name]
}));

import { adminKeyFromEnvironment } from '../../src/lib/protected-content/server';

const previousAdminKey = process.env.HATRIX_ADMIN_KEY;

afterEach(() => {
  if (previousAdminKey === undefined) {
    delete process.env.HATRIX_ADMIN_KEY;
  } else {
    process.env.HATRIX_ADMIN_KEY = previousAdminKey;
  }
});

describe('protected content cryptography', () => {
  it('encodes binary data and UTF-8 without Node-only APIs', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 254, 255]);

    expect(base64(bytes)).toBe('AAECA/7/');
    expect(fromBase64('AAECA/7/')).toEqual(bytes);
    expect(base64url(bytes)).toBe('AAECA_7_');
    expect(fromBase64url('AAECA_7_')).toEqual(bytes);
    expect(utf8Decode(utf8('私密 body'))).toBe('私密 body');
  });

  it('derives the same 256-bit key from a fixed key and salt', async () => {
    const first = await deriveContentKeyBytes('remembered-key');
    const second = await deriveContentKeyBytes('remembered-key');

    expect(first).toEqual(second);
    expect(first).toHaveLength(32);
  });

  it('authenticates ciphertext with the key and route', async () => {
    const bytes = await deriveContentKeyBytes('remembered-key');
    const cryptoKey = await importContentKey(bytes, ['encrypt', 'decrypt']);
    const envelope = await encryptEnvelope(
      utf8('private body'),
      cryptoKey,
      'page:/posts/private/',
      new Uint8Array(12).fill(7)
    );

    expect(envelope).toEqual({
      version: 1,
      iv: 'BwcHBwcHBwcHBwcH',
      ciphertext: expect.any(String)
    });
    await expect(decryptEnvelope(envelope, cryptoKey, 'page:/posts/private/')).resolves.toEqual(
      utf8('private body')
    );
    await expect(decryptEnvelope(envelope, cryptoKey, 'page:/posts/other/')).rejects.toMatchObject({
      name: 'OperationError'
    });

    const wrongBytes = await deriveContentKeyBytes('other-key');
    const wrongKey = await importContentKey(wrongBytes, ['decrypt']);
    await expect(decryptEnvelope(envelope, wrongKey, 'page:/posts/private/')).rejects.toMatchObject({
      name: 'OperationError'
    });
  });

  it('requires an eight-character environment key without exposing it', () => {
    process.env.HATRIX_ADMIN_KEY = 'short';

    expect(() => adminKeyFromEnvironment()).toThrow(/at least 8 characters/i);
    try {
      adminKeyFromEnvironment();
    } catch (error) {
      expect((error as Error).message).not.toContain('short');
    }

    process.env.HATRIX_ADMIN_KEY = 'test-key';
    expect(adminKeyFromEnvironment()).toBe('test-key');
  });
});
