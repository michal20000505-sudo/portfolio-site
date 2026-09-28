/* ==========================================================================
   OVERPRINT: start i pętla główna
   Serwer trzyma JS w cache przez tydzień, więc każdy import modułu gry ma
   ten sam parametr ?v=. Przy każdej zmianie w shooter/ podbij go wszędzie
   (importy w shooter/*.js i <script> w shooter.html).
   ========================================================================== */

import { View } from './render.js?v=20260928c';
import { Audio } from './audio.js?v=20260928c';
import { Input } from './input.js?v=20260928c';
import { Game } from './game.js?v=20260928c';
import { UI } from './ui.js?v=20260928c';
import { Board } from './net.js?v=20260928c';

function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!webglOk()) {
    document.getElementById('menu').innerHTML = '<div class="modal panel"><h2 class="h1">Brak WebGL</h2><p class="tagline">Ta przeglądarka nie obsługuje grafiki 3D. Spróbuj w aktualnym Chrome, Firefoxie, Edge albo Safari.</p><a class="btn primary" href="/">Wróć do portfolio</a></div>';
} else {
    const view = new View(document.getElementById('game'), document.getElementById('overlay'));
    const audio = new Audio();
    const input = new Input(document.getElementById('touch-layer'));
    let ui = null;
    const game = new Game(view, audio, input, new Proxy({}, { get: (_, k) => (...a) => ui?.hooks()[k]?.(...a) }));
    ui = new UI(game, view, audio, input, Board);

    // Automatyczne obniżanie jakości, gdy gra klatkuje (tylko jeśli gracz sam jej nie ustawił).
    let perfT = 0, perfN = 0, perfSum = 0;
    function watchPerf(dt) {
        if (ui.userQuality || game.state !== 'play') return;
        perfT += dt; perfN++; perfSum += dt;
        if (perfT < 4) return;
        const avg = perfSum / perfN;
        perfT = perfN = perfSum = 0;
        const q = view.quality;
        if (avg > 1 / 42 && q !== 'low') {
            view.setQuality(q === 'high' ? 'medium' : 'low');
            ui.syncSettings();
        }
    }

    let last = performance.now();
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(.1, (now - last) / 1000);
        last = now;
        game.update(dt);
        const s = game.state;
        const vdt = s === 'play' || s === 'menu' ? dt * (game.hitstop > 0 ? .15 : 1) : s === 'dying' ? dt * .35 : 0;
        view.render(game, vdt);
        if (s !== 'menu') ui.hud();
        watchPerf(dt);
    }
    requestAnimationFrame(frame);

    // podgląd w konsoli przy testach
    window.overprint = { game, view, ui, audio };
}
