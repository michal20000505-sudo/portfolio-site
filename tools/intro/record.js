// node record.js stills 0.3 1.2 ...   → klatki PNG do podglądu
// node record.js video                → intro.mp4 (60 fps, motion blur 4 subklatki, shutter 180°)
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [mode, ...rest] = process.argv.slice(2);
const url = 'file:///' + path.resolve(__dirname, 'intro.html').replace(/\\/g, '/') + '?record';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url);
  await page.waitForFunction('window.ready === true');
  const clip = { x: 0, y: 0, width: 1920, height: 1080 };

  if (mode === 'stills') {
    fs.mkdirSync('stills', { recursive: true });
    for (const s of rest) {
      await page.evaluate(t => render(t), parseFloat(s));
      await page.screenshot({ path: `stills/t${s}.png`, clip });
    }
  } else {
    const FPS = 60, SUB = 4, SHUT = 0.5, DUR = 5;
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
      '-i', 'music.wav',
      '-filter_complex', `[0:v]tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),format=yuv420p[v]`,
      '-map', '[v]', '-map', '1:a', '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'grain', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', 'intro.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    const frames = FPS * DUR;
    for (let f = 0; f < frames; f++) {
      for (let s = 0; s < SUB; s++) {
        const t = (f + (s / SUB - 0.5) * SHUT) / FPS;   // subklatki wyśrodkowane na czasie klatki
        await page.evaluate(tt => render(tt), Math.max(0, t));
        const buf = await page.screenshot({ type: 'png', clip, optimizeForSpeed: true });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if (f % 30 === 0) console.log(`klatka ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('gotowe', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  await browser.close();
})();
