// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Engine, type Config } from '../src/core';
import { DomSession, segment } from '../src/dom';
const config: Config = { endpoint: 'https://example.invalid', model: 'test', apiKey: '', language: '简体中文', online: true, glossary: {} };
const result = (s: string) => ({ choices: [{ message: { content: JSON.stringify({ 0: s }) } }] });
let sessions: DomSession[]; let engines: Engine[];
beforeEach(() => { vi.useFakeTimers(); sessions = []; engines = []; });
afterEach(() => { sessions.forEach(s => s.stop()); engines.forEach(e => e.dispose()); document.body.replaceChildren(); vi.useRealTimers(); });
function root(html: string) { const el = document.createElement('div'); el.innerHTML = html; document.body.append(el); return el; }
function service(t = vi.fn().mockResolvedValue(result('译文'))) { const e = new Engine(config, t); engines.push(e); return e; }
function session(el: HTMLElement, scope: 'ui' | 'reading', e: Engine) { const s = new DomSession(el, scope, e, () => 'test'); sessions.push(s); return s; }

test('UI labels restore exact whitespace, input values and click handlers stay intact', async () => {
  const el = root('<button>  Save  </button><input value="Save"><div class="setting-item-name"><code>Save</code></div>');
  const button = el.querySelector('button')!; const click = vi.fn(); button.onclick = click;
  const s = session(el, 'ui', service()); await vi.advanceTimersByTimeAsync(100);
  expect(button.textContent).toBe('  保存  '); expect(el.querySelector('input')!.value).toBe('Save'); expect(el.querySelector('code')!.textContent).toBe('Save'); button.click(); expect(click).toHaveBeenCalledOnce();
  s.stop(); expect(button.textContent).toBe('  Save  '); expect(button.hasAttribute('title')).toBe(false);
});
test('restoring does not overwrite text subsequently changed by the host', async () => {
  const el = root('<button>Save</button>'); const s = session(el, 'ui', service()); await vi.advanceTimersByTimeAsync(100);
  el.querySelector('button')!.firstChild!.nodeValue = 'Saved by host'; s.stop(); expect(el.textContent).toBe('Saved by host');
});
test('restoring while translation is pending prevents late DOM writes', async () => {
  let finish!: (x: unknown) => void; const e = service(vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const el = root('<p>Hello world.</p>'); const s = session(el, 'reading', e); await vi.advanceTimersByTimeAsync(50);
  s.stop(); finish(result('过期译文')); await vi.advanceTimersByTimeAsync(100); expect(el.innerHTML).toBe('<p>Hello world.</p>');
});
test('source edits suppress old paragraph translations', async () => {
  const replies: ((x: unknown) => void)[] = []; const e = service(vi.fn(() => new Promise(resolve => replies.push(resolve))));
  const el = root('<p>Old paragraph.</p>'); session(el, 'reading', e); await vi.advanceTimersByTimeAsync(50);
  el.querySelector('p')!.firstChild!.nodeValue = 'New paragraph.'; await vi.advanceTimersByTimeAsync(150);
  replies[0](result('旧段落')); replies[1](result('新段落')); await vi.advanceTimersByTimeAsync(100);
  expect(el.querySelectorAll('[data-ba-output]')).toHaveLength(1); expect(el.querySelector('[data-ba-output]')!.textContent).toBe('新段落');
});
test('reading preserves original nodes, links and protected code; stop is exact', async () => {
  const el = root('<p>Use <code>npm run</code> and <a href="https://example.com">the guide</a>.</p>');
  const original = el.innerHTML; const link = el.querySelector('a'); const e = service(vi.fn().mockResolvedValue(result('使用 ⟦BA0⟧ 并查看指南。')));
  const s = session(el, 'reading', e); await vi.advanceTimersByTimeAsync(100);
  expect(el.querySelector('[data-ba-output]')!.textContent).toBe('使用 npm run 并查看指南。'); expect(el.querySelector('a')).toBe(link); expect(link!.getAttribute('href')).toBe('https://example.com');
  s.stop(); expect(el.innerHTML).toBe(original);
});
test('nested list parent and child are independent segments', () => {
  const el = root('<ul><li>Parent text<ul><li>Child text</li></ul></li></ul>');
  const items = el.querySelectorAll('li'); expect(segment(items[0]).text).toBe('Parent text'); expect(segment(items[1]).text).toBe('Child text');
});
test('host re-render reuses cache and never translates the injected translation', async () => {
  const t = vi.fn().mockResolvedValue(result('自定义设置')); const e = service(t); const el = root('<button>Custom setting</button>'); session(el, 'ui', e);
  await vi.advanceTimersByTimeAsync(150); el.querySelector('button')!.firstChild!.nodeValue = 'Custom setting'; await vi.advanceTimersByTimeAsync(150);
  expect(el.textContent).toBe('自定义设置'); expect(t).toHaveBeenCalledTimes(1);
});
test('50 enable/disable cycles leave no translated DOM behind', async () => {
  const el = root('<button>Save</button>'); const e = service();
  for (let i = 0; i < 50; i++) { const s = session(el, 'ui', e); await vi.advanceTimersByTimeAsync(1); s.stop(); }
  expect(el.innerHTML).toBe('<button>Save</button>'); expect(e.pending).toBe(0);
});
test('separate documents both translate and recover independently', async () => {
  const frame = document.createElement('iframe'); document.body.append(frame); const other = frame.contentDocument!;
  other.body.innerHTML = '<button>Save</button>'; const main = root('<button>Cancel</button>');
  const a = session(main, 'ui', service()); const b = session(other.body, 'ui', service()); await vi.advanceTimersByTimeAsync(50);
  expect(other.body.textContent).toBe('保存'); expect(main.textContent).toBe('取消'); a.stop(); expect(other.body.textContent).toBe('保存'); b.stop(); expect(other.body.textContent).toBe('Save');
});
test('externally removed translation is rebuilt from cache', async () => {
  const t = vi.fn().mockResolvedValue(result('译文')); const el = root('<p>Hello world.</p>'); session(el, 'reading', service(t));
  await vi.advanceTimersByTimeAsync(150); el.querySelector('[data-ba-output]')!.remove(); await vi.advanceTimersByTimeAsync(150);
  expect(el.querySelectorAll('[data-ba-output]')).toHaveLength(1); expect(t).toHaveBeenCalledTimes(1);
});
test('failed paragraphs expose a retry action and restore cleanly', async () => {
  const t = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(result('重试成功'));
  const el = root('<p>Retry this paragraph.</p>'); const s = session(el, 'reading', service(t)); await vi.advanceTimersByTimeAsync(150);
  expect(el.querySelector('button')!.textContent).toContain('重试'); el.querySelector('button')!.click(); await vi.advanceTimersByTimeAsync(150);
  expect(el.querySelector('[data-ba-output]')!.textContent).toBe('重试成功'); s.stop(); expect(el.innerHTML).toBe('<p>Retry this paragraph.</p>');
});
test('only visible paragraphs are requested when IntersectionObserver is available', async () => {
  let observe!: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  const original = window.IntersectionObserver;
  window.IntersectionObserver = class { constructor(cb: typeof observe) { observe = cb; } observe() {} disconnect() {} } as any;
  try {
    const t = vi.fn().mockResolvedValue(result('首段')); const el = root('<p>Visible paragraph.</p><p>Offscreen paragraph.</p>'); session(el, 'reading', service(t));
    await vi.advanceTimersByTimeAsync(150); expect(t).not.toHaveBeenCalled(); observe([{ target: el.querySelector('p')!, isIntersecting: true }]); await vi.advanceTimersByTimeAsync(150);
    expect(t).toHaveBeenCalledTimes(1); expect(el.querySelectorAll('[data-ba-output]')).toHaveLength(1);
  } finally { window.IntersectionObserver = original; }
});
