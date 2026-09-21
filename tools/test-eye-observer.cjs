/* Run with Playwright installed: node tools/test-eye-observer.cjs
 * Optional EYE_PLAYWRIGHT_MODULE points at an existing Playwright installation.
 * Screenshots/report go to a new OS temp directory; no production files change.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.EYE_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'observer-test-'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

async function serve(context) {
    await context.route('http://observer.local/**', route => {
        const file = path.resolve(root, '.' + decodeURIComponent(new URL(route.request().url()).pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'Not found' });
        return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
}
async function ready(page) {
    await page.goto('http://observer.local/oko-lab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.observerLab?.host.dataset.ready === 'true', null, { timeout: 45000 });
}
async function snapshot(page) { return page.evaluate(() => window.observerLab.snapshot()); }
async function main() {
    const browser = await chromium.launch({ headless: true });
    const report = { screenshots: out, errors: [], checks: [] };
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 }); await serve(context);
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
        await ready(page);
        await page.evaluate(() => { const e = window.observerLab; e.setOptions({ tracking: false, autoBlink: false, reactions: false }); e.setView('reference'); });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });
        await page.locator('.viewport-shell').screenshot({ path: path.join(out, 'model.png') });
        report.initial = await snapshot(page); console.log('INITIAL', JSON.stringify(report.initial));
        if (process.env.EYE_VIEWS_ONLY) {
            await page.evaluate(() => window.observerLab.setOptions({ paused: true }));
            for (const view of ['front', 'side', 'back']) {
                await page.evaluate(view => window.observerLab.setView(view), view);
                await page.locator('.viewport-shell').screenshot({ path: path.join(out, `${view}.png`) });
                assert(Number.isFinite((await snapshot(page)).yaw));
            }
            report.checks.push('Front, side and back render with finite camera transforms');
            await page.evaluate(() => window.observerLab.setView('front'));
            await page.locator('#observer-stage').focus(); await page.keyboard.press('ArrowRight');
            assert((await snapshot(page)).yaw > .1); await page.keyboard.press('Home');
            assert.equal((await snapshot(page)).yaw, .38); report.checks.push('Keyboard view controls also work while paused');
            const beforeDrag = (await snapshot(page)).yaw;
            const r = await page.locator('#observer-stage').boundingBox();
            await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
            await page.mouse.move(r.x + r.width / 2 + 80, r.y + r.height / 2, { steps: 4 }); await page.mouse.up();
            assert((await snapshot(page)).yaw > beforeDrag + .3); report.checks.push('Pointer drag orbit works while paused');
            const gears = await page.evaluate(() => {
                const e = window.observerLab; e.setView('reference'); const before = e.model.drive.rotation.z;
                e.trigger('scanning'); e.render(.016); const scan = e.model.drive.rotation.z;
                e.trigger('sleeping'); e.render(.016); const sleep = e.model.drive.rotation.z;
                return { before, scan, sleep };
            });
            assert(gears.scan >= gears.before && gears.scan - gears.before < .01);
            assert(gears.sleep >= gears.scan && gears.sleep - gears.scan < .01); report.checks.push('Gear phase remains continuous across scan/sleep transitions');
            await page.evaluate(() => { const e = window.observerLab; e.model.pose({ opening: .45 }); e.renderer.render(e.scene, e.camera); });
            await page.locator('.viewport-shell').screenshot({ path: path.join(out, 'half-shutter.png') });
            assert.deepEqual(report.errors, []); return;
        }
        if (process.env.EYE_VISUAL_ONLY) { console.log(JSON.stringify(report)); return; }
        assert.equal(report.initial.state, 'idle'); assert(report.initial.triangles > 10000);
        report.checks.push('Desktop model loads');
        await page.locator('[data-action="scanning"]').first().click();
        assert.equal((await snapshot(page)).state, 'scanning');
        await page.locator('[data-action="happy"]').click(); assert.equal((await snapshot(page)).state, 'happy');
        await page.locator('[data-action="startled"]').click(); assert.equal((await snapshot(page)).state, 'startled');
        await page.locator('[data-action="confused"]').click(); assert.equal((await snapshot(page)).state, 'confused');
        report.checks.push('Manual emotional states');
        await page.locator('#sleep').click();
        await page.waitForFunction(() => window.observerLab.snapshot().opening < .01);
        assert((await snapshot(page)).opening < .01);
        await page.locator('.viewport-shell').screenshot({ path: path.join(out, 'closed.png') });
        await page.mouse.move(600, 370); await page.waitForTimeout(300); assert.equal((await snapshot(page)).state, 'waking');
        await page.waitForFunction(() => window.observerLab.snapshot().opening > .98); assert((await snapshot(page)).opening > .98);
        report.checks.push('Sleep closes shutter; movement wakes and reopens it');
        await page.evaluate(() => { const e = window.observerLab; e.setOptions({ spread: 1 }); document.getElementById('spread').value = '100'; });
        await page.waitForFunction(() => window.observerLab.snapshot().spread > .98); assert((await snapshot(page)).spread > .98);
        await page.locator('.viewport-shell').screenshot({ path: path.join(out, 'exploded.png') });
        await page.evaluate(() => window.observerLab.setOptions({ spread: 0 })); report.checks.push('Exploded mechanics');
        await page.locator('#pause').click(); const frozen = await snapshot(page); await page.waitForTimeout(350);
        assert.equal((await snapshot(page)).time, frozen.time); assert.equal((await snapshot(page)).active, false);
        await page.locator('#pause').click(); await page.waitForFunction(t => window.observerLab.time > t, frozen.time); assert((await snapshot(page)).time > frozen.time);
        report.checks.push('Pause actually stops RAF and resumes');
        await page.evaluate(() => { const e = window.observerLab; e.signal = null; e.setOptions({ tracking: true, reactions: true }); });
        await page.mouse.move(700, 340); await page.waitForTimeout(400); const up = await snapshot(page);
        await page.mouse.move(700, 680); await page.waitForTimeout(400); const down = await snapshot(page);
        assert(down.pitch > up.pitch); report.checks.push('Correct vertical pointer direction');
        await page.locator('#hello').fill('Michał'); assert.equal((await snapshot(page)).state, 'typing');
        await page.locator('#hello-form button').click(); assert.equal((await snapshot(page)).state, 'greeting');
        assert.match(await page.locator('#hello-result').innerText(), /Michał/);
        await page.locator('#playground').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.waitForFunction(() => document.querySelector('.viewport-shell').classList.contains('is-docked'));
        await page.screenshot({ path: path.join(out, 'playground.png') }); report.checks.push('Typing, submit greeting and docked live model');
        await page.evaluate(() => window.observerLab.setOptions({ reactions: false }));
        await page.locator('#controls').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
        await page.locator('#reset').click(); await page.waitForTimeout(300); const reset = await page.evaluate(() => window.observerLab.options);
        assert.equal(reset.spread, 0); assert.equal(reset.paused, false); assert.equal(reset.turntable, false); report.checks.push('Reset');
        const downloadPromise = page.waitForEvent('download'); await page.locator('#capture').click(); const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), 'observer-01.png'); await download.saveAs(path.join(out, 'capture.png')); report.checks.push('PNG capture');
        await page.evaluate(() => { window.observerLab.setOptions({ reactions: true }); window.observerLab.lastActivity = window.observerLab.time - 29; window.observerLab.signal = null; });
        await page.waitForTimeout(200); assert.equal((await snapshot(page)).state, 'sleeping'); report.checks.push('Idle timeout works after prior interaction');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.evaluate(() => window.observerLab.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
        await page.locator('#render-error').waitFor({ state: 'visible' }); assert.equal((await snapshot(page)).active, false);
        report.checks.push('Lost WebGL context stops rendering and displays recovery message');
        await context.close();

        const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await serve(mobile);
        const mp = await mobile.newPage(); mp.on('pageerror', e => report.errors.push(e.message)); await ready(mp); await mp.waitForTimeout(300);
        assert(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await mp.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
        await mp.locator('[data-action="happy"]').tap(); assert.equal((await snapshot(mp)).state, 'happy');
        report.mobile = await snapshot(mp); report.checks.push('390px mobile layout and touch'); await mobile.close();

        const reduced = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' }); await serve(reduced);
        const rp = await reduced.newPage(); rp.on('pageerror', e => report.errors.push(e.message)); await ready(rp);
        const t1 = await rp.evaluate(() => window.observerLab.motionTime); await rp.waitForTimeout(300);
        assert.equal(await rp.evaluate(() => window.observerLab.motionTime), t1);
        await rp.locator('[data-action="sleeping"]').first().click(); assert.equal((await snapshot(rp)).opening, 0);
        await rp.screenshot({ path: path.join(out, 'reduced.png') }); report.checks.push('Reduced motion: no autonomous animation, state feedback retained');
        await rp.evaluate(() => window.observerLab.dispose()); assert.equal(await rp.locator('#observer-stage canvas').count(), 0); assert.equal((await snapshot(rp)).active, false);
        report.checks.push('Dispose releases canvas/listeners/RAF'); await reduced.close();

        const offline = await browser.newContext(); await serve(offline); await offline.route('https://cdn.jsdelivr.net/**', r => r.abort());
        const op = await offline.newPage(); await op.goto('http://observer.local/oko-lab.html'); await op.locator('#render-error').waitFor({ state: 'visible' });
        assert(await op.locator('#eye-controls').evaluate(e => e.disabled));
        assert(await op.locator('#sleep').isDisabled()); report.checks.push('CDN/WebGL failure is visible, not silent'); await offline.close();
        assert.deepEqual(report.errors, []);
    } finally { await browser.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
