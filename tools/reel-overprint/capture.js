// Zrzuty do reelsa → assets/cap/*.png (surowe, w .gitignore) — potem `python pack.py` robi z nich *.webp/*.jpg do repo.
//   strona portfolio (m-jaro.pl, widok mobilny 390 px, DPR 3): hero, pas od hero do karty OVERPRINT, nawigacja, gry.html
//   gra (lokalna kopia shooter.html): menu, karty poziomu, oferty sklepu, ekran końca z nickiem
// node capture.js [site|game]   (bez argumentu: oba)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');

const OUT = path.join(__dirname, 'assets', 'cap');
const LIVE = 'https://m-jaro.pl/';
const VW = 390, VH = 844, DPR = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const what = process.argv[2] || 'all';

async function mobile(browser, url) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('[err]', url, e.message));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// przejazd po stronie: lazy-load obrazków i animacje wejścia (.reveal)
async function walk(page, until) {
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(docH, until || docH); y += 300) { await page.evaluate(yy => window.scrollTo(0, yy), y); await sleep(120); }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.reveal')) el.classList.add('visible', 'active', 'revealed', 'in');
    for (const img of document.querySelectorAll('img[loading=lazy]')) img.loading = 'eager';
  });
  await sleep(1500);
}

const rect = (page, sel) => page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; });

async function site(browser) {
  // 1) hero z nawigacją i okiem — dokładnie to, co widać po wejściu na stronę
  let page = await mobile(browser, LIVE);
  await sleep(5000);
  await page.screenshot({ path: path.join(OUT, 'site_hero.png') });
  // 2) nawigacja osobno (w telefonie w reelsie jest przyklejona u góry)
  const nav = await page.$('nav, #navbar, header');
  if (nav) await nav.screenshot({ path: path.join(OUT, 'site_nav.png') });
  // 3) pas od góry strony do końca karty OVERPRINT, bez elementów fixed
  await walk(page);
  const fixed = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && el.id !== 'starfield' && el.tagName !== 'CANVAS') { el.dataset.capHidden = cs.display; el.style.setProperty('display', 'none', 'important'); out.push(el.id || el.className || el.tagName); }
    }
    return out;
  });
  console.log('ukryte fixed:', fixed.join(', '));
  const op = await rect(page, '.project-item--overprint');
  const sf = await rect(page, '.project-item--featured');
  const work = await rect(page, '#work');
  const end = Math.ceil(op.y + op.h + 60);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  // tylko od "Wybrane prace" do końca karty OVERPRINT: zrzut wyższy niż ~16k px (limit tekstury GPU) zaczyna się powtarzać
  const top = Math.floor(work.y - 40);
  await page.screenshot({ path: path.join(OUT, 'site_strip.png'), clip: { x: 0, y: top, width: VW, height: end - top }, captureBeyondViewport: true });
  const btn = await rect(page, '.project-item--overprint .play-free').catch(() => null);
  fs.writeFileSync(path.join(OUT, 'site.json'), JSON.stringify({ vw: VW, dpr: DPR, top, end, work, spacefighter: sf, overprint: op, playFree: btn }, null, 1));
  console.log('pas strony', end, 'px', JSON.stringify({ work, sf, op, btn }));
  await page.close();

  // 4) gry.html — wybór gry
  page = await mobile(browser, LIVE + 'gry.html');
  await sleep(4000);
  await page.addStyleTag({ content: '.eye-bubble,#mech-eye,.eye-beam,.eye-spot-glow{display:none!important}' });
  await walk(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'gry.png'), fullPage: true });
  const cards = await page.$$eval('a', as => as.map(a => { const b = a.getBoundingClientRect(); return { href: a.getAttribute('href'), x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; }).filter(c => /shooter|gra\.html/.test(c.href) && c.h > 100));
  fs.writeFileSync(path.join(OUT, 'gry.json'), JSON.stringify(cards, null, 1));
  console.log('gry.html karty', JSON.stringify(cards));
  await page.close();
}

async function game(browser) {
  const srv = await start();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  // menu gry na telefonie
  let page = await mobile(browser, base + 'shooter.html');
  await page.addStyleTag({ content: '#mech-eye,.eye-bubble,[class*="observer"]{display:none!important}' });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, 'game_menu.png') });
  const play = await rect(page, '#btn-play');
  fs.writeFileSync(path.join(OUT, 'game_menu.json'), JSON.stringify({ play }, null, 1));
  await page.close();

  // ekrany w trakcie gry: DPR 3 na szerokim widoku (karty w rzędzie)
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto(base + 'shooter.html', { waitUntil: 'networkidle2' });
  await page.addStyleTag({ content: '#mech-eye,.eye-bubble,[class*="observer"]{display:none!important} .screen.dim{background:transparent!important;backdrop-filter:none!important}' });
  await page.evaluate(() => document.getElementById('btn-play').click());
  await sleep(800);
  // karty poziomu
  await page.evaluate(() => { const g = overprint.game; g.wave = 6; g.pendingLevels = 1; g.level = 7; });
  await sleep(900);
  const cards = await page.$$('#cards > *');
  for (let i = 0; i < cards.length; i++) await cards[i].screenshot({ path: path.join(OUT, `card_${i}.png`), omitBackground: true });
  console.log('karty', cards.length);
  await page.evaluate(() => overprint.ui.pickCard(0));
  await sleep(500);
  // sklep
  await page.evaluate(() => { const g = overprint.game; g.money = 480; g.wave = 8; g.state = 'shop'; overprint.ui.hooks().shop(); });
  await sleep(900);
  const offers = await page.$$('#offers > *');
  for (let i = 0; i < offers.length; i++) await offers[i].screenshot({ path: path.join(OUT, `offer_${i}.png`), omitBackground: true });
  console.log('oferty', offers.length);
  await page.close();
  srv.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  });
  if (what === 'all' || what === 'site') await site(browser);
  if (what === 'all' || what === 'game') await game(browser);
  await browser.close();
})();
