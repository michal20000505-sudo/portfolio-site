// Mobilne zrzuty stron do sceny "strony www": 390×844 CSS px, DPR 2.
// Przewijamy kafelkami (żeby animacje "reveal" się odpaliły i żeby 100vh nie rozjechało układu),
// od drugiego kafelka ukrywamy elementy fixed/sticky, potem sklejamy w Pythonie (stitch.py).
// node capture_sites.js  → assets/mobile/<nazwa>_<k>.png
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const SITES = [
  ['sscar', 'https://sscar.pl'],
  ['bodycreator', 'https://bodycreator.com.pl'],
  ['handybruk', 'https://www.handybruk.pl'],
  ['rmax', 'https://michal20000505-sudo.github.io/R-MAX-auto/index.html'],
  ['mjaro', 'https://m-jaro.pl'],
];
const VW = 390, VH = 844, TILES = 4;

(async () => {
  fs.mkdirSync('assets/mobile', { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  for (const [name, url] of SITES) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) { console.log(name, 'goto:', e.message); }
    await new Promise(r => setTimeout(r, 2500));
    // banery cookies
    await page.evaluate(() => {
      const words = ['akceptuj', 'zgadzam', 'accept', 'rozumiem', 'ok', 'zamknij', 'przejdź'];
      for (const b of document.querySelectorAll('button, a, [role=button]')) {
        const t = (b.innerText || '').trim().toLowerCase();
        if (t && t.length < 40 && words.some(w => t.startsWith(w))) { try { b.click(); } catch (e) {} }
      }
    });
    // przejazd po całej stronie, żeby odpalić lazy-load i animacje wejścia
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(docH, VH * (TILES + 1)); y += 250) {
      await page.evaluate(yy => window.scrollTo(0, yy), y);
      await new Promise(r => setTimeout(r, 140));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1500));
    for (let k = 0; k < TILES; k++) {
      await page.evaluate(yy => window.scrollTo(0, yy), k * VH);
      await new Promise(r => setTimeout(r, 900));
      if (k === 1) {
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('body *')) {
            const p = getComputedStyle(el).position;
            if (p === 'fixed' || p === 'sticky') el.style.visibility = 'hidden';
          }
        });
        await new Promise(r => setTimeout(r, 200));
      }
      const realY = await page.evaluate(() => window.scrollY);
      await page.screenshot({ path: `assets/mobile/${name}_${k}.png` });
      console.log(name, 'tile', k, 'scrollY', realY, 'docH', docH);
    }
    await page.close();
  }
  await browser.close();
})();
