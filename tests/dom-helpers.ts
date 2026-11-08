// Minimal Obsidian DOM helpers for the archived reader regression fixture.
HTMLElement.prototype.createEl = function(this: HTMLElement, tag: keyof HTMLElementTagNameMap) {
 const child = this.ownerDocument.createElement(tag); this.append(child); return child;
} as HTMLElement['createEl'];
HTMLElement.prototype.createSpan = function() { return this.createEl('span'); };
