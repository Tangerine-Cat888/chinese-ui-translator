export interface Clock { set(callback: () => void, delay: number): () => void }
// Environment-neutral fallback for unit tests; desktop entry points inject Node timers.
// eslint-disable-next-line obsidianmd/prefer-window-timers
export const defaultClock: Clock = { set(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); } };
