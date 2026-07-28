#!/usr/bin/env node
/**
 * Zero-dependency static dev server.
 *
 * The game ships as plain ES modules so GitHub Pages can serve the repository
 * directly, but `file://` blocks module imports. This server exists purely so
 * `npm run serve` gives the same environment as production.
 *
 * Robustness notes, all learned the hard way on Windows:
 *
 *  - It binds `::` (dual-stack) rather than a single family. On this machine
 *    `localhost` resolves to `::1` *before* `127.0.0.1`, so a v4-only bind would
 *    give a browser "connection refused" while curl over v4 happily succeeded.
 *  - A busy port advances to the next free one instead of dying, and reports the
 *    port it actually got.
 *  - It prints both hostnames, because whichever one the browser resolves first
 *    is not something this script gets to decide.
 */

import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PORT = Number(process.env.PORT || 8123);
const MAX_PORT_TRIES = 12;

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
  const started = Date.now();
  let status = 200;
  let rel = req.url;
  try {
    const url = new URL(req.url, 'http://localhost');
    rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
    const target = path.join(ROOT, rel);
    // Refuse to serve outside the repository.
    if (!target.startsWith(ROOT)) {
      status = 403;
      res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
      return;
    }
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isFile()) {
      status = 404;
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`Not found: ${rel}`);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(target).pipe(res);
  } catch (err) {
    status = 500;
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
  } finally {
    // A request log makes "the page is blank" debuggable: a 404 on a content
    // module is the single most likely cause and shows up immediately here.
    if (status !== 200) {
      process.stdout.write(`  ${status}  ${rel}  (${Date.now() - started}ms)\n`);
    }
  }
});

let attempt = 0;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_TRIES) {
    attempt += 1;
    server.listen(BASE_PORT + attempt, '::');
    return;
  }
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(
      `Ports ${BASE_PORT}-${BASE_PORT + MAX_PORT_TRIES} are all busy. `
      + 'Set PORT=<free port> and retry.\n',
    );
    process.exit(1);
  }
  if (err.code === 'EAFNOSUPPORT' || err.code === 'EINVAL') {
    // No IPv6 on this host: fall back to all IPv4 interfaces.
    server.listen(BASE_PORT + attempt, '0.0.0.0');
    return;
  }
  throw err;
});

server.on('listening', () => {
  const port = server.address().port;
  process.stdout.write(
    `\nOffice Isaac dev server is running.\n\n`
    + `  http://localhost:${port}/\n`
    + `  http://127.0.0.1:${port}/\n\n`
    + 'Leave this process running while you play. Ctrl+C stops it.\n'
    + 'Only non-200 requests are logged below.\n\n',
  );
});

server.listen(BASE_PORT, '::');
