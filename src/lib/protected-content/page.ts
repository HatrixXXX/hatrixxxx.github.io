import { normalizeRoutePath } from '../../config/protected-content';
import { encryptEnvelope, importContentKey, type EncryptedEnvelope } from './crypto';
import { utf8 } from './encoding';

export async function encryptProtectedPageHtml(
  html: string,
  route: string,
  keyBytes: Uint8Array
): Promise<EncryptedEnvelope> {
  const key = await importContentKey(keyBytes, ['encrypt']);
  return encryptEnvelope(utf8(html), key, `page:${normalizeRoutePath(route)}`);
}
