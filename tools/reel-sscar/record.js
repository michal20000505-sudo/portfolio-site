// node record.js stills 0.2 1.5 ...        → stills/t<czas>.png (podgląd pojedynczych klatek)
// node record.js strip 7.0 8.2 12          → stills/strip_*.png (seria klatek z odcinka, do sprawdzania przejść)
// node record.js video [fps] [sub] [out]   → MP4 z dźwiękiem (domyślnie 60 fps, 6 subklatek motion blur)
// node record.js draft                     → szybki podgląd 30 fps, bez motion blur, 540×960
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
const { start } = require('./serve');

const [mode = 'stills', ...args] = process.argv.slice(2);

(async () => {
  const srv = await start();
  const url = `http://127.0.0.1:${srv.address().port}/tools/reel-sscar/reel.html?record`;
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--force-device-scale-factor=1', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage();
  page.on('console', m => { const s = m.text(); if (!s.includes('favicon')) console.log('[page]', s); });
  page.on('pageerror', async e => { console.log('[err]', e.message); await browser.close(); srv.close(); process.exit(1); });
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  const clip = { x: 0, y: 0, width: 1080, height: 1920 };
  fs.mkdirSync('stills', { recursive: true });

  if (mode === 'stills') {
    for (const s of args) {
      const t0 = Date.now();
      await page.evaluate(t => renderAt(t), parseFloat(s));
      await page.screenshot({ path: `stills/t${s}.png`, clip });
      console.log('still', s, Date.now() - t0, 'ms');
    }
  } else if (mode === 'strip') {
    const [a, b, n] = args.map(parseFloat);
    for (let i = 0; i < n; i++) {
      const t = a + (b - a) * i / (n - 1);
      await page.evaluate(tt => renderAt(tt), t);
      await page.screenshot({ path: `stills/strip_${String(i).padStart(2, '0')}.png`, clip });
    }
  } else {
    const draft = mode === 'draft';
    const FPS = draft ? 30 : parseInt(args[0] || '60');
    const SUB = draft ? 1 : parseInt(args[1] || '6');
    const out = draft ? 'draft.mp4' : (args[2] || 'reel.mp4');
    const from = parseFloat(process.env.FROM || '0'), to = parseFloat(process.env.TO || '38');
    const vf = draft ? 'scale=540:960:flags=lanczos,format=yuv420p' : 'format=yuv420p';
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-ss', String(from), '-i', 'music.wav',
      '-vf', vf, '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '23' : '14', '-profile:v', 'high', '-tune', 'grain',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
    for (let f = f0; f < f1; f++) {
      await page.evaluate((ff_, fps, sub) => renderFrame(ff_, fps, sub, 0.5), f, FPS, SUB);
      const buf = await page.screenshot({ type: 'png', clip, optimizeForSpeed: true });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % FPS === 0) console.log(`klatka ${f}/${f1}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('gotowe', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  await browser.close();
  srv.close();
})();
