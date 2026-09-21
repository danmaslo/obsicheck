import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type ObsicheckPlugin from './main';
import { matchesFilter, type Task, type TaskFilter } from './tasks';

export const VIEW_TYPE = 'obsicheck-tasks';
const filters: [TaskFilter, string][] = [['open', 'Open'], ['done', 'Completed'], ['all', 'All'], ['dismissed', 'Dismissed']];

export class TasksView extends ItemView {
  private filter: TaskFilter = 'open';
  private query = '';
  private results!: HTMLElement;
  private summary!: HTMLElement;
  private hint!: HTMLElement;
  private filterButtons = new Map<TaskFilter, { button: HTMLButtonElement; count: HTMLElement }>();
  private timer: number | undefined;
  private unsubscribe = () => {};

  constructor(leaf: WorkspaceLeaf, private plugin: ObsicheckPlugin) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Obsicheck'; }
  getIcon() { return 'list-checks'; }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('obsicheck');
    const page = this.contentEl.createDiv({ cls: 'obsicheck-page' });
    const heading = page.createDiv({ cls: 'obsicheck-heading' });
    const intro = heading.createDiv();
    intro.createDiv({ cls: 'obsicheck-eyebrow', text: 'OBSICHECK' });
    intro.createEl('h2', { text: 'Your tasks' });
    this.summary = intro.createDiv({ cls: 'obsicheck-summary', attr: { 'aria-live': 'polite' } });
    const refresh = this.iconButton(heading, 'refresh-cw', 'Refresh tasks', 'obsicheck-refresh');
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      try { await this.plugin.refresh(); } finally { refresh.disabled = false; }
    });
    const searchBox = page.createDiv({ cls: 'obsicheck-search' });
    const searchIcon = searchBox.createSpan({ cls: 'obsicheck-search-icon', attr: { 'aria-hidden': 'true' } });
    setIcon(searchIcon, 'search');
    const search = searchBox.createEl('input', { type: 'search', placeholder: 'Search tasks or notes…', attr: { 'aria-label': 'Search tasks or notes' } });
    search.value = this.query;
    search.addEventListener('input', () => { this.query = search.value; this.renderResults(); });
    const controls = page.createDiv({ cls: 'obsicheck-filters', attr: { role: 'group', 'aria-label': 'Filter tasks' } });
    this.filterButtons.clear();
    for (const [filter, label] of filters) {
      const button = controls.createEl('button', { cls: 'obsicheck-filter', attr: { 'aria-pressed': String(this.filter === filter) } });
      button.createSpan({ text: label });
      const count = button.createSpan({ cls: 'obsicheck-filter-count' });
      button.addEventListener('click', () => { this.filter = filter; this.renderResults(); });
      this.filterButtons.set(filter, { button, count });
    }
    this.hint = page.createDiv({ cls: 'obsicheck-hint' });
    this.results = page.createDiv({ cls: 'obsicheck-results' });
    const listener = () => {
      if (this.timer !== undefined) return;
      this.timer = window.setTimeout(() => { this.timer = undefined; this.renderResults(); }, 80);
    };
    this.plugin.listeners.add(listener);
    this.unsubscribe = () => this.plugin.listeners.delete(listener);
    this.renderResults();
  }

  async onClose() {
    this.unsubscribe();
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private iconButton(parent: HTMLElement, icon: string, label: string, cls = '') {
    const button = parent.createEl('button', { cls: `obsicheck-icon-button ${cls}`, attr: { 'aria-label': label, title: label } });
    setIcon(button, icon);
    return button;
  }

  private renderResults() {
    const active = this.contentEl.ownerDocument.activeElement as HTMLElement | null;
    const oldControls = Array.from(this.results.querySelectorAll<HTMLElement>('[data-task-control]'));
    const oldIndex = active ? oldControls.indexOf(active) : -1;
    const focusKey = oldIndex >= 0 ? active?.dataset.taskControl : undefined;
    const snapshots = new Map(this.plugin.entries);
    const all = [...snapshots.values()].flatMap(entry => entry.tasks);
    const open = all.filter(task => matchesFilter(task, 'open'));
    const noteCount = new Set(open.map(task => task.path)).size;
    this.summary.setText(`${open.length} open ${open.length === 1 ? 'task' : 'tasks'} across ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`);
    for (const [filter, { button, count }] of this.filterButtons) {
      button.setAttribute('aria-pressed', String(filter === this.filter));
      count.setText(String(all.filter(task => matchesFilter(task, filter)).length));
    }
    this.hint.setText(this.filter === 'dismissed' ? 'Set aside for good. Restore a task whenever you change your mind.' : 'Click a task to open its note. Dismiss anything you no longer plan to do.');
    this.results.empty();
    if (this.plugin.failures.size) this.results.createEl('p', { cls: 'obsicheck-warning', text: `Could not read ${this.plugin.failures.size} notes. Try refreshing the list.` });
    const query = this.query.trim().toLocaleLowerCase();
    const tasks = all.filter(task => matchesFilter(task, this.filter) && `${task.text} ${task.path}`.toLocaleLowerCase().includes(query));
    tasks.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
    if (!tasks.length) {
      const empty = this.results.createDiv({ cls: 'obsicheck-empty' });
      const icon = empty.createDiv({ cls: 'obsicheck-empty-icon', attr: { 'aria-hidden': 'true' } });
      setIcon(icon, query ? 'search' : this.filter === 'dismissed' ? 'archive' : 'list-checks');
      const [title, description] = !this.plugin.ready ? ['Loading tasks…', 'Gathering checkboxes from your notes.']
        : query ? ['No matching tasks', 'Try a different search or another filter.']
        : this.filter === 'dismissed' ? ['Nothing dismissed', 'Use the × next to a task to set it aside without completing it.']
        : this.filter === 'done' ? ['No completed tasks yet', 'Check off a task here or in its original note.']
        : this.filter === 'open' && all.length ? ['You’re all caught up', 'New tasks from your notes will appear here.']
        : ['A clear place for your tasks', 'Add a checkbox with - [ ] in any note to get started.'];
      empty.createEl('h3', { text: title });
      empty.createEl('p', { text: description });
    }
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
      const group = groups.get(task.path) ?? [];
      group.push(task);
      groups.set(task.path, group);
    }
    for (const [path, groupTasks] of groups) {
      const group = this.results.createEl('section', { cls: 'obsicheck-group' });
      const heading = group.createDiv({ cls: 'obsicheck-group-heading' });
      const title = heading.createEl('h3');
      const link = title.createEl('button', { cls: 'obsicheck-source', attr: { title: path } });
      const icon = link.createSpan({ cls: 'obsicheck-note-icon', attr: { 'aria-hidden': 'true' } });
      setIcon(icon, 'file-text');
      link.createSpan({ text: path.split('/').pop()!.replace(/\.md$/, '') });
      link.addEventListener('click', () => { void this.openTask(groupTasks[0]); });
      heading.createSpan({ cls: 'obsicheck-group-count', text: String(groupTasks.length) });
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (folder) group.createDiv({ cls: 'obsicheck-folder', text: folder });
      const list = group.createEl('ul', { cls: 'obsicheck-task-list' });
      for (const task of groupTasks) {
        const row = list.createEl('li', { cls: `obsicheck-task${task.completed ? ' is-complete' : ''}${task.dismissed ? ' is-dismissed' : ''}` });
        const key = JSON.stringify([task.path, task.line]);
        const source = snapshots.get(task.path)!.source;
        const name = task.text.trim() || 'Untitled task';
        if (task.dismissed) {
          const icon = row.createSpan({ cls: 'obsicheck-dismissed-icon', attr: { 'aria-label': 'Dismissed' } });
          setIcon(icon, 'circle-minus');
        } else {
          const input = row.createEl('input', { type: 'checkbox', cls: 'obsicheck-checkbox', attr: { 'aria-label': `${task.completed ? 'Reopen' : 'Complete'}: ${name}`, 'data-task-control': key + ':check' } });
          input.checked = task.completed;
          input.addEventListener('change', async () => {
            input.disabled = true;
            try {
              const saved = await this.plugin.setCompleted(task, input.checked, source);
              if (!saved) input.checked = task.completed;
            } finally { input.disabled = false; }
          });
        }
        const text = row.createEl('button', { cls: 'obsicheck-task-text', text: name, attr: { title: `Open ${task.path}, line ${task.line + 1}`, 'data-task-control': key + ':open' } });
        text.addEventListener('click', () => { void this.openTask(task); });
        const actions = row.createDiv({ cls: 'obsicheck-task-actions' });
        if (task.status !== ' ' && !task.completed) actions.createSpan({ cls: 'obsicheck-status', text: `[${task.status}]` });
        const action = this.iconButton(actions, task.dismissed ? 'undo-2' : 'x', `${task.dismissed ? 'Restore' : 'Dismiss'}: ${name}`, task.dismissed ? 'obsicheck-restore' : 'obsicheck-dismiss');
        action.dataset.taskControl = key + ':dismiss';
        if (task.dismissed) action.createSpan({ text: 'Restore' });
        action.addEventListener('click', async () => {
          action.disabled = true;
          try { await this.plugin.setDismissed(task, !task.dismissed, source); }
          finally { action.disabled = false; }
        });
      }
    }
    if (focusKey) {
      const controls = Array.from(this.results.querySelectorAll<HTMLElement>('[data-task-control]'));
      const target = controls.find(control => control.dataset.taskControl === focusKey) ?? controls[Math.min(oldIndex, controls.length - 1)];
      (target ?? this.filterButtons.get(this.filter)?.button)?.focus({ preventScroll: true });
    }
  }

  private async openTask(task: Task) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) { new Notice('The source note is no longer available.'); return; }
    try { await this.app.workspace.getLeaf('tab').openFile(file, { eState: { line: task.line } }); }
    catch { new Notice('Could not open the source note.'); }
  }
}
