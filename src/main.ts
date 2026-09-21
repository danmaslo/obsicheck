import { ItemView, Notice, Plugin, TFile, WorkspaceLeaf, type CachedMetadata } from 'obsidian';
import { collectTasks, updateTask, type Task } from './tasks';

const VIEW_TYPE = 'obsicheck-tasks';
type Filter = 'open' | 'done' | 'all';
interface Entry { source: string; tasks: Task[] }

export default class ObsicheckPlugin extends Plugin {
  entries = new Map<string, Entry>();
  listeners = new Set<() => void>();
  private revisions = new Map<string, number>();
  private stopped = false;
  ready = false;
  failures = new Set<string>();

  async onload() {
    this.registerView(VIEW_TYPE, leaf => new TasksView(leaf, this));
    this.addRibbonIcon('list-checks', 'Obsicheck: Přehled úkolů', () => { void this.openView(); });
    this.addCommand({ id: 'open-tasks', name: 'Otevřít přehled úkolů', callback: () => { void this.openView(); } });
    this.registerEvent(this.app.metadataCache.on('changed', (file, source, cache) => {
      this.bump(file.path);
      this.index(file, source, cache);
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      for (const path of this.entries.keys()) {
        if (path === file.path || path.startsWith(file.path + '/')) this.remove(path);
      }
      this.bump(file.path);
      this.notify();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      for (const path of this.entries.keys()) {
        if (path === oldPath || path.startsWith(oldPath + '/')) this.remove(path);
      }
      this.bump(oldPath);
      if (file instanceof TFile && file.extension === 'md') void this.refreshFile(file);
      else if (!(file instanceof TFile)) {
        for (const note of this.app.vault.getMarkdownFiles()) {
          if (note.path.startsWith(file.path + '/')) void this.refreshFile(note);
        }
      }
      this.notify();
    }));
    this.app.workspace.onLayoutReady(() => { if (!this.stopped) void this.refresh(); });
  }

  onunload() {
    this.stopped = true;
    this.listeners.clear();
  }

  private bump(path: string) {
    const revision = (this.revisions.get(path) ?? 0) + 1;
    this.revisions.set(path, revision);
    return revision;
  }

  private remove(path: string) {
    this.bump(path);
    this.entries.delete(path);
    this.failures.delete(path);
  }

  private index(file: TFile, source: string, cache: CachedMetadata) {
    if (this.stopped || file.extension !== 'md') return;
    this.entries.set(file.path, { source, tasks: collectTasks(file.path, source, cache.listItems ?? []) });
    this.failures.delete(file.path);
    this.notify();
  }

  async refreshFile(file: TFile) {
    const path = file.path;
    const revision = this.bump(path);
    try {
      const source = await this.app.vault.cachedRead(file);
      if (this.stopped || this.revisions.get(path) !== revision || file.path !== path || this.app.vault.getAbstractFileByPath(path) !== file) return;
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache) this.index(file, source, cache);
      // A newly created note is indexed by metadataCache's changed event once parsed.
    } catch (error) {
      if (this.stopped || this.revisions.get(path) !== revision) return;
      this.entries.delete(path);
      this.failures.add(path);
      console.error('Obsicheck: nelze načíst poznámku', path, error);
      this.notify();
    }
  }

  async refresh() {
    const files = this.app.vault.getMarkdownFiles();
    const paths = new Set(files.map(file => file.path));
    for (const path of this.entries.keys()) if (!paths.has(path)) this.remove(path);
    // Bound concurrent reads even in large vaults.
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
      while (next < files.length && !this.stopped) await this.refreshFile(files[next++]);
    }));
    this.ready = true;
    this.notify();
  }

  notify() { for (const listener of this.listeners) listener(); }

  async setCompleted(task: Task, completed: boolean, expectedSource: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    const entry = this.entries.get(task.path);
    if (!(file instanceof TFile) || !entry) {
      new Notice('Zdrojová poznámka už není dostupná.');
      await this.refresh();
      return false;
    }
    try {
      await this.app.vault.process(file, source => updateTask(source, expectedSource, task, completed));
      // Wait for the Markdown cache to publish the new task positions and statuses.
      return true;
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'Úkol se nepodařilo uložit.');
      await this.refreshFile(file);
      return false;
    }
  }

  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
}

class TasksView extends ItemView {
  private filter: Filter = 'open';
  private query = '';
  private results!: HTMLElement;
  private summary!: HTMLElement;
  private timer: number | undefined;
  private unsubscribe = () => {};

  constructor(leaf: WorkspaceLeaf, private plugin: ObsicheckPlugin) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Obsicheck'; }
  getIcon() { return 'list-checks'; }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('obsicheck');
    const heading = this.contentEl.createDiv({ cls: 'obsicheck-heading' });
    heading.createEl('h2', { text: 'Všechny úkoly' });
    const refresh = heading.createEl('button', { text: 'Obnovit' });
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      try { await this.plugin.refresh(); } finally { refresh.disabled = false; }
    });
    this.summary = this.contentEl.createDiv({ cls: 'obsicheck-summary', attr: { 'aria-live': 'polite' } });
    const controls = this.contentEl.createDiv({ cls: 'obsicheck-controls' });
    const search = controls.createEl('input', { type: 'search', placeholder: 'Hledat úkol nebo poznámku…', attr: { 'aria-label': 'Hledat úkol nebo poznámku' } });
    search.addEventListener('input', () => { this.query = search.value; this.renderResults(); });
    const select = controls.createEl('select', { attr: { 'aria-label': 'Stav úkolů' } });
    for (const [value, text] of [['open', 'Nedokončené'], ['done', 'Hotové'], ['all', 'Všechny']]) select.createEl('option', { value, text });
    select.value = this.filter;
    select.addEventListener('change', () => { this.filter = select.value as Filter; this.renderResults(); });
    this.results = this.contentEl.createDiv({ cls: 'obsicheck-results' });
    const listener = () => {
      if (this.timer !== undefined) return;
      this.timer = window.setTimeout(() => { this.timer = undefined; this.renderResults(); }, 100);
    };
    this.plugin.listeners.add(listener);
    this.unsubscribe = () => this.plugin.listeners.delete(listener);
    this.renderResults();
  }

  async onClose() {
    this.unsubscribe();
    if (this.timer !== undefined) window.clearTimeout(this.timer);
  }

  private renderResults() {
    const snapshots = new Map(this.plugin.entries);
    const all = [...snapshots.values()].flatMap(entry => entry.tasks);
    const done = all.filter(task => task.completed).length;
    this.summary.setText(`${all.length - done} nedokončených · ${done} hotových`);
    this.results.empty();
    if (this.plugin.failures.size) this.results.createEl('p', { cls: 'obsicheck-warning', text: `${this.plugin.failures.size} poznámek se nepodařilo načíst. Zkus přehled obnovit.` });
    const query = this.query.trim().toLocaleLowerCase();
    const tasks = all.filter(task => (this.filter === 'all' || task.completed === (this.filter === 'done')) && `${task.text} ${task.path}`.toLocaleLowerCase().includes(query));
    tasks.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
    if (!tasks.length) {
      this.results.createEl('p', { cls: 'obsicheck-empty', text: !this.plugin.ready ? 'Načítám úkoly…' : query ? 'Hledání neodpovídá žádný úkol.' : this.filter === 'done' ? 'Zatím žádné hotové úkoly.' : this.filter === 'open' && all.length ? 'Vše hotovo.' : 'Žádné úkoly. Přidej do poznámky checkbox pomocí - [ ].' });
      return;
    }
    let path = '';
    let list: HTMLElement = this.results;
    for (const task of tasks) {
      if (task.path !== path) {
        path = task.path;
        const group = this.results.createEl('section', { cls: 'obsicheck-group' });
        const title = group.createEl('h3');
        const link = title.createEl('button', { cls: 'obsicheck-source', text: path.replace(/\.md$/, '') });
        link.addEventListener('click', () => { void this.openTask(task); });
        list = group.createEl('ul');
      }
      const row = list.createEl('li', { cls: `obsicheck-task${task.completed ? ' is-complete' : ''}` });
      const input = row.createEl('input', { type: 'checkbox', attr: { 'aria-label': `${task.completed ? 'Znovu otevřít' : 'Dokončit'}: ${task.text || 'Prázdný úkol'}` } });
      input.checked = task.completed;
      input.addEventListener('change', async () => {
        input.disabled = true;
        try {
          const saved = await this.plugin.setCompleted(task, input.checked, snapshots.get(task.path)!.source);
          if (!saved) input.checked = task.completed;
        } finally { input.disabled = false; }
      });
      const text = row.createEl('button', { cls: 'obsicheck-task-text', text: task.text || '(prázdný úkol)', attr: { title: `Otevřít ${task.path}, řádek ${task.line + 1}` } });
      text.addEventListener('click', () => { void this.openTask(task); });
      if (task.status !== ' ' && !task.completed) row.createEl('span', { cls: 'obsicheck-status', text: `[${task.status}]` });
    }
  }

  private async openTask(task: Task) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) { new Notice('Zdrojová poznámka už není dostupná.'); return; }
    await this.app.workspace.getLeaf('tab').openFile(file, { eState: { line: task.line } });
  }
}
