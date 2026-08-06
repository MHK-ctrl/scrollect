import { describe, it, expect, vi } from 'vitest';
import { TokenVault } from '../src/lib/tokenVault';

const KEY = 'ab'.repeat(32); // 32 bytes hex

describe('TokenVault', () => {
  it('round-trips encrypted tokens', () => {
    const vault = new TokenVault(KEY);
    const blob = vault.encrypt('EAA-long-lived-token');
    expect(blob).not.toContain('EAA');
    expect(vault.decrypt(blob)).toBe('EAA-long-lived-token');
  });

  it('uses a fresh IV per encryption', () => {
    const vault = new TokenVault(KEY);
    expect(vault.encrypt('same')).not.toBe(vault.encrypt('same'));
  });

  it('rejects tampered blobs', () => {
    const vault = new TokenVault(KEY);
    const blob = vault.encrypt('secret-token');
    const parts = blob.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => vault.decrypt(parts.join('.'))).toThrow();
  });

  it('rejects malformed blobs', () => {
    const vault = new TokenVault(KEY);
    expect(() => vault.decrypt('not-a-blob')).toThrow();
  });

  it('derives a dev key and warns when no key is provided (mock mode)', () => {
    const warn = vi.fn();
    const vault = new TokenVault(undefined, warn);
    expect(warn).toHaveBeenCalled();
    expect(vault.decrypt(vault.encrypt('dev-token'))).toBe('dev-token');
  });

  it('derives a stable key from short secrets via scrypt', () => {
    const a = new TokenVault('short-secret');
    const b = new TokenVault('short-secret');
    const blobA = a.encrypt('x');
    expect(b.decrypt(blobA)).toBe('x');
  });
});
