// Local dev server for the portal. Zero dependencies — Node built-ins only.
// Run: node serve.js [port]
//
// Two reasons this file exists instead of just opening index.html:
//   1. Service workers refuse to run from file:// — offline support would
//      silently do nothing.
//   2. It serves the LAN address too, so the real Android phone can load the
//      portal during development without deploying.
//
// Everything is sent with Cache-Control: no-store. Stale caches during
// development are the classic way to lose an hour wondering why an edit
// "didn't work".

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, must-revalidate',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }

  let filePath = path.join(ROOT, urlPath);
  // Refuse anything that resolves outside the project folder.
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
    return send(res, 403, 'Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`  404  ${urlPath}`);
      return send(res, 404, `Not found: ${urlPath}`);
    }
    console.log(`  200  ${urlPath}`);
    send(res, 200, data, TYPES[path.extname(filePath).toLowerCase()]);
  });
});

function lanAddress() {
  for (const nics of Object.values(os.networkInterfaces())) {
    for (const nic of nics || []) {
      if (nic.family === 'IPv4' && !nic.internal) return nic.address;
    }
  }
  return null;
}

server.listen(PORT, () => {
  const lan = lanAddress();
  console.log('');
  console.log("  Dad's Games — dev server");
  console.log(`  This computer:  http://localhost:${PORT}`);
  if (lan) console.log(`  Phone on wifi:  http://${lan}:${PORT}`);
  console.log('');
  console.log('  Note: service workers need https or localhost, so offline mode');
  console.log('  will not register over the LAN address. Test offline behavior');
  console.log('  on the deployed GitHub Pages site, or via chrome://inspect');
  console.log('  port forwarding. Everything else works fine over wifi.');
  console.log('');
  console.log('  Ctrl+C to stop.');
  console.log('');
});
