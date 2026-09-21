import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['tests/ui/harness.js'], bundle: true, write: false, format: 'esm', alias: { obsidian: './tests/ui/obsidian.js' } });
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Obsicheck UI test</title><style>
* {box-sizing:border-box} body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;background:var(--background-primary);color:var(--text-normal)}
:root{--background-primary:#fff;--background-secondary:#f4f4f5;--background-modifier-border:#e8e8ec;--background-modifier-hover:#f5f5f8;--text-normal:#24242b;--text-muted:#777780;--text-faint:#9999a4;--text-accent:#7654ce;--interactive-accent:#8861db;--text-warning:#b77421;--font-ui-small:13px;--font-ui-smaller:12px;--font-ui-medium:14px}
.theme-dark{--background-primary:#1e1e20;--background-secondary:#2c2c30;--background-modifier-border:#343438;--background-modifier-hover:#29292e;--text-normal:#dedee3;--text-muted:#9999a5;--text-faint:#777781;--text-accent:#b39aee;--interactive-accent:#aa86ef}
button{display:flex;align-items:center;justify-content:center;font:inherit}input{font:inherit;color:inherit}input[type=checkbox]{accent-color:var(--interactive-accent)}
</style><link rel="stylesheet" href="/styles.css"><body><main id="view"></main><script type="module" src="/harness.js"></script></body></html>`;
createServer(async (request, response) => {
  const css = request.url === '/styles.css';
  const js = request.url === '/harness.js';
  response.setHeader('Content-Type', css ? 'text/css' : js ? 'text/javascript' : 'text/html');
  response.end(css ? await readFile('styles.css') : js ? result.outputFiles[0].text : html);
}).listen(4178, '127.0.0.1');
