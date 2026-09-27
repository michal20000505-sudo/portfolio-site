// Minimalny serwer statyczny (moduły ES + three.js nie działają z file://).
// Serwuje katalog główny repo, żeby strony mogły sięgać do ../../fonts, ../../models itd.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp4': 'video/mp4' };
function start(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { resp.writeHead(403); return resp.end(); }
      fs.readFile(p, (err, data) => {
        if (err) { resp.writeHead(404); return resp.end('404'); }
        resp.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        resp.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}
module.exports = { start };
if (require.main === module) {
  start(parseInt(process.argv[2] || '8137')).then(s => console.log(`http://127.0.0.1:${s.address().port}/tools/reel/reel.html`));
}
