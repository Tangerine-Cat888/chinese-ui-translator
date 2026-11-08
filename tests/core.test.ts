import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Engine, validateTranslation, type Config, type Transport } from '../src/core';
const config: Config = { endpoint: 'https://example.invalid/v1/chat/completions', model: 'test', apiKey: '', language: '简体中文', online: true, glossary: {} };
const item = { scope: 'reading' as const, text: 'Hello world.', context: 'paragraph' };
const response = (value: object) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
let engines: Engine[];
beforeEach(() => { vi.useFakeTimers(); engines = []; });
afterEach(() => { engines.forEach(e => e.dispose()); vi.useRealTimers(); });
function engine(transport: Transport) { const e = new Engine(config, transport); engines.push(e); return e; }

test('two subscribers share a request; canceling one leaves the other intact', async () => {
  let finish!: (v: unknown) => void;
  const transport = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const e = engine(transport); const a = new AbortController(); const b = new AbortController();
  const p = e.translate(item, a.signal).catch(err => err.name); const q = e.translate(item, b.signal);
  await vi.advanceTimersByTimeAsync(50); a.abort(); finish(response({ 0: '你好，世界。' }));
  expect(await p).toBe('AbortError'); expect(await q).toBe('你好，世界。'); expect(transport).toHaveBeenCalledTimes(1); expect(e.pending).toBe(0);
});
test('all canceled subscribers invalidate a late result and a new request can proceed', async () => {
  const replies: ((v: unknown) => void)[] = [];
  const transport = vi.fn(() => new Promise(resolve => replies.push(resolve))); const e = engine(transport);
  const a = new AbortController(); const old = e.translate(item, a.signal).catch(err => err.name);
  await vi.advanceTimersByTimeAsync(50); a.abort();
  const current = e.translate(item, new AbortController().signal); await vi.advanceTimersByTimeAsync(50);
  replies[0](response({ 0: '过期结果' })); replies[1](response({ 0: '新结果' }));
  expect(await old).toBe('AbortError'); expect(await current).toBe('新结果'); expect(transport).toHaveBeenCalledTimes(2);
});
test('missing result does not become a successful cache entry', async () => {
  const t = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValue(response({ 0: '你好' })); const e = engine(t);
  const p = e.translate(item, new AbortController().signal).catch(err => err.message); await vi.advanceTimersByTimeAsync(50); expect(await p).toContain('格式');
  const q = e.translate(item, new AbortController().signal); await vi.advanceTimersByTimeAsync(50); expect(await q).toBe('你好'); expect(t).toHaveBeenCalledTimes(2);
});
test('scope and context isolate cache entries', async () => {
  const t = vi.fn().mockResolvedValue(response({ 0: '甲' })); const e = engine(t);
  for (const context of ['plugin-a', 'plugin-b', 'plugin-a']) { const p = e.translate({ ...item, context }, new AbortController().signal); await vi.advanceTimersByTimeAsync(50); await p; }
  expect(t).toHaveBeenCalledTimes(2);
});
test('bad placeholder output and injected HTML are rejected', () => {
  expect(() => validateTranslation('Use ⟦BA0⟧', '使用代码')).toThrow();
  expect(() => validateTranslation('Hello', '<img src=x onerror=alert(1)>')).toThrow();
  expect(validateTranslation('Use ⟦BA0⟧', '使用 ⟦BA0⟧')).toBe('使用 ⟦BA0⟧');
});
test('authentication failure pauses subsequent network calls', async () => {
  const t = vi.fn().mockRejectedValue(Object.assign(new Error('HTTP 401'), { status: 401 })); const e = engine(t);
  const p = e.translate(item, new AbortController().signal).catch(err => err.message); await vi.advanceTimersByTimeAsync(50); await p;
  await expect(e.translate({ ...item, text: 'Another sentence' }, new AbortController().signal)).rejects.toThrow('认证'); expect(t).toHaveBeenCalledTimes(1);
});
test('transient 429 retries once and retains stable IDs', async () => {
  const t = vi.fn().mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 })).mockResolvedValue(response({ 0: '成功' })); const e = engine(t);
  const p = e.translate(item, new AbortController().signal); await vi.advanceTimersByTimeAsync(1100); expect(await p).toBe('成功'); expect(t).toHaveBeenCalledTimes(2);
});
test('disposing a service cancels all consumers without caching late output', async () => {
  const e = engine(() => new Promise(() => {})); const p = e.translate(item, new AbortController().signal).catch(err => err.name);
  await vi.advanceTimersByTimeAsync(50); e.dispose(); expect(await p).toBe('AbortError'); expect(e.pending).toBe(0);
});
test('manual dictionary also respects protected placeholders', async () => {
  const e = new Engine({ ...config, glossary: { 'Use ⟦BA0⟧': '不完整译文' } }, vi.fn()); engines.push(e);
  await expect(e.translate({ ...item, text: 'Use ⟦BA0⟧' }, new AbortController().signal)).rejects.toThrow('占位符');
});
test('prototype property names are treated as ordinary source strings', async () => {
  const t = vi.fn().mockResolvedValue(response({ 0: '构造器' })); const e = engine(t);
  const p = e.translate({ ...item, scope: 'ui', text: 'constructor' }, new AbortController().signal); await vi.advanceTimersByTimeAsync(50);
  expect(await p).toBe('构造器'); expect(t).toHaveBeenCalledOnce();
});
