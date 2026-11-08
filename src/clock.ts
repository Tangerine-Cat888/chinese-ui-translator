export interface Clock { set(callback: () => void, delay: number): () => void }
// Node/libuv callbacks can run inside FreeEnvironment when an Obsidian popout
// closes. Keep renderer scheduling on the main browser window instead.
export const defaultClock: Clock = { set(callback, delay) {
 const timer = window.setTimeout(callback, delay);
 return () => window.clearTimeout(timer);
} };

/** Yield without libuv or background-window timer throttling. */
export function yieldToUi(): Promise<void> {
 if (typeof window === 'undefined' || typeof window.MessageChannel !== 'function') {
  return new Promise(resolve => defaultClock.set(resolve, 0));
 }
 return new Promise(resolve => {
  const channel = new window.MessageChannel();
  channel.port1.onmessage = () => {
   channel.port1.close();
   channel.port2.close();
   resolve();
  };
  channel.port2.postMessage(null);
 });
}
