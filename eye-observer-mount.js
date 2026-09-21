/* ==========================================================================
   OBSERVER 01 — montaż oka na stronach portfolio
   Podpina renderer z eye-observer.js pod #mech-eye i odtwarza zachowanie
   dotychczasowej maskotki:
     · lot po ekranie za kursorem, z omijaniem treści,
     · wyraźne odwracanie się w stronę myszy (nie zastygnięte ¾),
     · podlot do najechanego przycisku lub linku, snop światła i łuna na nim,
     · płynne pojawienie się (.ready) i przejście na oko.html po dwukliku.

   Atrybuty kontenera:
     data-noflight — oko zostaje w układzie strony, bez lotu i reflektora,
     data-nolink   — dwuklik nie przenosi na oko.html.

   Wymaga mapy importów "three" w dokumencie (ta sama wersja co reszta strony).
   ========================================================================== */

const wrap = document.getElementById('mech-eye');

if (wrap) {
    try {
        const { ObserverEye } = await import('./eye-observer.js');

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

        const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

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
            }

            document.addEventListener('visibilitychange', () => {
                cancelAnimationFrame(frame); previous = 0;
                if (!document.hidden) frame = requestAnimationFrame(tick);
            });
            frame = requestAnimationFrame(tick);
            addEventListener('pagehide', () => cancelAnimationFrame(frame));
        }

        // Kursor strony głównej sygnalizuje, że oko jest klikalne.
        const cursor = document.querySelector('.cursor');
        if (cursor && getComputedStyle(wrap).pointerEvents !== 'none') {
            wrap.addEventListener('pointerenter', () => cursor.classList.add('eye-link'));
            wrap.addEventListener('pointerleave', () => cursor.classList.remove('eye-link'));
        }

        if (!('nolink' in wrap.dataset)) {
            wrap.addEventListener('dblclick', () => { location.href = 'oko.html'; });
        }

        wrap.classList.add('ready');
        addEventListener('pagehide', e => { if (!e.persisted) eye.dispose(); });
    } catch (error) {
        console.warn('[observer] Nie udało się uruchomić oka:', error);
    }
}
