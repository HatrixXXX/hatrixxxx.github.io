import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTECTED_CONTENT } from '../../src/config/protected-content';
import {
  cooldownMs,
  credentialExpired,
  loadProtectedManifest,
  parseCredentialReference,
  remainingCooldown
} from '../../src/lib/protected-content/state';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('protected content browser state', () => {
  it('uses the fixed failure cooldown sequence', () => {
    expect([1, 2, 3, 4, 5, 6].map(cooldownMs)).toEqual([
      0,
      0,
      5_000,
      15_000,
      60_000,
      300_000
    ]);
    expect(cooldownMs(7)).toBe(300_000);
  });

  it('clamps elapsed cooldowns to zero', () => {
    expect(remainingCooldown(15_000, 10_000)).toBe(5_000);
    expect(remainingCooldown(10_000, 10_000)).toBe(0);
    expect(remainingCooldown(9_999, 10_000)).toBe(0);
  });

  it('expires remembered credentials at the exact seven-day boundary', () => {
    const now = 1_000_000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(credentialExpired(now + sevenDays, now)).toBe(false);
    expect(credentialExpired(now, now)).toBe(true);
    expect(credentialExpired(now - 1, now)).toBe(true);
  });

  it('treats missing and legacy string expiry values as expired', () => {
    expect(credentialExpired(undefined, 1_000)).toBe(true);
    expect(credentialExpired('1001', 1_000)).toBe(true);
    expect(credentialExpired(Number.POSITIVE_INFINITY, 1_000)).toBe(true);
  });

  it('rejects legacy credential references without the current versioned shape', () => {
    expect(parseCredentialReference(null, false, 1_000)).toBeUndefined();
    expect(parseCredentialReference(JSON.stringify('legacy-id'), false, 1_000)).toBeNull();
    expect(parseCredentialReference(JSON.stringify({ id: 'legacy-id' }), false, 1_000)).toBeNull();
    expect(parseCredentialReference(
      JSON.stringify({ id: 'current-id', version: 1 }),
      false,
      1_000
    )).toEqual({ id: 'current-id', version: 1 });
    expect(parseCredentialReference(
      JSON.stringify({ id: 'expired-id', version: 1, expiresAt: 1_000 }),
      true,
      1_000
    )).toBeNull();
  });

  it.each([
    ['salt', 'salt', 'AAAAAAAAAAAAAAAAAAAAAA=='],
    ['below-floor memory', 'memorySizeKiB', PROTECTED_CONTENT.argon2.memorySizeKiB - 1],
    ['absurd memory', 'memorySizeKiB', Number.MAX_SAFE_INTEGER],
    ['fractional memory', 'memorySizeKiB', PROTECTED_CONTENT.argon2.memorySizeKiB + 0.5],
    ['below-floor iterations', 'iterations', PROTECTED_CONTENT.argon2.iterations - 1],
    ['absurd iterations', 'iterations', 1_000_000_000],
    ['malformed iterations', 'iterations', String(PROTECTED_CONTENT.argon2.iterations)],
    ['below-floor parallelism', 'parallelism', PROTECTED_CONTENT.argon2.parallelism - 1],
    ['absurd parallelism', 'parallelism', 1_024],
    ['fractional parallelism', 'parallelism', PROTECTED_CONTENT.argon2.parallelism + 0.5],
    ['tampered hash length', 'hashLength', PROTECTED_CONTENT.argon2.hashLength + 1],
    ['tampered remember duration', 'rememberForMs', PROTECTED_CONTENT.rememberForMs + 1]
  ])('rejects %s before returning a manifest to the protected runtime', async (_label, field, value) => {
    const manifest = {
      version: PROTECTED_CONTENT.formatVersion,
      salt: String(PROTECTED_CONTENT.saltBase64),
      argon2: { ...PROTECTED_CONTENT.argon2 },
      rememberForMs: PROTECTED_CONTENT.rememberForMs,
      routes: ['/protected/'],
      verifier: {
        version: PROTECTED_CONTENT.formatVersion,
        iv: 'AAAAAAAAAAAAAAAA',
        ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA=='
      }
    };
    if (field === 'salt') manifest.salt = value as string;
    else if (field === 'rememberForMs') manifest.rememberForMs = value as number;
    else (manifest.argon2 as Record<string, unknown>)[field] = value;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest))));

    await expect(loadProtectedManifest()).rejects.toMatchObject({ kind: 'corrupt' });
  });
});
