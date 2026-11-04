import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1';

function encryptionKey() {
  const secret =
    process.env.ESPN_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('ESPN credential encryption is not configured');
  return createHash('sha256').update(secret).digest();
}

export function isEncryptedCredential(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}

export function encryptCredential(value: string | null | undefined) {
  if (!value || isEncryptedCredential(value)) return value || null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

export function decryptCredential(value: string | null | undefined) {
  if (!value) return undefined;
  if (!isEncryptedCredential(value)) return value;
  const [, , iv, tag, encrypted] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function withoutESPNCredentials<T extends { espnS2?: unknown; swid?: unknown }>(team: T) {
  const { espnS2: _espnS2, swid: _swid, ...safeTeam } = team;
  void _espnS2;
  void _swid;
  return safeTeam;
}
