import { Platform, type DataAdapter } from 'obsidian';
import { sha256Hex } from './hash';

export interface TranslationFiles {
  read(name: string): Promise<string | undefined>;
  write(name: string, data: string): Promise<void>;
}

function desktopRuntime() {
  if (!Platform.isDesktopApp) throw new Error('桌面存储在此设备不可用');
  if (Platform.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after the desktop check.
    const fs = require('node:fs/promises') as typeof import('node:fs/promises');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after the desktop check.
    const paths = require('node:path') as typeof import('node:path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after the desktop check.
    const os = require('node:os') as typeof import('node:os');
    return {fs, paths, os};
  }
  throw new Error('移动界面请使用 Obsidian 文件接口');
}

export function desktopTranslationFiles(directory: string): TranslationFiles {
  const {fs, paths} = desktopRuntime();
  return {
    async read(name) {
      try { return await fs.readFile(paths.join(directory, name), 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    },
    async write(name, data) {
      const path = paths.join(directory, name);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path + '.pending', data, 'utf8');
      await fs.rename(path + '.pending', path);
    },
  };
}

export function mobileTranslationFiles(adapter: DataAdapter, directory: string): TranslationFiles {
  return {
    async read(name) {
      const path = directory + '/' + name;
      if (await adapter.exists(path)) return adapter.read(path);
    },
    async write(name, data) {
      const path = directory + '/' + name;
      if (await adapter.exists(path)) await adapter.process(path, () => data);
      else await adapter.write(path, data);
    },
  };
}

export interface SecretCipher { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
function systemCipher(): SecretCipher {
  if (!Platform.isDesktopApp) throw new Error('旧版密钥只能在桌面端迁移');
  // Lazy desktop import: loading saved plaintext settings must not require Electron in tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Electron is available only inside the desktop host; load its cipher only for legacy encrypted settings.
  const cipher = (require('@electron/remote') as {safeStorage: SecretCipher}).safeStorage;
  if (!cipher?.isEncryptionAvailable()) throw new Error('系统加密不可用，未保存密钥；可关闭“记住 API Key”使用会话模式');
  return cipher;
}
/** Desktop-only; settings and OS-encrypted secrets stay outside every vault. */
export class SettingsStore {
  readonly directory: string;
  private pending = Promise.resolve();
  private runtime = desktopRuntime();
  constructor(vaultIdentity: string, base?: string, private cipher = systemCipher) {
    const {paths, os} = this.runtime;
    const config = base ?? (process.env.APPDATA || paths.join(os.homedir(), '.config'));
    this.directory = paths.join(config, 'ObsidianBilingualAssistant', sha256Hex(vaultIdentity).slice(0, 20));
  }
  async load(): Promise<Record<string, unknown>> {
    const {fs, paths} = this.runtime;
    try {
      const data = JSON.parse(await fs.readFile(paths.join(this.directory, 'settings.json'), 'utf8')) as Record<string, unknown>;
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
    const {fs, paths} = this.runtime;
    const { apiKey, encryptedApiKey: _ignored, ...safe } = settings;
    if (safe.rememberApiKey === true && typeof apiKey === 'string' && apiKey) {
      const cipher = this.cipher();
      if (!cipher.isEncryptionAvailable()) throw new Error('系统加密不可用，未保存密钥');
      safe.encryptedApiKey = cipher.encryptString(apiKey).toString('base64');
    }
    const data = JSON.stringify(safe, null, 2);
    this.pending = this.pending.catch(() => {}).then(async () => { await fs.mkdir(this.directory, { recursive: true }); await fs.writeFile(paths.join(this.directory, 'settings.json'), data, { encoding: 'utf8', mode: 0o600 }); });
    return this.pending;
  }
}
