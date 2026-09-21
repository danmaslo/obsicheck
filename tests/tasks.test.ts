import assert from 'node:assert/strict';
import test from 'node:test';
import { collectTasks, StaleTaskError, updateTask } from '../src/tasks';

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
