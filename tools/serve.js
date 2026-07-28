#!/usr/bin/env node
/**
 * Zero-dependency static dev server.
 *
 * The game ships as plain ES modules so GitHub Pages can serve the repository
 * directly, but `file://` blocks module imports. This server exists purely so
 * `npm run serve` gives the same environment as production.
 */

import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
    const target = path.join(ROOT, rel);
    // Refuse to serve outside the repository.
    if (!target.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`Not found: ${rel}`);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(target).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Office Isaac dev server: http://localhost:${PORT}/\n`);
});
