// Minimal Obsidian DOM helpers for the archived reader regression fixture.
HTMLElement.prototype.createEl = function(this: HTMLElement, tag: keyof HTMLElementTagNameMap) {
 const child = this.ownerDocument.createElement(tag); this.append(child); return child;
} as HTMLElement['createEl'];
HTMLElement.prototype.createSpan = function() { return this.createEl('span'); };

// Detached host helper used by dropdown text measurement.
globalThis.createEl = function(tag: keyof HTMLElementTagNameMap) { return document.createElement(tag); } as typeof createEl;
