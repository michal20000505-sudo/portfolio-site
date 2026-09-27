// Zrzuty lokalnej kopii strony Body Creator (widok mobilny 390 px, DPR 3) → assets/site/*.webp + site.json.
// Całe sekcje trafiają na ekran telefonu, pojedyncze elementy (karty oferty, trenerzy, opinia, karta konsultacji)
// "wyskakują" z niego w 3D — site.json trzyma ich prostokąty względem sekcji, żeby wyskok zaczynał się dokładnie z ekranu.
// node capture.js [ścieżka do strony]   (domyślnie ../../../BodycreatorTEST)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');

const SITE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'BodycreatorTEST'));
const OUT = path.join(__dirname, 'assets', 'site');
const VW = 390, VH = 844, DPR = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// nawigacja jest fixed — na zrzutach sekcji by się powielała (telefon w reelsie rysuje ją osobno, na stałe u góry)
const hideNav = page => page.addStyleTag({ content: '#navbar{display:none!important}' });

async function open(browser, base, name) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await page.goto(base + name, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  // przejazd po stronie: lazy-load obrazków i animacje wejścia
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += 250) { await page.evaluate(yy => window.scrollTo(0, yy), y); await sleep(90); }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.reveal, .step')) el.classList.add('visible');
    for (const sel of ['.whatsapp-float', '#page-loader']) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
    for (const img of document.querySelectorAll('img[loading=lazy]')) img.loading = 'eager';
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);
  return page;
}

// wideo w tle kart: pauza na konkretnej klatce (powtarzalny zrzut)
async function freezeVideos(page, t = 1.2) {
  await page.evaluate(async tt => {
    await Promise.all([...document.querySelectorAll('video')].map(v => new Promise(res => {
      v.pause();
      if (!v.duration && v.readyState < 1) return res();
      const done = () => res();
      v.addEventListener('seeked', done, { once: true });
      v.currentTime = Math.min(tt, (v.duration || tt + 1) - 0.1);
      setTimeout(done, 3000);
    })));
  }, t);
  await sleep(300);
}

async function shot(page, sel, file, { index = 0, rel = null } = {}) {
  const els = await page.$$(sel);
  const el = els[index];
  if (!el) { console.log('BRAK', sel, index); return null; }
  await el.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await sleep(250);
  const out = path.join(OUT, file + '.png');
  await el.screenshot({ path: out });
  const r = await el.evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; });
  console.log('zrzut', file, JSON.stringify(r));
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await start(0, SITE);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const meta = { dpr: DPR, vw: VW, vh: VH, sections: {}, elements: {} };
  const rel = (e, s) => e && s && { x: e.x - s.x, y: e.y - s.y, w: e.w, h: e.h };

  // ---------------- strona główna
  let page = await open(browser, base, 'index.html');
  await page.screenshot({ path: path.join(OUT, 'index_view.png') });           // pierwszy ekran z nawigacją
  // nawigacja nad hero jest przezroczysta — zrzut z kanałem alfa (bez strony pod spodem)
  const navStyle = await page.addStyleTag({ content: 'html,body{background:transparent!important} body *{visibility:hidden!important} #navbar,#navbar *{visibility:visible!important}' });
  const navEl = await page.$('#navbar');
  await navEl.screenshot({ path: path.join(OUT, 'nav.png'), omitBackground: true });
  const nav = await navEl.evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await navStyle.evaluate(e => e.remove());
  await sleep(300);
  await page.evaluate(() => window.scrollTo(0, 400));
  await sleep(700);
  meta.navScrolled = await shot(page, '#navbar', 'nav_scrolled');
  await page.evaluate(() => window.scrollTo(0, 0));
  await hideNav(page);
  const hero = await shot(page, 'section.hero', 'sec_hero');
  // ten sam kadr bez nagłówka: w reelsie nagłówek "przylatuje" z otwarcia i dopiero na B2 podmienia się na zrzut
  await page.addStyleTag({ content: '.hero-title{visibility:hidden!important}' });
  await shot(page, 'section.hero', 'sec_hero_notitle');
  await page.addStyleTag({ content: '.hero-title{visibility:visible!important}' });
  const reviews = await shot(page, '#reviews', 'sec_reviews');
  const pnav = await shot(page, '.pages-nav-section', 'sec_pagesnav');
  const rv = await shot(page, '#reviews .review-card', 'el_review');
  const cta = await shot(page, '.pages-nav-featured', 'el_cta');
  const heroBtn = await page.$eval('.hero-cta .btn', e => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; });
  // nagłówek hero: prostokąty obu linii i styl — napis z otwarcia reelsa "wpada" dokładnie w to miejsce
  meta.heroTitle = await page.evaluate(() => {
    const h = document.querySelector('.hero-title');
    const cs = getComputedStyle(h);
    const hl = h.querySelector('.highlight');
    const r = e => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; };
    const range = document.createRange();
    range.selectNodeContents(h.firstChild);
    const l1 = range.getBoundingClientRect();
    return {
      fontSize: parseFloat(cs.fontSize), letterSpacing: parseFloat(cs.letterSpacing) || 0, fontWeight: cs.fontWeight, lineHeight: parseFloat(cs.lineHeight),
      line1: { x: l1.left + scrollX, y: l1.top + scrollY, w: l1.width, h: l1.height }, line2: r(hl), color2: getComputedStyle(hl).color,
      text1: h.firstChild.textContent.trim(), text2: hl.textContent.trim(),
    };
  });
  console.log('hero', JSON.stringify(meta.heroTitle));
  meta.sections.hero = hero; meta.sections.reviews = reviews; meta.sections.pagesnav = pnav; meta.nav = nav;
  meta.elements.review = { sec: 'reviews', ...rel(rv, reviews) };
  meta.elements.cta = { sec: 'pagesnav', ...rel(cta, pnav) };
  meta.elements.heroBtn = { sec: 'hero', ...rel(heroBtn, hero) };
  await page.close();

  // ---------------- oferta: sekcja z sliderem + każda karta osobno (karty w kolumnie, żeby slider ich nie przycinał)
  page = await open(browser, base, 'oferta.html');
  await freezeVideos(page, 1.5);
  await hideNav(page);
  const offer = await shot(page, 'section:has(#servicesSlider)', 'sec_offer');
  const card0 = await shot(page, '#servicesSlider .service-card', 'el_service_0');
  meta.sections.offer = offer;
  meta.elements.service0 = { sec: 'offer', ...rel(card0, offer) };
  await page.evaluate(() => {
    const s = document.getElementById('servicesSlider');
    s.style.transform = 'none'; s.style.display = 'flex'; s.style.flexDirection = 'column'; s.style.gap = '24px';
    for (const c of s.children) { c.style.flex = '0 0 auto'; c.style.width = '350px'; c.style.maxWidth = '350px'; }
  });
  await sleep(500);
  for (let i = 1; i < 5; i++) await shot(page, '#servicesSlider .service-card', 'el_service_' + i, { index: i });
  await page.close();

  // ---------------- o nas: panel z liczbami, siatka trenerów (drugi panel slidera), kroki
  page = await open(browser, base, 'o-nas.html');
  await freezeVideos(page, 2.0);
  await hideNav(page);
  const stats = await shot(page, '.stats-strip', 'el_stats');
  const team1 = await shot(page, '#team', 'sec_team1');
  meta.sections.team1 = team1;
  meta.elements.stats = { sec: 'team1', ...rel(stats, team1) };
  await page.click('#teamNext');
  await sleep(1400);
  const team2 = await shot(page, '#team', 'sec_team2');
  meta.sections.team2 = team2;
  for (let i = 0; i < 4; i++) {
    const r = await shot(page, '.team-card', 'el_team_' + i, { index: i });
    meta.elements['team' + i] = { sec: 'team2', ...rel(r, team2) };
  }
  const steps = await shot(page, 'section:has(.step-card)', 'sec_steps');
  meta.sections.steps = steps;
  await page.close();

  // ---------------- rezerwacja
  page = await open(browser, base, 'rezerwacja.html');
  await freezeVideos(page, 3.0);
  await hideNav(page);
  const booking = await shot(page, '#booking', 'sec_booking');
  meta.sections.booking = booking;
  await page.close();

  fs.writeFileSync(path.join(OUT, 'site.json'), JSON.stringify(meta, null, 1));
  await browser.close();
  srv.close();
  console.log('gotowe → assets/site/*.png  (python pack.py zamienia na webp)');
})();
