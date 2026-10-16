import { rm, mkdir, cp, copyFile } from 'node:fs/promises';
const out=process.env.APPDEPLOY_VITE_OUT_DIR || 'dist';
if(out==='.' || out==='/' || out.includes('..')) throw new Error('Unsafe output directory');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await copyFile('index.html',`${out}/index.html`);
await cp('src',`${out}/src`,{recursive:true});
await cp('public',`${out}/public`,{recursive:true});
console.log(`Static build ready in ${out}/ (no runtime dependencies).`);
