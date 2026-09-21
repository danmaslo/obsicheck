import assert from 'node:assert/strict';
import test from 'node:test';
import { collectTasks, StaleTaskError, updateTask, updateDismissal, matchesFilter } from '../src/tasks';

const location = (line: number, task: string | undefined = ' ') => ({ task, position: { start: { line } } });

test('collects unordered, numbered, nested, quoted and custom-status tasks', () => {
  const source = ['- [ ] První', '  * [x] Hotovo', '1. [X] Taky hotovo', '> - [/] Probíhá', '\t+ [ ] Vnořený', '2) [ ] Další', '- [ ]'].join('\n');
  const tasks = collectTasks('note.md', source, source.split('\n').map((_, line) => location(line)));
  assert.equal(tasks.length, 7);
  assert.deepEqual(tasks.map(task => task.completed), [false, true, true, false, false, false, false]);
  assert.equal(tasks[3].status, '/');
  assert.equal(tasks[6].text, '');
});

test('only collects task positions supplied by the Markdown cache', () => {
  const source = '---\nexample: - [ ] property\n---\n```md\n- [ ] example\n```\n- ordinary list\n- [ ] Real task\n%%\n- [ ] hidden\n%%';
  const items = [{ position: { start: { line: 6 } } }, location(7)];
  assert.deepEqual(collectTasks('note.md', source, items).map(task => task.text), ['Real task']);
});

test('ignores obsolete or invalid cached positions', () => {
  assert.deepEqual(collectTasks('note.md', '# Heading\n- [ ]Missing space', [location(0), location(1), location(99)]), []);
});

for (const newline of ['\n', '\r\n', '\r']) {
  test(`toggles exactly one character and preserves ${JSON.stringify(newline)} line endings`, () => {
    const source = ['# Heading', '- [ ] Same', '- [ ] Same', '  > 3. [X] **Done**  ', ''].join(newline);
    const tasks = collectTasks('note.md', source, [location(1), location(2), location(3, 'X')]);
    assert.equal(updateTask(source, source, tasks[1], true), ['# Heading', '- [ ] Same', '- [x] Same', '  > 3. [X] **Done**  ', ''].join(newline));
    assert.equal(updateTask(source, source, tasks[2], false), source.replace('[X]', '[ ]'));
  });
}

test('refuses a stale snapshot even when an identical task occupies its old line', () => {
  const source = '- [ ] Same\n- [ ] Another';
  const task = collectTasks('note.md', source, [location(0)])[0];
  assert.throws(() => updateTask('- [ ] Same\n' + source, source, task, true), StaleTaskError);
});

test('refuses a changed task identity or status', () => {
  const source = '- [ ] Original';
  const task = collectTasks('note.md', source, [location(0)])[0];
  assert.throws(() => updateTask(source, source, { ...task, text: 'Different' }, true), StaleTaskError);
  assert.throws(() => updateTask(source, source, { ...task, status: 'x' }, true), StaleTaskError);
});

test('preserves custom status text, Unicode, indentation and absent trailing newline', () => {
  const source = '\t- [/] Vyřešit [[Poznámka]] 🧠 #úkol';
  const task = collectTasks('note.md', source, [location(0, '/')])[0];
  assert.equal(updateTask(source, source, task, true), '\t- [x] Vyřešit [[Poznámka]] 🧠 #úkol');
});

for (const newline of ['\n', '\r\n', '\r']) {
  test(`dismiss and restore preserve source bytes with ${JSON.stringify(newline)}`, () => {
    const source = ['# Tasks', '  > - [/] Same task  ', '- [ ] Same task', ''].join(newline);
    const task = collectTasks('note.md', source, [location(1), location(2)])[0];
    const dismissed = updateDismissal(source, source, task, true);
    assert.equal(dismissed, source.replace('Same task  ', 'Same task <!-- obsicheck:dismissed -->  '));
    const parsed = collectTasks('note.md', dismissed, [location(1), location(2)]);
    assert.equal(parsed[0].dismissed, true);
    assert.equal(parsed[0].completed, false);
    assert.equal(parsed[0].text, task.text);
    assert.equal(parsed[1].dismissed, false);
    assert.equal(updateDismissal(dismissed, dismissed, parsed[0], false), source);
  });
}

test('dismissal follows a task when its file is renamed and preceding lines change', () => {
  const source = '- [ ] Keep this';
  const task = collectTasks('old.md', source, [location(0)])[0];
  const dismissed = updateDismissal(source, source, task, true);
  const moved = collectTasks('Folder/renamed.md', '# New heading\n' + dismissed, [location(1)])[0];
  assert.equal(moved.dismissed, true);
  assert.equal(moved.text, 'Keep this');
});

test('dismissed tasks have their own filter, separate from completed and all', () => {
  const source = '- [ ] Open\n- [x] Done\n- [ ] Ignored <!-- obsicheck:dismissed -->\n- [X] Also ignored <!-- obsicheck:dismissed -->';
  const tasks = collectTasks('note.md', source, [0, 1, 2, 3].map(line => location(line)));
  assert.deepEqual(tasks.filter(task => matchesFilter(task, 'open')).map(task => task.text), ['Open']);
  assert.deepEqual(tasks.filter(task => matchesFilter(task, 'done')).map(task => task.text), ['Done']);
  assert.equal(tasks.filter(task => matchesFilter(task, 'all')).length, 2);
  assert.equal(tasks.filter(task => matchesFilter(task, 'dismissed')).length, 2);
});

test('dismissal refuses stale snapshots and is idempotent', () => {
  const source = '- [ ] Duplicate\n- [ ] Duplicate';
  const task = collectTasks('note.md', source, [location(1)])[0];
  assert.throws(() => updateDismissal('# Heading\n' + source, source, task, true), StaleTaskError);
  const changed = updateDismissal(source, source, task, true);
  const dismissed = collectTasks('note.md', changed, [location(1)])[0];
  assert.equal(updateDismissal(changed, changed, dismissed, true), changed);
  assert.equal(updateTask(changed, changed, dismissed, true), changed.replace('- [ ] Duplicate <!--', '- [x] Duplicate <!--'));
});

test('empty checkboxes can be dismissed and restored', () => {
  for (const source of ['- [ ]', '- [ ]   ', '- [x]\n']) {
    const task = collectTasks('note.md', source, [location(0)])[0];
    const changed = updateDismissal(source, source, task, true);
    const dismissed = collectTasks('note.md', changed, [location(0)])[0];
    assert.equal(dismissed.dismissed, true);
    assert.equal(updateDismissal(changed, changed, dismissed, false), source);
  }
});

test('dismissal preserves Obsidian block references at the end of the line', () => {
  const source = '- [ ] Linked task ^my-task  \n';
  const task = collectTasks('note.md', source, [location(0)])[0];
  const changed = updateDismissal(source, source, task, true);
  assert.equal(changed, '- [ ] Linked task <!-- obsicheck:dismissed --> ^my-task  \n');
  const dismissed = collectTasks('note.md', changed, [location(0)])[0];
  assert.equal(dismissed.text, task.text);
  assert.equal(dismissed.dismissed, true);
  assert.equal(updateDismissal(changed, changed, dismissed, false), source);
});
