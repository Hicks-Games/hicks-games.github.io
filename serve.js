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

// Machines have several addresses (wifi, ethernet, VPN, Bluetooth), and the
// first one Node reports is often not the one the phone can reach. Rank the
// real private LAN ranges first, list them all, and let the human pick.
function lanAddresses() {
  const found = [];
  for (const [name, nics] of Object.entries(os.networkInterfaces())) {
    for (const nic of nics || []) {
      if (nic.family !== 'IPv4' || nic.internal) continue;
      const a = nic.address;
      // 169.254.x.x is link-local: the address a NIC invents when it has no
      // network. Never reachable from the phone.
      if (a.startsWith('169.254.')) continue;
      const isPrivateLan =
        a.startsWith('192.168.') ||
        a.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(a);
      found.push({ address: a, name, rank: isPrivateLan ? 0 : 1 });
    }
  }
  return found.sort((x, y) => x.rank - y.rank);
}

server.listen(PORT, () => {
  console.log('');
  console.log("  Dad's Games — dev server");
  console.log(`  This computer:  http://localhost:${PORT}`);
  const nets = lanAddresses();
  if (nets.length) {
    console.log('  Phone on wifi:  ' + `http://${nets[0].address}:${PORT}` +
      `   (${nets[0].name})`);
    for (const n of nets.slice(1)) {
      console.log(`                  http://${n.address}:${PORT}   (${n.name})`);
    }
  }
  console.log('');
  console.log('  Note: service workers need https or localhost, so offline mode');
  console.log('  will not register over the LAN address. Test offline behavior');
  console.log('  on the deployed GitHub Pages site, or via chrome://inspect');
  console.log('  port forwarding. Everything else works fine over wifi.');
  console.log('');
  console.log('  Ctrl+C to stop.');
  console.log('');
});
