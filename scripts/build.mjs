import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles } from './files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const publicRoot = join(root, 'public');
const files = await publicFiles(publicRoot);
if (!files.some(([path]) => path === '/index.html')) throw new Error('public/index.html belum tersedia.');

// Embed a single self-contained Worker module including every public asset.
const resources = {};
for (const [path, type] of files) {
  const bytes = await readFile(join(publicRoot, path));
  resources[path] = [type, bytes.toString('base64')];
}
const seed = await readFile(join(root, 'server/seed.mjs'), 'utf8');
const apiSource = await readFile(join(root, 'server/api.mjs'), 'utf8');
const api = apiSource.replace(/^import\s*\{[^}]*\}\s*from\s*['"]\.\/seed\.mjs['"];?\s*$/m, '');
if (/^import\s/m.test(api)) throw new Error('Ada impor server tambahan yang belum disertakan dalam build.');
const dispatch = await readFile(join(root, 'server/dispatch.mjs'), 'utf8');
const worker = [
  seed.replace('export async function seedDemo', 'async function seedDemo'),
  api.replace('export async function handleApi', 'async function handleApi'),
  dispatch.replace('export async function dispatch', 'async function dispatch'),
  'const staticResources = ' + JSON.stringify(resources) + ';',
  `function embeddedAsset(path) {
    const resource = staticResources[path];
    if (!Object.hasOwn(staticResources, path)) return null;
    const binary = atob(resource[1]);
    return { type: resource[0], body: Uint8Array.from(binary, char => char.charCodeAt(0)) };
  }
  export default { fetch(request, env) {
    return dispatch(request, env, handleApi, embeddedAsset);
  } };`
].join('\n');
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await writeFile(join(dist, 'server/index.js'), worker);
await cp(join(root, 'drizzle'), join(dist, 'drizzle'), { recursive: true });
try {
  await mkdir(join(dist, '.openai'), { recursive: true });
  await cp(join(root, '.openai/hosting.json'), join(dist, '.openai/hosting.json'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Build selesai dengan ' + files.length + ' file publik.');
