// Removes `/* turbopackIgnore: true */` from the lazy loader Stencil emits.
//
// Since @stencil/core 4.45.5 the lazy loader's
// `import(`./${bundleId}.entry.js`)` carries that comment. It tells Turbopack
// (Next.js's bundler) to leave the import alone, so an app that bundles this
// package with Turbopack never emits the `*.entry.js` component chunks. At
// runtime the browser then requests them next to the app's own chunks
// (`/_next/static/chunks/phirepass-terminal.entry.js`) and gets a 404.
// Without the comment Turbopack bundles them, the same way webpack does through
// the `webpackInclude` comment next to it.
//
// Runs after every `stencil build`. It changes nothing if Stencil stops
// emitting the comment.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const roots = ['dist', 'loader'].map((dir) => resolve(dir));
const HINT = /[ \t]*\/\*\s*turbopackIgnore:\s*true\s*\*\/[ \t]*\r?\n?/g;

function* jsFiles(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            yield* jsFiles(path);
        } else if (/\.(c|m)?js$/.test(name)) {
            yield path;
        }
    }
}

let patched = 0;
for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of jsFiles(root)) {
        const src = readFileSync(file, 'utf8');
        const out = src.replace(HINT, '');
        if (out !== src) {
            writeFileSync(file, out);
            patched++;
        }
    }
}

console.log(`[build] Removed turbopackIgnore from ${patched} file(s).`);
