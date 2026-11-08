import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ test:{environment:'jsdom',setupFiles:['tests/dom-helpers.ts'],include:['tests/**/*.test.ts'],exclude:['tests/artifacts/**']},resolve: { alias: { obsidian: fileURLToPath(new URL('./tests/obsidian-runtime.ts', import.meta.url)) } } });
