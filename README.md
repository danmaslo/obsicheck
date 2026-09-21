# Obsicheck

A quiet home for the checkboxes scattered across your Obsidian vault. Review, complete, or dismiss tasks without moving them out of their notes.

- **One overview:** tasks grouped by note, in their original order.
- **Quick filters:** Open, Completed, All, and Dismissed, with live counts.
- **Dismiss and restore:** set aside tasks you no longer plan to do without marking them complete.
- **Search:** find tasks by their text or the source note's path.
- **Edit in place:** check off a task here and its original checkbox updates.
- **Jump to the source:** click a task to open its note at the relevant line.
- **Automatic updates:** follows note edits, creation, deletion, and renames.
- **Native appearance:** left-aligned layout, light and dark theme colors, and narrow-panel support.

The interface is in English. No network requests or external services are used by the plugin.

## Install with BRAT

1. In BRAT settings, select **Add beta plugin**.
2. Enter `danmaslo/obsicheck` or `https://github.com/danmaslo/obsicheck`.
3. Select the latest version and add the plugin.
4. Run **Obsicheck: Open task overview** from the command palette, or click the checklist icon in the ribbon.

Use BRAT to check for updates. Release files are available in [GitHub Releases](https://github.com/danmaslo/obsicheck/releases).

## Dismiss tasks

Click the **×** to the right of a task to dismiss it. Dismissed tasks disappear from Open, Completed, and All; find them in **Dismissed** and click **Restore** to bring them back. Completion and dismissal are separate: dismissing an open task leaves its checkbox unchecked, and restoring it returns it to Open.

Dismissal adds a hidden HTML comment to the task's source line:

```markdown
- [ ] An idea I no longer plan to pursue <!-- obsicheck:dismissed -->
```

The marker is visible in Markdown source but hidden in rendered notes. It travels with the task through note edits, renames, and vault sync. Restoring removes the marker; you can also remove it manually. Existing block IDs (`^my-task`) stay at the end of the line.

## Manual installation

1. Download the ZIP from the [latest release](https://github.com/danmaslo/obsicheck/releases/latest).
2. Extract it into `<vault>/.obsidian/plugins/`. The resulting `obsicheck` folder should contain `main.js`, `manifest.json`, and `styles.css`.
3. Reload Obsidian and enable **Obsicheck** in **Settings → Community plugins**. Restricted mode must be off to use community plugins.

## Behavior

- Scans Markdown notes in the current vault. No tags or special folders are required.
- Uses Obsidian's Markdown cache to identify actual task list items, excluding examples inside code blocks.
- `[x]` and `[X]` mean completed. Custom statuses such as `[/]` remain open and show their original marker. Completing writes `[x]`; reopening writes `[ ]`.
- Task text is displayed as plain text, including Markdown syntax. Clicking it opens the source note; embedded links are not separately clickable.
- If the source note changes before a write, the plugin refuses the stale edit, refreshes the list, and asks you to try again. Other content and line endings are preserved.
- Changes from outside the overview appear once Obsidian has updated its Markdown cache.

## Development

```sh
npm ci
npm run dev
```

Build and run task tests:

```sh
npm run build
npm test
```

Run browser UI tests:

```sh
npx playwright install chromium
npm run test:ui
```

The browser harness runs the real plugin mutation methods and view against a small mock of the Obsidian API. It checks dismissal, restoration, completion, source navigation, stale edits, search, and narrow layouts. It also captures light/dark screenshots in `test-results/`. This does not replace testing inside Obsidian with real themes and Markdown cache events.

For local installation, copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/obsicheck/` after building.

### Manual checks in Obsidian

1. Create two notes with open, completed, nested, and custom-status tasks; add a checkbox example inside a fenced code block.
2. Check grouping, search, and all four filters. The code example must not appear.
3. Complete a task and reopen it. Verify the original Markdown changes.
4. Dismiss one of two identical tasks. Only that task should disappear. Reload the plugin and restore it from Dismissed.
5. Rename a note and its folder, add lines above a dismissed task, and edit the task text. Dismissal should persist.
6. Try a narrow panel and both light and dark themes. Check keyboard focus and long task titles.

Built using the [official plugin sample](https://github.com/obsidianmd/obsidian-sample-plugin) and [Vault.process()](https://docs.obsidian.md/Plugins/Vault) for safe source edits.
