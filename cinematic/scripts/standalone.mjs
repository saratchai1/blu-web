import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as shaderExports from '../src/scene/shaders.js';

const files=['src/lib/math.js','src/scene/world.js','src/scene/shaders.js','src/scene/renderer.js','src/main.js'];
const chunks=[];
for(const path of files){
  let source=await readFile(path,'utf8');
  source=source.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
  if(path.endsWith('renderer.js')) source=`const shaders={${Object.keys(shaderExports).join(',')}};\n${source}`;
  chunks.push(source);
}
let html=await readFile('index.html','utf8');
let css=await readFile('src/styles.css','utf8');
const fallback=await readFile('public/fallback.svg','utf8');
const icon=await readFile('public/favicon.svg','utf8');
css=css.replace('../public/fallback.svg',`data:image/svg+xml,${encodeURIComponent(fallback).replace(/'/g,'%27')}`);
html=html.replace('<link rel="stylesheet" href="./src/styles.css">',`<style>${css}</style>`);
html=html.replace('./public/favicon.svg',`data:image/svg+xml,${encodeURIComponent(icon)}`);
html=html.replace('<script type="module" src="./src/main.js"></script>',`<script type="module">\n${chunks.join('\n')}\n</script>`);
await mkdir('dist',{recursive:true});
await writeFile('dist/mangrove.html',html);
console.log('Standalone offline website: dist/mangrove.html');
