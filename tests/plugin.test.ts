// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
vi.mock('node:timers', () => ({ setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args), clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id) }));

vi.mock('obsidian', () => {
  class Plugin {
    app: any; events: any[] = []; constructor(app: any) { this.app = app; }
    addStatusBarItem() { return document.createElement('div'); }
    addSettingTab() {} addCommand() {} registerMarkdownPostProcessor() {}
    registerEvent(e: any) { this.events.push(e); }
  }
  class MarkdownView {
    containerEl: HTMLElement; file = { path: 'example.md' }; mode = 'preview';
    constructor(el: HTMLElement) { this.containerEl = el; } getMode() { return this.mode; }
  }
  return { Plugin, MarkdownView, PluginSettingTab: class {}, Setting: class {}, Notice: class {}, MarkdownRenderChild: class {}, requestUrl: vi.fn() };
});
import Assistant from '../src/legacy-main';
import { MarkdownView, requestUrl } from 'obsidian';

const base = resolve('tests/artifacts', 'run-' + Date.now());
let oldAppData: string | undefined; let assistant: Assistant;
beforeEach(() => { vi.useFakeTimers(); oldAppData = process.env.APPDATA; process.env.APPDATA = join(base, 'app-data'); });
afterEach(() => { assistant?.onunload(); document.body.replaceChildren(); if (oldAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = oldAppData; vi.useRealTimers(); });
const hash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');

test('settings pop-out opening without workspace events is discovered, reopening works, hooks restore', async () => {
  let frame: HTMLIFrameElement;
  const setting: any = { activeTab: { id: 'fixture' }, containerEl: document.createElement('div'),
    open() {
      frame = document.createElement('iframe'); document.body.append(frame);
      const doc = frame.contentDocument!; doc.body.innerHTML = '<div class="modal mod-settings"><div class="vertical-tab-content"><button>Save</button></div></div>';
      this.modalEl = doc.querySelector('.modal'); this.activeTab.containerEl = doc.querySelector('.vertical-tab-content');
    },
    close() {
      // The old realm can remain connected while Electron closes its window.
      expect(this.modalEl.textContent).toBe('Save');
      expect((assistant as any).documents.has(frame.contentDocument)).toBe(false);
      frame.style.display = 'none';
    }
  };
  const originalOpen = setting.open; const originalClose = setting.close;
  const app: any = { setting, vault: { adapter: { getBasePath: () => 'popout-only-fixture' }, getName: () => 'fixture' }, workspace: {
    on: () => ({}), onLayoutReady: (f: (...args: any[]) => any) => f(), iterateAllLeaves: () => {}, getLeavesOfType: () => []
  } };
  assistant = new Assistant(app, {} as any); await assistant.onload();
  for (let n = 0; n < 2; n++) {
    setting.open(); await vi.advanceTimersByTimeAsync(250);
    expect(setting.activeTab.containerEl.textContent).toBe('保存'); setting.close(); await vi.advanceTimersByTimeAsync(150);
    expect((assistant as any).ui.size).toBe(0);
    expect((assistant as any).documents.size).toBe(1);
  }
  assistant.onunload(); expect(setting.open).toBe(originalOpen); expect(setting.close).toBe(originalClose);
});

test('plugin lifecycle: translate, switch notes, restore, unload; files unchanged and key never stored', async () => {
  const vault = join(base, 'vault'); const pluginDir = join(vault, '.obsidian', 'plugins', 'other-plugin');
  await mkdir(pluginDir, { recursive: true });
  const note = join(vault, 'example.md'); const other = join(pluginDir, 'main.js');
  await writeFile(note, 'An English paragraph.\n'); await writeFile(other, 'const label = "Save";\n');
  const before = await Promise.all([hash(note), hash(other)]);
  const forbiddenWrite = vi.fn(() => { throw new Error('Forbidden vault write'); });
  document.body.innerHTML = '<div class="modal mod-settings"><button>Save</button><input value="user-value"></div><div id="view"><div class="markdown-preview-view"><p>An English paragraph.</p></div></div>';
  const view = new (MarkdownView as any)(document.querySelector('#view')) as MarkdownView;
  const listeners = new Map<string, ((...args: any[]) => any)[]>();
  const app = {
    setting: { activeTab: { id: 'other-plugin' } },
    vault: { getName: () => 'fixture', adapter: { getBasePath: () => vault, write: forbiddenWrite, remove: forbiddenWrite, rename: forbiddenWrite }, modify: forbiddenWrite, create: forbiddenWrite, delete: forbiddenWrite },
    workspace: {
      on: (name: string, callback: (...args: any[]) => any) => { listeners.set(name, [...(listeners.get(name) || []), callback]); return {}; },
      onLayoutReady: (f: (...args: any[]) => any) => f(), iterateAllLeaves: (f: (...args: any[]) => any) => f({ view }),
      getLeavesOfType: () => [{ view }], getActiveViewOfType: () => view
    }
  };
  vi.mocked(requestUrl).mockImplementation((async (req: any) => {
    const body = JSON.parse(req.body); const inputs = JSON.parse(body.messages[1].content);
    return { status: 200, json: { choices: [{ message: { content: JSON.stringify(Object.fromEntries(inputs.map((x: any) => [x.id, '这是英文段落的中文译文。']))) } }] } } as any;
  }) as unknown as typeof requestUrl);
  assistant = new Assistant(app as any, {} as any); await assistant.onload();
  await vi.advanceTimersByTimeAsync(150); expect(document.querySelector('button')!.textContent).toBe('保存');
  await assistant.applySettings({ ...assistant.settings, online: true, endpoint: 'https://example.invalid/v1/chat/completions', model: 'fixture', apiKey: 'TEST-SECRET-NOT-FOR-DISK' });
  assistant.startReading(); await vi.advanceTimersByTimeAsync(150);
  expect(document.querySelector('[data-ba-output]')!.textContent).toBe('这是英文段落的中文译文。');
  (view as any).file = { path: 'another.md' }; listeners.get('file-open')!.forEach(f => f()); await vi.advanceTimersByTimeAsync(150);
  expect(document.querySelector('[data-ba-output]')).toBeNull();
  assistant.startReading(); await vi.advanceTimersByTimeAsync(150); assistant.restoreReading();
  expect(document.querySelector('[data-ba-output]')).toBeNull();
  assistant.onunload(); expect(document.querySelector('button')!.textContent).toBe('Save'); expect(document.querySelector('input')!.value).toBe('user-value');
  expect(await Promise.all([hash(note), hash(other)])).toEqual(before); expect(forbiddenWrite).not.toHaveBeenCalled();
  const settings = await readFile(join(assistant.store.directory, 'settings.json'), 'utf8');
  expect(settings).not.toContain('TEST-SECRET'); expect(settings).not.toContain('apiKey'); expect(settings).not.toContain('An English paragraph');
  expect(await readdir(pluginDir)).toEqual(['main.js']);
});
