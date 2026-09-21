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
}

const checkbox = /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[)([^\]])(\])(?:[\t ]+(.*)|[\t ]*)$/;

export function collectTasks(path: string, source: string, locations: TaskLocation[]): Task[] {
  const lines = source.split(/\r\n|\n|\r/);
  const tasks: Task[] = [];
  for (const item of locations) {
    if (item.task === undefined) continue;
    const line = item.position.start.line;
    const match = checkbox.exec(lines[line] ?? '');
    if (!match) continue;
    tasks.push({ path, line, text: match[4] ?? '', status: match[2], completed: /[xX]/.test(match[2]) });
  }
  return tasks;
}

export class StaleTaskError extends Error {
  constructor() {
    super('Poznámka se mezitím změnila. Přehled se obnoví; zkus úkol zaškrtnout znovu.');
  }
}

/** Never guess the location of a task after a concurrent edit. Preserve all other bytes. */
export function updateTask(source: string, expectedSource: string, task: Task, completed: boolean): string {
  if (source !== expectedSource) throw new StaleTaskError();
  const parts = source.split(/(\r\n|\n|\r)/);
  const offset = task.line * 2;
  const original = parts[offset] ?? '';
  const match = checkbox.exec(original);
  if (!match || match[2] !== task.status || (match[4] ?? '') !== task.text) throw new StaleTaskError();
  const marker = match[1].length;
  parts[offset] = original.slice(0, marker) + (completed ? 'x' : ' ') + original.slice(marker + 1);
  return parts.join('');
}
