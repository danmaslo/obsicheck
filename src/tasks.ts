/** Obsidian's Markdown cache supplies real list items, excluding code and frontmatter. */
export interface TaskLocation {
  task?: string;
  position: { start: { line: number } };
}

export interface Task {
  path: string;
  line: number;
  text: string;
  status: string;
  completed: boolean;
  dismissed: boolean;
}

export type TaskFilter = 'open' | 'done' | 'dismissed' | 'all';
const checkbox = /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[)([^\]])(\])(?:[\t ]+(.*)|[\t ]*)$/;
const dismissalMarker = ' <!-- obsicheck:dismissed -->';
const dismissalSuffix = / ?<!-- obsicheck:dismissed -->(?=(?:[\t ]+\^[A-Za-z0-9-]+)?[\t ]*$)/;

function taskText(raw: string) {
  return { text: raw.replace(dismissalSuffix, ''), dismissed: dismissalSuffix.test(raw) };
}

export function collectTasks(path: string, source: string, locations: TaskLocation[]): Task[] {
  const lines = source.split(/\r\n|\n|\r/);
  const tasks: Task[] = [];
  for (const item of locations) {
    if (item.task === undefined) continue;
    const line = item.position.start.line;
    const match = checkbox.exec(lines[line] ?? '');
    if (!match) continue;
    tasks.push({ path, line, ...taskText(match[4] ?? ''), status: match[2], completed: /[xX]/.test(match[2]) });
  }
  return tasks;
}

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
  if (filter === 'dismissed') return task.dismissed;
  if (task.dismissed) return false;
  return filter === 'all' || task.completed === (filter === 'done');
}

export class StaleTaskError extends Error {
  constructor() {
    super('This note changed since the list was loaded. The list will refresh; please try again.');
  }
}

/** Never guess the location of a task after a concurrent edit. Preserve all other bytes. */
function editTask(source: string, expectedSource: string, task: Task, edit: (line: string, marker: number) => string): string {
  if (source !== expectedSource) throw new StaleTaskError();
  const parts = source.split(/(\r\n|\n|\r)/);
  const offset = task.line * 2;
  const original = parts[offset] ?? '';
  const match = checkbox.exec(original);
  const current = taskText(match?.[4] ?? '');
  if (!match || match[2] !== task.status || current.text !== task.text || current.dismissed !== task.dismissed) throw new StaleTaskError();
  parts[offset] = edit(original, match[1].length);
  return parts.join('');
}

export function updateTask(source: string, expectedSource: string, task: Task, completed: boolean): string {
  return editTask(source, expectedSource, task, (line, marker) => line.slice(0, marker) + (completed ? 'x' : ' ') + line.slice(marker + 1));
}

/** The hidden marker travels with the task through edits, renames and vault sync. */
export function updateDismissal(source: string, expectedSource: string, task: Task, dismissed: boolean): string {
  return editTask(source, expectedSource, task, line => {
    if (dismissed === task.dismissed) return line;
    if (!dismissed) return line.replace(dismissalSuffix, '');
    return line.replace(/(?:[\t ]+\^[A-Za-z0-9-]+)?[\t ]*$/, suffix => dismissalMarker + suffix);
  });
}
