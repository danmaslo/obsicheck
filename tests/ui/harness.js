import { TFile } from 'obsidian';
import ObsicheckPlugin from '../../src/main.ts';
import { TasksView } from '../../src/view.ts';
import { collectTasks } from '../../src/tasks.ts';

const initial = {
  'Projects/Website launch.md': '# Launch\n- [ ] Review the new homepage copy\n- [ ] Check the mobile layout and keyboard navigation before sharing the preview with the team\n- [x] Set up the project repository\n- [ ] Explore the old landing page concept <!-- obsicheck:dismissed -->',
  'Personal/Weekly plan.md': '- [ ] Book a dentist appointment\n- [ ] Pick up a package\n- [/] Plan the weekend trip',
  'Daily notes/2026-09-21.md': '- [ ] Send the meeting notes\n- [x] Clear out the inbox',
};
window.sources = JSON.parse(localStorage.getItem('notes') ?? 'null') ?? initial;
window.notices = [];
window.opened = [];
const files = new Map(Object.keys(window.sources).map(path => [path, new TFile(path)]));
const locations = source => source.split('\n').flatMap((line, index) => /^- \[.\]/.test(line) ? [{ task: line[3], position: { start: { line: index } } }] : []);
window.testApp = {
  vault: {
    getAbstractFileByPath: path => files.get(path),
    getMarkdownFiles: () => [...files.values()],
    cachedRead: async file => window.sources[file.path],
    process: async (file, transform) => {
      const updated = transform(window.sources[file.path]);
      window.sources[file.path] = updated;
      localStorage.setItem('notes', JSON.stringify(window.sources));
      return updated;
    },
  },
  metadataCache: { getFileCache: file => ({ listItems: locations(window.sources[file.path]) }) },
  workspace: { getLeaf: () => ({ openFile: async (file, options) => window.opened.push({ path: file.path, ...options }) }) },
};
const plugin = new ObsicheckPlugin();
window.plugin = plugin;
for (const [path, source] of Object.entries(window.sources)) plugin.entries.set(path, { source, tasks: collectTasks(path, source, locations(source)) });
plugin.ready = true;
const view = new TasksView({}, plugin);
await view.onOpen();
window.view = view;
