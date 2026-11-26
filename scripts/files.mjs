import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8'
};

export async function publicFiles(root, prefix = '') {
  const files = [];
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue;
    const file = prefix + '/' + entry.name;
    if (entry.isDirectory()) files.push(...await publicFiles(root, file));
    if (entry.isFile()) files.push([file, mimeTypes[extname(file)] || 'application/octet-stream']);
  }
  return files;
}
