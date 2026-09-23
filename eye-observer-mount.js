/* ==========================================================================
   OBSERVER 01 — montaż oka na stronach portfolio
   Podpina renderer z eye-observer.js pod #mech-eye i odtwarza zachowanie
   dotychczasowej maskotki:
     · intro: rozproszone części zlatują się magnetycznie w oko na całym ekranie,
       po czym dymek wita użytkownika (przy wejściu i odświeżeniu, patrz niżej),
     · lot po ekranie za kursorem, z omijaniem treści,
     · wyraźne odwracanie się w stronę myszy (nie zastygnięte ¾),
     · podlot do najechanego przycisku lub linku, snop światła i łuna na nim,
     · płynne pojawienie się (.ready) i przejście na oko.html po dwukliku.

   Atrybuty kontenera:
     data-noflight — oko zostaje w układzie strony, bez lotu, reflektora i intra,
     data-nolink   — dwuklik nie przenosi na oko.html.

   Intro (złożenie z części) gra tylko przy aktywnym locie: przy każdym wejściu
   z zewnątrz i każdym odświeżeniu, bez przejść linkiem między podstronami.
   Parametr URL "?intro" wymusza odtworzenie (przydatne do testów).

   Wymaga mapy importów "three" w dokumencie (ta sama wersja co reszta strony).
   ========================================================================== */

const wrap = document.getElementById('mech-eye');

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// --- dymek obok oka: tworzony tylko wtedy, gdy faktycznie gra intro ---------
let bubbleTimers = [];
function clearBubbleTimers() { bubbleTimers.forEach(clearTimeout); bubbleTimers = []; }
function initBubble() {
    if (document.getElementById('eye-bubble')) return;
    const style = document.createElement('style');
    style.textContent = `
        #eye-bubble {
            position: fixed; top: 0; left: 0; z-index: 5; pointer-events: none;
            max-width: 260px; padding: 12px 16px; border-radius: 14px;
            background: rgba(5, 5, 5, .92); border: 1px solid rgba(0, 255, 255, .35);
            color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.4;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .5), 0 0 18px rgba(0, 255, 255, .08);
            opacity: 0; transform: scale(.92); transform-origin: center;
            transition: opacity .35s ease, transform .35s cubic-bezier(.23, 1, .32, 1);
            will-change: transform, opacity;
        }
        #eye-bubble.is-visible { opacity: 1; transform: scale(1); }
        #eye-bubble::after {
            content: ''; position: absolute; width: 12px; height: 12px; left: var(--tail-left, 20px);
            margin-left: -6px; background: rgba(5, 5, 5, .92); transform: rotate(45deg);
        }
        #eye-bubble[data-tail="bottom"]::after { bottom: -6px; border-right: 1px solid rgba(0, 255, 255, .35); border-bottom: 1px solid rgba(0, 255, 255, .35); }
        #eye-bubble[data-tail="top"]::after { top: -6px; border-left: 1px solid rgba(0, 255, 255, .35); border-top: 1px solid rgba(0, 255, 255, .35); }
        #eye-bubble .eb-text { display: block; transition: opacity .25s ease; }
        @media (max-width: 420px) {
            #eye-bubble { max-width: calc(100vw - 32px); font-size: 13px; padding: 10px 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
            #eye-bubble { transition: opacity .3s ease; transform: none !important; }
        }`;
    document.head.appendChild(style);
    const bubble = document.createElement('div');
    bubble.id = 'eye-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = '<span class="eb-text"></span>';
    document.body.appendChild(bubble);
    window.__eyeBubble = bubble;
}
function positionBubble(cx, cy, half) {
    const bubble = window.__eyeBubble;
    if (!bubble) return;
    const margin = 16, gap = 14;
    const w = bubble.offsetWidth || 240, h = bubble.offsetHeight || 70;
    // Domyślnie: dymek nad-lewo od oka; odwracamy, gdy wypadłby poza ekran.
    let flipX = false, flipY = false;
    let left = cx - half - gap - w;
    let top = cy - half - gap - h;
    if (left < margin) { flipX = true; left = cx + half + gap; }
    if (top < margin) { flipY = true; top = cy + half + gap; }
    left = clamp(left, margin, Math.max(margin, innerWidth - margin - w));
    top = clamp(top, margin, Math.max(margin, innerHeight - margin - h));
    bubble.style.left = `${left.toFixed(1)}px`;
    bubble.style.top = `${top.toFixed(1)}px`;
    bubble.dataset.tail = flipY ? 'top' : 'bottom';
    bubble.style.setProperty('--tail-left', `${clamp(cx - left, 16, Math.max(16, w - 16)).toFixed(1)}px`);
}
function setBubbleText(text) {
    const bubble = window.__eyeBubble; if (!bubble) return;
    const span = bubble.querySelector('.eb-text');
    span.style.opacity = '0';
    setTimeout(() => { span.textContent = text; span.style.opacity = '1'; }, 160);
}
function showBubble(text) {
    const bubble = window.__eyeBubble; if (!bubble) return;
    bubble.querySelector('.eb-text').textContent = text;
    bubble.querySelector('.eb-text').style.opacity = '1';
    bubble.classList.add('is-visible');
}
function hideBubble() {
    clearBubbleTimers();
    window.__eyeBubble?.classList.remove('is-visible');
}
function runBubbleSequence() {
    if (!window.__eyeBubble) return;
    showBubble('Cześć, jestem obserwatorem tego portfolio, ale będę też obserwował Ciebie.');
    bubbleTimers.push(setTimeout(() => setBubbleText('Kliknij mnie dwa razy, jeśli Ty chcesz poobserwować mnie.'), 4500));
    bubbleTimers.push(setTimeout(hideBubble, 4500 + 6000));
}

if (wrap) {
    try {
        const { ObserverEye } = await import('./eye-observer.js?v=20260923');

        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
        const flight = !('noflight' in wrap.dataset) && !reduced;

        // Małe oko na stronie patrzy przed siebie i wyraźnie odwraca się za kursorem:
        // pełne wychylenie osiąga po ~420 px, więc ruch myszy widać od razu.
        const eye = new ObserverEye(wrap, flight
            ? { lookRadius: 420, lookYaw: .8, lookPitch: .52 }
            : { lookYaw: .6, lookPitch: .4 });
        // Na stronach oko patrzy przed siebie, a nie zastyga w ujęciu ¾;
        // ujęcie ¾ zostaje w laboratorium, gdzie da się je wybrać przyciskiem.
        eye.setView('front');
        // Uchwyt do podglądu w konsoli; renderer z niego nie korzysta.
        window.observerEye = eye;

        // Kursor strony głównej sygnalizuje, że oko jest klikalne. Ustawiane zanim
        // intro włączy tymczasowo pointer-events: none na #mech-eye, żeby ten
        // jednorazowy odczyt nie trafił na "none" i nie ominął podpięcia na stałe.
        const cursor = document.querySelector('.cursor');
        if (cursor && getComputedStyle(wrap).pointerEvents !== 'none') {
            wrap.addEventListener('pointerenter', () => cursor.classList.add('eye-link'));
            wrap.addEventListener('pointerleave', () => cursor.classList.remove('eye-link'));
        }
        if (!('nolink' in wrap.dataset)) {
            wrap.addEventListener('dblclick', () => { hideBubble(); location.href = 'oko.html'; });
        }

        if (flight) {
            wrap.style.touchAction = 'pan-y';

            // --- nakładki: snop reflektora i łuna na celu -------------------
            const overlayStyle = document.createElement('style');
            overlayStyle.textContent = `
                #eye-beam, #eye-spot-glow {
                    position: fixed; top: 0; left: 0; pointer-events: none; z-index: -1;
                    opacity: 0; transition: opacity 0.45s cubic-bezier(0.23, 1, 0.32, 1);
                    will-change: transform, opacity;
                }
                #eye-beam {
                    height: 90px; transform-origin: left center;
                    background: linear-gradient(90deg, rgba(0, 255, 255, 0.16), rgba(0, 255, 255, 0.05) 65%, transparent);
                    clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 58%);
                }
                #eye-spot-glow {
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(0, 255, 255, 0.16), rgba(0, 255, 255, 0.05) 55%, transparent 70%);
                }`;
            document.head.appendChild(overlayStyle);
            const beam = document.createElement('div');
            beam.id = 'eye-beam';
            const spotGlow = document.createElement('div');
            spotGlow.id = 'eye-spot-glow';
            document.body.insertBefore(beam, wrap);
            document.body.insertBefore(spotGlow, wrap);

            // --- gdzie na ekranie jest wolne miejsce -----------------------
            const CONTENT = 'img, picture, video, figure, svg, canvas, h1, h2, h3, h4, h5, h6, p, li, a, button, input, textarea, blockquote, table';
            const size = () => wrap.clientWidth || 120;

            function contentAt(x, y) {
                if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
                return document.elementsFromPoint(x, y)
                    .some(el => !wrap.contains(el) && el.matches?.(CONTENT));
            }
            function occlusion(cx, cy) {
                const r = size() * .45;
                return [[cx, cy], [cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]]
                    .reduce((score, [x, y]) => score + (contentAt(x, y) ? 1 : 0), 0);
            }

            // Sprężyna półukryta: ten sam model co w poprzedniej maskotce.
            function spring(pos, vel, target, dt, freq, damping) {
                const f = 1 + 2 * dt * damping * freq, ff = freq * freq;
                const det = 1 / (f + dt * dt * ff);
                return [(pos * f + dt * vel + dt * dt * ff * target) * det, (vel + dt * ff * (target - pos)) * det];
            }

            const state = {
                x: innerWidth * .8, y: innerHeight * .72, vx: 0, vy: 0,
                tx: innerWidth * .8, ty: innerHeight * .72,
                followX: 170, followY: 130, occTimer: 0, wanderTimer: 0,
                pointer: null, spot: null,
            };

            function wander() {
                const m = size() * .7;
                let best = Infinity;
                for (let i = 0; i < 6 && best > 0; i++) {
                    const x = m + Math.random() * Math.max(1, innerWidth - m * 2);
                    const y = m + Math.random() * Math.max(1, innerHeight - m * 2);
                    const score = occlusion(x, y);
                    if (score < best) { best = score; state.tx = x; state.ty = y; }
                }
                state.wanderTimer = 9 + Math.random() * 10;
            }
            wander();

            // Najechanie na element interaktywny: podlot, snop i łuna.
            if (finePointer) {
                document.addEventListener('pointerover', e => {
                    const el = e.target instanceof Element && e.target.closest('a, button, [role="button"]');
                    if (el && !wrap.contains(el)) state.spot = el;
                }, { passive: true });
                document.addEventListener('pointerout', e => {
                    if (e.target instanceof Element && e.target.closest('a, button, [role="button"]')) state.spot = null;
                }, { passive: true });
                addEventListener('pointermove', e => { state.pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
            }

            let frame = 0, previous = 0;
            function tick(now) {
                frame = requestAnimationFrame(tick);
                const dt = Math.min((now - (previous || now)) / 1000, .05);
                previous = now;
                const half = size() / 2;
                const asleep = eye.mode === 'sleeping';

                if (state.spot && !document.contains(state.spot)) state.spot = null;

                let freq = .35;
                if (state.spot && !asleep) {
                    // Zatrzymanie po zewnętrznej stronie celu, żeby go nie zasłaniać.
                    const r = state.spot.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const dx = state.x - cx, dy = state.y - cy, len = Math.hypot(dx, dy) || 1;
                    const standoff = Math.max(r.width, r.height) / 2 + size() * .85;
                    state.tx = cx + (dx / len) * standoff;
                    state.ty = cy + (dy / len) * standoff;
                    freq = .95;
                } else if (state.pointer && !asleep) {
                    // Dryf za kursorem w najmniej zasłoniętej ćwiartce.
                    state.occTimer -= dt;
                    if (state.occTimer <= 0) {
                        state.occTimer = .5;
                        let best = Infinity;
                        for (const sx of [1, -1]) for (const sy of [1, -1]) {
                            const score = occlusion(state.pointer.x + sx * 170, state.pointer.y + sy * 130);
                            if (score < best) { best = score; state.followX = sx * 170; state.followY = sy * 130; }
                        }
                    }
                    state.tx = state.pointer.x + state.followX;
                    state.ty = state.pointer.y + state.followY;
                } else {
                    state.wanderTimer -= dt;
                    if (state.wanderTimer <= 0) wander();
                }

                const driftX = Math.sin(now / 3200) * 24 + Math.sin(now / 7700 + 2) * 16;
                const driftY = Math.cos(now / 4300) * 20 + Math.sin(now / 5900 + 5) * 14;
                [state.x, state.vx] = spring(state.x, state.vx, state.tx + driftX, dt, freq, 1);
                [state.y, state.vy] = spring(state.y, state.vy, state.ty + driftY, dt, freq, 1);
                state.x = clamp(state.x, half, Math.max(half, innerWidth - half));
                state.y = clamp(state.y, half, Math.max(half, innerHeight - half));
                wrap.style.transform = `translate3d(${(state.x - half).toFixed(1)}px, ${(state.y - half).toFixed(1)}px, 0)`;

                // Przechył w kierunku lotu.
                eye.bank += (clamp(-state.vx * .0016, -.18, .18) - eye.bank) * Math.min(1, dt * 2);

                // Kursor zna już pozycję oka; po locie trzeba przeliczyć kierunek patrzenia.
                if (state.pointer && eye.options.tracking) eye.lookAt(state.pointer.x, state.pointer.y);

                if (state.spot && !asleep) {
                    const r = state.spot.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const bdx = cx - state.x, bdy = cy - state.y;
                    beam.style.width = `${Math.hypot(bdx, bdy).toFixed(0)}px`;
                    beam.style.transform = `translate3d(${state.x.toFixed(1)}px, ${(state.y - 45).toFixed(1)}px, 0) rotate(${Math.atan2(bdy, bdx)}rad)`;
                    beam.style.opacity = '1';
                    const gw = Math.max(r.width, r.height) * 1.5;
                    spotGlow.style.width = spotGlow.style.height = `${gw.toFixed(0)}px`;
                    spotGlow.style.transform = `translate3d(${(cx - gw / 2).toFixed(1)}px, ${(cy - gw / 2).toFixed(1)}px, 0)`;
                    spotGlow.style.opacity = '1';
                } else {
                    beam.style.opacity = '0';
                    spotGlow.style.opacity = '0';
                }

                if (window.__eyeBubble) positionBubble(state.x, state.y, half);
            }

            // Podczas intra host zajmuje cały ekran — lot rusza dopiero po złożeniu oka.
            let introRunning = false;
            document.addEventListener('visibilitychange', () => {
                cancelAnimationFrame(frame); previous = 0;
                if (!document.hidden && !introRunning) frame = requestAnimationFrame(tick);
            });
            addEventListener('pagehide', () => cancelAnimationFrame(frame));

            // --- intro: rozproszone części zlatują się w oko na całym ekranie ---
            // Intro gra przy każdym wejściu na stronę i każdym odświeżeniu; pomijamy je
            // tylko przy przejściu linkiem z innej podstrony portfolio (i powrocie wstecz).
            const navType = performance.getEntriesByType?.('navigation')[0]?.type;
            let internal = false;
            try { internal = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch { /* brak referrera */ }
            const playIntro = new URLSearchParams(location.search).has('intro')
                || navType === 'reload' || (!internal && navType !== 'back_forward');

            (async function startFlight() {
                if (playIntro) {
                    introRunning = true;
                    // Mierzymy normalny rozmiar oka (clamp 90–150px / 78px na telefonie),
                    // zanim host zajmie cały ekran, żeby zamiana była niewidoczna.
                    const normalSize = wrap.clientWidth || 120;
                    wrap.style.width = '100vw'; wrap.style.height = '100vh';
                    wrap.style.aspectRatio = 'auto'; wrap.style.transform = 'none';
                    wrap.style.pointerEvents = 'none'; // intro nie może blokować kliknięć w stronę
                    const half0 = normalSize / 2;
                    eye.setFraming({ x: state.x - half0, y: state.y - half0, size: normalSize });
                    wrap.classList.add('ready');
                    initBubble();
                    await eye.playAssembly({ duration: 2.6 });
                    // Zamiana pełnoekranowego kadru na mały, latający canvas — bez skoku:
                    // najpierw wracamy do normalnego rozmiaru/pozycji, a dopiero potem startuje lot.
                    wrap.style.width = ''; wrap.style.height = ''; wrap.style.aspectRatio = '';
                    wrap.style.pointerEvents = '';
                    eye.setFraming(null); eye.resize();
                    const half = size() / 2;
                    wrap.style.transform = `translate3d(${(state.x - half).toFixed(1)}px, ${(state.y - half).toFixed(1)}px, 0)`;
                    introRunning = false;
                    positionBubble(state.x, state.y, half);
                    runBubbleSequence();
                } else {
                    wrap.classList.add('ready');
                }
                frame = requestAnimationFrame(tick);
            })();
        }

        wrap.classList.add('ready');
        addEventListener('pagehide', e => { if (!e.persisted) eye.dispose(); });
    } catch (error) {
        console.warn('[observer] Nie udało się uruchomić oka:', error);
    }
}
