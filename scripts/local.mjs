import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatch } from '../server/dispatch.mjs';
import { handleApi } from '../server/api.mjs';
import { openLocalDb } from './local-db.mjs';
import { publicFiles } from './files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = join(root, 'public');
const databasePath = process.env.MOTORA_DB ? resolve(process.env.MOTORA_DB) : join(root, '.data/motora.db');
const env = { DB: openLocalDb(databasePath, join(root, 'drizzle')) };
let files = new Map(await publicFiles(publicRoot));
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const port = Number(option('--port', process.env.PORT || 3000));
const host = option('--host', option('--hostname', '127.0.0.1'));
const server = createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method || 'GET';
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
      else if (value !== undefined) headers.set(key, value);
    }
    const origin = 'http://' + (headers.get('host') || 'localhost');
    const url = new URL(incoming.url || '/', origin);
    if (url.origin !== origin) { outgoing.writeHead(400).end(); return; }
    const options = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
      options.body = incoming;
      options.duplex = 'half';
    }
    const response = await dispatch(new Request(url, options), env, handleApi, async path => {
      if (!files.has(path)) files = new Map(await publicFiles(publicRoot));
      if (!files.has(path)) return null;
      return { type: files.get(path), body: await readFile(join(publicRoot, path)) };
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error.message);
    outgoing.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Gagal memproses permintaan.');
  }
});
server.listen(port, host, () => console.log('Buka http://' + host + ':' + server.address().port));
