import { Plugin, PluginSettingTab, Setting, Notice, MarkdownView, MarkdownRenderChild, requestUrl } from 'obsidian';
import { Engine, abortError, type Config, type Transport } from './core';
import { DomSession } from './dom';
import { SettingsStore } from './storage';
import type { Clock } from './clock';
import { setTimeout as backgroundTimeout, clearTimeout as backgroundClear } from 'node:timers';

interface Settings extends Config { uiEnabled: boolean; excludedPlugins: string; rememberApiKey: boolean }
const defaults: Settings = { endpoint: '', model: '', language: '简体中文', apiKey: '', online: false, glossary: {}, uiEnabled: true, excludedPlugins: '', rememberApiKey: false };
type UiRecord = { context: string; session: DomSession };
type ReadingRecord = { path: string; root: HTMLElement; session: DomSession };

export default class BilingualAssistant extends Plugin {
  settings: Settings = { ...defaults, glossary: {} };
  store!: SettingsStore;
  engine!: Engine;
  private documents = new Map<Document, MutationObserver>();
  private ui = new Map<HTMLElement, UiRecord>();
  private reading = new Map<MarkdownView, ReadingRecord>();
  private refreshTimer?: () => void;
  // Desktop Node timers survive pop-out closing and aren't throttled when the
  // main renderer is hidden behind the settings window. Still explicitly canceled.
  private clock: Clock = { set(callback, delay) { const timer = backgroundTimeout(callback, delay); return () => backgroundClear(timer); } };
  private stopped = false;
  private status!: HTMLElement;
  private lastError = '';
  private restoreSettingsHooks: (() => void)[] = [];
  private settingsClosed = false;

  async onload() {
    const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    this.store = new SettingsStore(adapter.getBasePath?.() || this.app.vault.getName());
    try {
      const saved = await this.store.load();
      for (const key of ['endpoint', 'model', 'language', 'excludedPlugins', 'apiKey'] as const) if (typeof saved[key] === 'string') this.settings[key] = saved[key];
      for (const key of ['online', 'uiEnabled', 'rememberApiKey'] as const) if (typeof saved[key] === 'boolean') this.settings[key] = saved[key];
      if (saved.glossary && typeof saved.glossary === 'object' && !Array.isArray(saved.glossary)) this.settings.glossary = Object.fromEntries(Object.entries(saved.glossary).filter(([, v]) => typeof v === 'string'));
    } catch (e) { new Notice((e as Error).message); }
    this.engine = new Engine(this.settings, this.transport(this.settings), this.clock);
    this.watchSettingsLifecycle();
    this.status = this.addStatusBarItem(); this.updateStatus();
    this.status.onclick = () => this.toggleReading();
    this.addSettingTab(new AssistantSettings(this));
    this.addCommand({ id: 'translate-reading', name: '翻译当前笔记（阅读模式）', callback: () => this.startReading() });
    this.addCommand({ id: 'restore-reading', name: '恢复当前笔记原文', callback: () => this.restoreReading() });
    this.addCommand({ id: 'toggle-ui', name: '暂停／恢复设置界面汉化', callback: () => { void this.applySettings({ ...this.settings, uiEnabled: !this.settings.uiEnabled }); } });
    this.addCommand({ id: 'restore-all', name: '恢复所有原文并暂停汉化', callback: () => { void this.applySettings({ ...this.settings, uiEnabled: false }); } });
    this.addCommand({ id: 'retry-ui', name: '重新翻译设置界面', callback: () => { this.stopUi(); this.refresh(); } });
    this.registerMarkdownPostProcessor((el, ctx) => {
      const child = new MarkdownRenderChild(el);
      child.register(() => this.scheduleRefresh()); ctx.addChild(child); this.scheduleRefresh();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('window-open', (_leaf, win) => { this.watchDocument(win.document); this.scheduleRefresh(); }));
    this.registerEvent(this.app.workspace.on('window-close', (_leaf, win) => { this.documents.get(win.document)?.disconnect(); this.documents.delete(win.document); this.scheduleRefresh(); }));
    // Anchor the main window; popout documents are tracked separately.
    // eslint-disable-next-line obsidianmd/prefer-active-doc
    this.app.workspace.onLayoutReady(() => { if (!this.stopped) { this.watchDocument(document); this.refresh(); } });
  }
  private transport(config: Config): Transport {
    return async (body, signal) => {
      if (signal.aborted) throw abortError();
      const endpoint = new URL(config.endpoint);
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('请输入有效的 HTTP(S) API 地址');
      // requestUrl has no abort signal: invalidate the consumer immediately, ignore late responses.
      const request = requestUrl({ url: endpoint.href, method: 'POST', contentType: 'application/json', headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}, body: JSON.stringify(body), throw: false });
      return await new Promise((resolve, reject) => {
        const cancel = () => reject(abortError()); signal.addEventListener('abort', cancel, { once: true });
        request.then(result => {
          if (signal.aborted) return;
          if (result.status >= 400) { const e = Object.assign(new Error(`翻译服务返回 HTTP ${result.status}`), { status: result.status }); reject(e); }
          else { try { resolve(result.json); } catch { reject(new Error('服务返回的内容不是 JSON')); } }
        }, () => reject(new Error('无法连接翻译服务，请检查地址和网络'))).finally(() => signal.removeEventListener('abort', cancel));
      });
    };
  }
  private watchDocument(doc: Document) {
    if (this.documents.has(doc) || !doc.defaultView) return;
    const observer = new doc.defaultView.MutationObserver(records => {
      if (records.some(r => r.type === 'attributes' || [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !(n as Element).matches('[data-ba-output]')))) this.scheduleRefresh();
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); this.documents.set(doc, observer);
  }
  private watchSettingsLifecycle() {
    // Pop-out modals do not emit workspace window-open and do not mutate the
    // main document. Observe the settings lifecycle with a reversible wrapper.
    const setting = (this.app as unknown as { setting?: Record<string, unknown> }).setting;
    if (!setting) return;
    for (const name of ['open', 'close']) {
      const original = setting[name]; if (typeof original !== 'function') continue;
      // Host wrapper retains its own dynamic this.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const plugin = this;
      const wrapped = function(this: unknown, ...args: unknown[]) {
        if (name === 'close') {
          // Release nodes/observers before Electron destroys the pop-out realm.
          // Its detached Document can still report isConnected after close.
          plugin.settingsClosed = true;
          plugin.stopUi();
          const tab = (setting.activeTab as { containerEl?: HTMLElement } | undefined)?.containerEl;
          const modal = setting.modalEl as HTMLElement | undefined;
          for (const doc of new Set([tab?.ownerDocument, modal?.ownerDocument])) {
            // Keep the main window observer when a popout closes.
            // eslint-disable-next-line obsidianmd/prefer-active-doc
            if (doc && doc !== document) { plugin.documents.get(doc)?.disconnect(); plugin.documents.delete(doc); }
          }
        }
        const result = Reflect.apply(original, this, args);
        if (name === 'open') plugin.settingsClosed = false;
        plugin.refreshTimer?.(); plugin.refreshTimer = undefined; plugin.scheduleRefresh(); return result;
      };
      setting[name] = wrapped;
      this.restoreSettingsHooks.push(() => { if (setting[name] === wrapped) setting[name] = original; });
    }
  }
  private scheduleRefresh() {
    if (this.stopped || this.refreshTimer) return;
    this.refreshTimer = this.clock.set(() => { this.refreshTimer = undefined; this.refresh(); }, 100);
  }
  private uiContext(): string {
    if (this.settingsClosed) return 'settings';
    // This is the only internal Obsidian API dependency; unknown shape falls back safely.
    const app = this.app as unknown as { setting?: { activeTab?: { id?: string; containerEl?: HTMLElement }; containerEl?: HTMLElement; modalEl?: HTMLElement } };
    // Obsidian 1.15 moves modalEl into a separate settings window while leaving
    // containerEl detached in the main document. The active tab owns the real DOM.
    for (const container of [app.setting?.containerEl, app.setting?.modalEl, app.setting?.activeTab?.containerEl]) {
      if (container?.isConnected && container.ownerDocument) this.watchDocument(container.ownerDocument);
    }
    return app.setting?.activeTab?.id || 'settings';
  }
  private refresh() {
    if (this.stopped) return;
    this.engine.wake();
    const context = this.uiContext();
    for (const [doc, observer] of this.documents) if (!doc.defaultView || doc.defaultView.closed) { observer.disconnect(); this.documents.delete(doc); }
    this.app.workspace.iterateAllLeaves(leaf => this.watchDocument(leaf.view.containerEl.ownerDocument));
    const excluded = this.settings.excludedPlugins.split(/[\n,]/).map(s => s.trim());
    const roots = new Set<HTMLElement>();
    if (!this.settingsClosed && this.settings.uiEnabled && !excluded.includes(context)) for (const doc of this.documents.keys()) {
      doc.querySelectorAll<HTMLElement>('.modal.mod-settings').forEach(root => roots.add(root));
    }
    for (const [root, record] of this.ui) if (!root.isConnected || !roots.has(root) || record.context !== context) { record.session.stop(); this.ui.delete(root); }
    for (const root of roots) if (!this.ui.has(root)) this.ui.set(root, { context, session: new DomSession(root, 'ui', this.engine, () => this.uiContext(), s => this.report(s), this.clock) });
    const views = new Set<MarkdownView>(); this.app.workspace.getLeavesOfType('markdown').forEach(leaf => { if (leaf.view instanceof MarkdownView) views.add(leaf.view); });
    for (const [view, record] of this.reading) {
      if (!views.has(view) || view.file?.path !== record.path || view.getMode() !== 'preview' || !record.root.isConnected) { record.session.stop(); this.reading.delete(view); }
      else record.session.scan();
    }
    this.updateStatus();
  }
  startReading() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() !== 'preview') { new Notice('请先把当前笔记切换到阅读模式'); return; }
    if (!this.settings.online || !this.settings.endpoint || !this.settings.model) { new Notice('请先在双语助手设置中配置并开启在线翻译'); return; }
    const root = view.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
    if (!root || !view.file) { new Notice('没有找到阅读区域'); return; }
    this.reading.get(view)?.session.stop();
    const path = view.file.path;
    this.reading.set(view, { path, root, session: new DomSession(root, 'reading', this.engine, () => 'Markdown paragraph', s => this.report(s), this.clock) });
    this.updateStatus();
  }
  restoreReading() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView); if (!view) return;
    this.reading.get(view)?.session.stop(); this.reading.delete(view); this.updateStatus();
  }
  private toggleReading() { const view = this.app.workspace.getActiveViewOfType(MarkdownView); if (view && this.reading.has(view)) this.restoreReading(); else this.startReading(); }
  private stopUi() { this.ui.forEach(r => r.session.stop()); this.ui.clear(); }
  private stopSessions() { this.stopUi(); this.reading.forEach(r => r.session.stop()); this.reading.clear(); }
  async applySettings(config: Settings) {
    await this.store.save({ ...config });
    this.stopSessions(); this.engine.dispose();
    this.settings = { ...config, glossary: { ...config.glossary } }; this.lastError = '';
    this.engine = new Engine(this.settings, this.transport(this.settings), this.clock); this.refresh();
  }
  async testConnection(config: Settings) {
    const engine = new Engine({ ...config, online: true }, this.transport(config), this.clock);
    try { return await engine.translate({ scope: 'reading', text: 'The connection works.', context: 'Connection test' }, new AbortController().signal); }
    finally { engine.dispose(); }
  }
  private report(error: string) { this.lastError = error; this.updateStatus(); }
  private updateStatus() {
    if (!this.status) return;
    this.status.textContent = `双语：${this.reading.size ? '阅读中' : '点击翻译'}`;
    this.status.title = this.lastError || `设置汉化${this.settings.uiEnabled ? '已开启' : '已暂停'}；点击翻译／恢复当前笔记`;
  }
  onunload() {
    this.stopped = true; this.refreshTimer?.(); this.documents.forEach(o => o.disconnect()); this.documents.clear();
    this.restoreSettingsHooks.forEach(restore => restore()); this.restoreSettingsHooks = [];
    this.stopSessions(); this.engine?.dispose();
  }
}

// Archived entry retained for regression tests, excluded from release bundle.
// eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions
class AssistantSettings extends PluginSettingTab {
  constructor(private assistant: BilingualAssistant) { super(assistant.app, assistant); }
  display() {
    const el = this.containerEl; el.empty(); el.dataset.baIgnore = ''; el.addClass('ba-settings');
    const draft = { ...this.assistant.settings, glossary: { ...this.assistant.settings.glossary } };
    new Setting(el).setName('双语助手').setHeading();
    el.createEl('p', { text: '开启在线翻译后，设置文字和你主动翻译的笔记段落将发送到所选服务。原始笔记不变；译文缓存只保留在本次会话。记住的密钥经系统加密后保存在知识库外。' });
    new Setting(el).setName('设置界面汉化').addToggle(t => t.setValue(draft.uiEnabled).onChange(v => { draft.uiEnabled = v; }));
    new Setting(el).setName('允许在线翻译').setDesc('关闭时只使用少量内置界面词条和手工词典。').addToggle(t => t.setValue(draft.online).onChange(v => { draft.online = v; }));
    new Setting(el).setName('API 地址').setDesc('填写完整的 OpenAI 兼容 chat/completions 地址。').addText(t => t.setPlaceholder('https://…/v1/chat/completions').setValue(draft.endpoint).onChange(v => { draft.endpoint = v.trim(); }));
    new Setting(el).setName('模型').addText(t => t.setValue(draft.model).onChange(v => { draft.model = v.trim(); }));
    new Setting(el).setName('API Key').addText(t => { t.inputEl.type = 'password'; t.setValue(draft.apiKey).onChange(v => { draft.apiKey = v.trim(); }); });
    new Setting(el).setName('记住 API Key').setDesc('开启后点击“应用”，重启自动读取。使用系统加密，仅供此电脑当前用户使用；关闭后应用会清除已保存密钥。').addToggle(t => t.setValue(draft.rememberApiKey).onChange(v => { draft.rememberApiKey = v; }));
    new Setting(el).setName('清除 API Key').setDesc('立即清除已保存和本次会话的密钥，并关闭在线翻译。').addButton(b => b.setButtonText('清除密钥').onClick(async () => {
      try { await this.assistant.applySettings({ ...this.assistant.settings, apiKey: '', rememberApiKey: false, online: false }); this.update(); new Notice('已清除密钥并关闭在线翻译'); }
      catch { new Notice('清除失败，请重试'); }
    }));
    new Setting(el).setName('目标语言').addDropdown(d => d.addOptions({ '简体中文': '简体中文', '繁體中文': '繁體中文', '日本語': '日本語' }).setValue(draft.language).onChange(v => { draft.language = v; }));
    new Setting(el).setName('暂停汉化的插件 ID').setDesc('每行一个 ID；仅影响设置界面。').addTextArea(t => t.setValue(draft.excludedPlugins).onChange(v => { draft.excludedPlugins = v; }));
    let glossaryText = JSON.stringify(draft.glossary, null, 2);
    new Setting(el).setName('手工词典').setDesc('JSON 格式，例如 {"Backlinks":"反向链接"}；整条原文精确匹配。').addTextArea(t => t.setValue(glossaryText).onChange(v => { glossaryText = v; }));
    const parse = () => {
      const value: unknown = JSON.parse(glossaryText);
      if (!value || Array.isArray(value) || typeof value !== 'object' || Object.values(value).some(v => typeof v !== 'string')) throw new Error('词典必须是原文到译文的 JSON 对象');
      draft.glossary = value as Record<string, string>;
    };
    new Setting(el).setName('测试连接').addButton(b => b.setButtonText('测试').onClick(async () => {
      b.setDisabled(true); try { parse(); const result = await this.assistant.testConnection(draft); new Notice(`连接成功：${result}`); } catch (e) { new Notice((e as Error).message); } finally { b.setDisabled(false); }
    }));
    new Setting(el).setName('保存并应用').setDesc('应用时先恢复所有原文；正文需重新点击翻译。').addButton(b => b.setButtonText('应用').setCta().onClick(async () => {
      try { parse(); await this.assistant.applySettings(draft); new Notice(draft.rememberApiKey ? '已应用，API Key 已由系统加密保存' : '已应用，API Key 仅保留在本次会话'); } catch (e) { new Notice((e as Error).message); }
    }));
    el.createEl('p', { text: `配置保存在知识库外：${this.assistant.store.directory}` });
  }
}
