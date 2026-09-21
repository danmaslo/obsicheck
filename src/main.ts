import { Notice, Plugin, TFile, type CachedMetadata } from 'obsidian';
import { collectTasks, updateTask, updateDismissal, type Task } from './tasks';
import { TasksView, VIEW_TYPE } from './view';

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
    this.addRibbonIcon('list-checks', 'Obsicheck: Task overview', () => { void this.openView(); });
    this.addCommand({ id: 'open-tasks', name: 'Open task overview', callback: () => { void this.openView(); } });
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
      console.error('Obsicheck: could not read note', path, error);
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
    return this.mutateTask(task, expectedSource, source => updateTask(source, expectedSource, task, completed));
  }

  async setDismissed(task: Task, dismissed: boolean, expectedSource: string): Promise<boolean> {
    return this.mutateTask(task, expectedSource, source => updateDismissal(source, expectedSource, task, dismissed));
  }

  private async mutateTask(task: Task, expectedSource: string, transform: (source: string) => string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    const entry = this.entries.get(task.path);
    if (!(file instanceof TFile) || !entry) {
      new Notice('The source note is no longer available.');
      await this.refresh();
      return false;
    }
    try {
      const updated = await this.app.vault.process(file, transform);
      // These operations keep line positions intact. Update immediately, unless a newer
      // cache event has already replaced this entry while the write was pending.
      if (this.entries.get(task.path) === entry && entry.source === expectedSource) {
        const locations = entry.tasks.map(item => ({ task: item.status, position: { start: { line: item.line } } }));
        this.entries.set(task.path, { source: updated, tasks: collectTasks(task.path, updated, locations) });
        this.notify();
      }
      return true;
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'Could not save the task.');
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
