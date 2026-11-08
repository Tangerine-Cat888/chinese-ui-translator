import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

export interface SecretCipher { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
function systemCipher(): SecretCipher {
  // Lazy desktop import: loading saved plaintext settings must not require Electron in tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cipher = require('@electron/remote').safeStorage as SecretCipher;
  if (!cipher?.isEncryptionAvailable()) throw new Error('系统加密不可用，未保存密钥；可关闭“记住 API Key”使用会话模式');
  return cipher;
}
/** Desktop-only; settings and OS-encrypted secrets stay outside every vault. */
export class SettingsStore {
  readonly directory: string;
  private pending = Promise.resolve();
  constructor(vaultIdentity: string, base = process.env.APPDATA || join(homedir(), '.config'), private cipher = systemCipher) {
    this.directory = join(base, 'ObsidianBilingualAssistant', createHash('sha256').update(vaultIdentity).digest('hex').slice(0, 20));
  }
  async load(): Promise<Record<string, unknown>> {
    try {
      const data = JSON.parse(await readFile(join(this.directory, 'settings.json'), 'utf8')) as Record<string, unknown>;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      const { encryptedApiKey, apiKey: _ignoredPlaintext, ...settings } = data;
      if (settings.rememberApiKey === true && typeof encryptedApiKey === 'string') {
        settings.apiKey = this.cipher().decryptString(Buffer.from(encryptedApiKey, 'base64'));
      }
      return settings;
    }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw new Error('配置读取失败，原文件保留；请检查配置目录'); }
  }
  save(settings: Record<string, unknown>) {
    const { apiKey, encryptedApiKey: _ignored, ...safe } = settings;
    if (safe.rememberApiKey === true && typeof apiKey === 'string' && apiKey) {
      const cipher = this.cipher();
      if (!cipher.isEncryptionAvailable()) throw new Error('系统加密不可用，未保存密钥');
      safe.encryptedApiKey = cipher.encryptString(apiKey).toString('base64');
    }
    const data = JSON.stringify(safe, null, 2);
    this.pending = this.pending.catch(() => {}).then(async () => { await mkdir(this.directory, { recursive: true }); await writeFile(join(this.directory, 'settings.json'), data, { encoding: 'utf8', mode: 0o600 }); });
    return this.pending;
  }
}
