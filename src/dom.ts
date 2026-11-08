import { Engine, type Scope } from './core';
import { defaultClock, type Clock } from './clock';

const output = '[data-ba-output]';
const excluded = 'script,style,pre,code,input,textarea,select,[contenteditable="true"],.cm-editor,.markdown-source-view,.math,.math-block,svg,iframe,[data-ba-ignore]';
const uiLabels = '.setting-item-name,.setting-item-description,.vertical-tab-nav-item,button,h1,h2,h3,label';
const blocks = 'p,h1,h2,h3,h4,h5,h6,li';
export function isEnglish(text: string) {
  const s = text.trim();
  return /[a-zA-Z]{2,}/.test(s) && !/^(https?:\/\/|[A-Z]:\\|\/[^ ]+)|^[\w.-]+\.(md|js|ts|json|css)$/i.test(s);
}
interface Segment { text: string; tokens: string[]; fingerprint: string }
export function segment(el: HTMLElement): Segment {
  const tokens: string[] = []; let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === 3) { text += node.nodeValue ?? ''; return; }
    if (node.nodeType !== 1) return;
    const child = node as HTMLElement;
    if (child.matches(output)) return;
    if (child !== el && child.matches('ul,ol,' + blocks)) return;
    if (child.matches('code,.math,.math-inline,a.internal-link')) {
      text += `⟦BA${tokens.length}⟧`; tokens.push(child.textContent ?? ''); return;
    }
    if (child.matches('script,style,pre,input,textarea,select,svg,iframe')) return;
    if (child.tagName === 'BR') text += '\n';
    else child.childNodes.forEach(walk);
  };
  walk(el);
  return { text: text.trim(), tokens, fingerprint: JSON.stringify([text, tokens]) };
}
interface State { source: string; fingerprint: string; controller: AbortController; applied?: string; wrapper?: HTMLElement }
/** A session owns only text patches and its own translation elements. */
export class DomSession {
  private states = new Map<Node, State>();
  private titles = new Map<HTMLElement, string>();
  private observer: MutationObserver;
  private intersection?: IntersectionObserver;
  private visible = new WeakSet<Element>();
  private observed = new WeakSet<Element>();
  private timer?: () => void;
  private stopped = false;
  constructor(readonly root: HTMLElement, readonly scope: Scope, private engine: Engine, private context: () => string, private error: (s: string) => void = () => {}, private clock: Clock = defaultClock) {
    const win = root.ownerDocument.defaultView!;
    this.observer = new win.MutationObserver(records => {
      if (records.every(r => {
        const parent = r.target.nodeType === 1 ? r.target as Element : r.target.parentElement;
        if (parent?.closest(output)) return true;
        const state = this.states.get(r.target);
        if (r.type === 'characterData' && state?.applied === r.target.nodeValue) return true;
        if (r.type === 'childList' && !r.removedNodes.length && [...r.addedNodes].every(n => n.nodeType === 1 && (n as Element).matches(output))) return true;
        return false;
      })) return;
      this.schedule();
    });
    if (scope === 'reading' && win.IntersectionObserver) {
      this.intersection = new win.IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) this.visible.add(e.target); else this.visible.delete(e.target); });
        this.schedule();
      }, { root: root.closest('.markdown-preview-view'), rootMargin: '250px' });
    }
    this.observer.observe(root, { childList: true, subtree: true, characterData: true }); this.scan();
  }
  private schedule() {
    if (this.stopped || this.timer) return;
    this.timer = this.clock.set(() => { this.timer = undefined; this.scan(); }, 80);
  }
  private cleanup(node: Node, state: State) {
    state.controller.abort();
    if (state.applied !== undefined && node.nodeValue === state.applied) node.nodeValue = state.source;
    state.wrapper?.remove(); this.states.delete(node);
  }
  scan() {
    if (this.stopped) return;
    for (const [node, state] of this.states) if (!this.root.contains(node) || !node.isConnected) this.cleanup(node, state);
    for (const [el, title] of this.titles) if (!el.isConnected || !this.root.contains(el)) { if (el.title === title) el.removeAttribute('title'); this.titles.delete(el); }
    if (this.scope === 'ui') this.scanUi(); else this.scanReading();
  }
  private scanUi() {
    const walker = this.root.ownerDocument.createTreeWalker(this.root, 4);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent?.closest(uiLabels) || parent.closest(excluded + ',' + output + ',.markdown-reading-view,.markdown-preview-view')) continue;
      const original = node.nodeValue ?? '';
      const old = this.states.get(node);
      const fingerprint = JSON.stringify([this.context(), original]);
      if (old && (original === old.applied || (old.applied === undefined && fingerprint === old.fingerprint))) continue;
      if (old) this.cleanup(node, old);
      if (!isEnglish(original)) continue;
      const sourceNode = node;
      const state: State = { source: original, fingerprint, controller: new AbortController() };
      this.states.set(node, state);
      void this.engine.translate({ scope: 'ui', text: original.trim(), context: this.context() + ':' + parent.className }, state.controller.signal).then(value => {
        if (this.stopped || state.controller.signal.aborted || !sourceNode.isConnected || !this.root.contains(sourceNode) || sourceNode.nodeValue !== original || this.states.get(sourceNode) !== state || fingerprint !== JSON.stringify([this.context(), original])) return;
        const rendered = original.replace(original.trim(), value);
        state.applied = rendered; sourceNode.nodeValue = rendered;
        if (!parent.hasAttribute('title')) { parent.title = original.trim(); this.titles.set(parent, original.trim()); }
      }).catch(e => { if (!state.controller.signal.aborted) this.error((e as Error).message); });
    }
  }
  private scanReading() {
    const candidates = [...(this.root.matches(blocks) ? [this.root] : []), ...this.root.querySelectorAll<HTMLElement>(blocks)];
    for (const el of candidates) {
      if (el.closest(excluded + ',' + output)) continue;
      if (this.intersection && !this.observed.has(el)) { this.observed.add(el); this.intersection.observe(el); }
      const data = segment(el); const old = this.states.get(el);
      if (old && data.fingerprint === old.fingerprint && (!old.wrapper || old.wrapper.isConnected)) continue;
      if (old) this.cleanup(el, old);
      if (!isEnglish(data.text.replace(/⟦BA\d+⟧/g, '')) || (this.intersection && !this.visible.has(el))) continue;
      const state: State = { source: data.text, fingerprint: data.fingerprint, controller: new AbortController() };
      this.states.set(el, state);
      const valid = () => !this.stopped && !state.controller.signal.aborted && el.isConnected && this.root.contains(el) && this.states.get(el) === state && segment(el).fingerprint === state.fingerprint;
      void this.engine.translate({ scope: 'reading', text: data.text, context: this.context() }, state.controller.signal).then(value => {
        if (!valid()) return;
        const translated = value.replace(/⟦BA(\d+)⟧/g, (_, n) => data.tokens[Number(n)] ?? '');
        const wrapper = el.createSpan(); wrapper.dataset.baOutput = 'translation'; wrapper.className = 'ba-translation'; wrapper.lang = this.engine.config.language === '简体中文' ? 'zh-CN' : '';
        wrapper.textContent = translated; state.wrapper = wrapper;
        const childList = el.querySelector(':scope > ul,:scope > ol'); el.insertBefore(wrapper, childList);
      }).catch(e => {
        if (!valid()) return;
        const wrapper = el.createSpan(); wrapper.dataset.baOutput = 'error'; wrapper.className = 'ba-translation ba-error';
        const retry = wrapper.createEl('button'); retry.textContent = '翻译失败，点击重试'; retry.title = (e as Error).message;
        retry.onclick = event => { event.preventDefault(); event.stopPropagation(); this.cleanup(el, state); this.scan(); };
        wrapper.append(retry); state.wrapper = wrapper; el.append(wrapper); this.error((e as Error).message);
      });
    }
  }
  stop() {
    if (this.stopped) return; this.stopped = true; this.timer?.();
    this.observer.disconnect(); this.intersection?.disconnect();
    for (const [node, state] of this.states) this.cleanup(node, state);
    for (const [el, title] of this.titles) if (el.title === title) el.removeAttribute('title');
    this.titles.clear();
  }
}
