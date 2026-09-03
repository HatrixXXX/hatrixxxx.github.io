import { describe, expect, it } from 'vitest';
import {
  cooldownMs,
  credentialExpired,
  parseCredentialReference,
  remainingCooldown
} from '../../src/lib/protected-content/state';

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
});
