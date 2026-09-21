// A small browser harness for the real view and plugin; not an Obsidian replacement.
HTMLElement.prototype.createEl = function(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.cls) el.className = options.cls;
  if (options.text) el.textContent = options.text;
  for (const key of ['type', 'placeholder', 'value']) if (options[key]) el[key] = options[key];
  for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, value);
  this.append(el);
  return el;
};
HTMLElement.prototype.createDiv = function(options) { return this.createEl('div', options); };
HTMLElement.prototype.createSpan = function(options) { return this.createEl('span', options); };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.addClass = function(cls) { this.classList.add(cls); };
HTMLElement.prototype.setText = function(text) { this.textContent = text; };
export class Plugin { constructor() { this.app = window.testApp; } }
export class ItemView { constructor() { this.app = window.testApp; this.contentEl = document.querySelector('#view'); } }
export class TFile { constructor(path) { this.path = path; this.extension = 'md'; } }
export class Notice { constructor(message) { window.notices.push(message); } }
export class WorkspaceLeaf {}
export function setIcon(el, name) {
  const paths = {
    'x': '<path d="m18 6-12 12M6 6l12 12"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>',
    'refresh-cw': '<path d="M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 13a9 9 0 0 1-15 6l-3-3M3 21v-5h5"/>',
    'undo-2': '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12"/>',
    'circle-minus': '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    'list-checks': '<path d="m3 6 2 2 4-4M13 6h8M3 14l2 2 4-4M13 14h8M13 20h8"/>',
    'archive': '<path d="M3 3h18v4H3zM5 7v14h14V7M10 11h4"/>',
  };
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}
