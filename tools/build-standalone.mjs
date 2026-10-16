/** Build a single offline-capable HTML, using only Node built-ins. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
let javascript = '';
// Explicit dependency order for this small, closed module graph (not a general-purpose JS bundler).
for (const name of ['math', 'forest', 'shaders', 'scene', 'art', 'app']) {
  const source = await readFile(path.join(root, `src/${name}.js`), 'utf8');
  javascript += `\n// ----- src/${name}.js -----\n` + source
    .replace(/^import .*?;\n/gm, '')
    .replace(/^export /gm, '');
  if (name === 'shaders') {
    javascript += '\nconst shaders = { fullscreenVertex, environmentFragment, barkVertex, leafVertex, barkFragment, leafFragment };\n';
  }
}
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">\n${javascript}\n</script>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist', 'standalone.html'), html);
console.log(`Built dist/standalone.html (${Buffer.byteLength(html).toLocaleString()} bytes; no runtime network requests).`);
