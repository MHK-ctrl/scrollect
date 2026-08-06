import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * AES-256-GCM encryption of Instagram access tokens at rest (spec §2.2:
 * "Tokens stored AES-256-GCM at rest"). Blob format: `v1.<iv b64>.<tag b64>.<cipher b64>`.
 *
 * ENCRYPTION_KEY (hex) comes from env. In MOCK_MODE without a key we derive a
 * deterministic dev-only key and log a warning — mock runs with zero setup, but
 * production (MOCK_MODE=false) requires ENCRYPTION_KEY (enforced in config.ts).
 */
const DEV_ONLY_KEY_MATERIAL = 'scrollect-dev-only-key-material-do-not-use-in-prod';

export class TokenVault {
  private readonly key: Buffer;

  constructor(keyHex: string | undefined, private readonly warn: (msg: string) => void = () => {}) {
    if (keyHex && keyHex.length >= 32) {
      this.key = Buffer.from(keyHex, 'hex');
      if (this.key.length !== 32) this.key = scryptSync(keyHex, 'scrollect', 32);
    } else {
      this.key = scryptSync(DEV_ONLY_KEY_MATERIAL, 'scrollect', 32);
      this.warn('[token-vault] ENCRYPTION_KEY not set — using DEV-ONLY key (MOCK_MODE only; never in production)');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
  }

  decrypt(blob: string): string {
    const [version, ivB64, tagB64, dataB64] = blob.split('.');
    if (version !== 'v1') throw new Error('unsupported token vault version');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }
}
