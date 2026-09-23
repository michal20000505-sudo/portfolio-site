/* ==========================================================================
   OBSERVER 01 — montaż oka na stronach portfolio
   Podpina renderer z eye-observer.js pod #mech-eye i odtwarza zachowanie
   dotychczasowej maskotki:
     · intro: rozproszone części zlatują się magnetycznie w oko na całym ekranie,
       po czym dymek wita użytkownika (przy wejściu i odświeżeniu, patrz niżej),
     · lot po ekranie za kursorem, z omijaniem treści,
     · wyraźne odwracanie się w stronę myszy (nie zastygnięte ¾),
     · podlot do najechanego przycisku lub linku, snop światła i łuna na nim,
     · płynne pojawienie się (.ready) i przejście na oko.html po dwukliku,
     · oko jako "komentator": treść ze znacznikiem data-eye dostaje dymek
       z komentarzem, gdy się na nią patrzy (najedzie / przewinie do niej).

   Atrybuty kontenera:
     data-noflight — oko zostaje w układzie strony, bez lotu, reflektora, intra
                     i bez komentarzy,
     data-nolink   — dwuklik nie przenosi na oko.html.

   Atrybuty komentarza (na dowolnym elemencie treści, może być zagnieżdżony —
   wygrywa najbardziej wewnętrzny [data-eye] wg closest()):
     data-eye="Tekst komentarza"       — wymagany, 1–2 krótkie zdania po polsku,
     data-eye-title="Krótki nagłówek"  — opcjonalny, np. "Landing od 900 zł".
   Na desktopie komentarz pokazuje się przy najechaniu. Na dotyku oko komentuje
   element najbliższy środka ekranu, gdy przewijanie się zatrzyma.

   Komentowanie: "podleć i stój". Raz na komentarz wybierane jest miejsce
   parkowania oka razem ze stroną dymka (nad, obok, pod okiem) tak, żeby ani
   oko, ani dymek nie zasłaniały treści ani komentowanego elementu. Oko szybko
   tam dolatuje, dymek pojawia się dopiero po dolocie i oba stoją w miejscu,
   dopóki komentarz trwa. Przewinięcie strony chowa dymek; po zatrzymaniu
   przewijania miejsce jest wybierane od nowa.

   Warstwy: wrap (oko) z-index 9000, dymek 9001 — nad nagłówkiem (100), pod
   kursorem (9999) i lightboxem (10001). Snop/łuna zostają w tle (-1).

   Intro (złożenie z części) gra tylko przy aktywnym locie: przy każdym wejściu
   z zewnątrz i każdym odświeżeniu, bez przejść linkiem między podstronami.
   Parametr URL "?intro" wymusza odtworzenie (przydatne do testów).

   Wymaga mapy importów "three" w dokumencie (ta sama wersja co reszta strony).
   ========================================================================== */

const wrap = document.getElementById('mech-eye');

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// --- dymek: element widoczny + niewidoczny bliźniak do mierzenia tekstu ------
const BUBBLE_MARGIN = 16, BUBBLE_GAP = 10;
let bubble = null, measurer = null;
function initBubble() {
    if (bubble) return;
    const style = document.createElement('style');
    style.textContent = `
        .eye-bubble {
            position: fixed; top: 0; left: 0; z-index: 9001; pointer-events: none;
            max-width: 260px; padding: 12px 16px; border-radius: 14px;
            background: rgba(5, 5, 5, .92); border: 1px solid rgba(0, 255, 255, .35);
            color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.4;
        }
        #eye-bubble {
            opacity: 0; transform: scale(.94); transform-origin: var(--origin, center);
            transition: opacity .22s ease, transform .3s cubic-bezier(.23, 1, .32, 1);
        }
        #eye-bubble.is-visible { opacity: 1; transform: scale(1); }
        #eye-bubble-measure { visibility: hidden; left: -10000px; }
        #eye-bubble::after {
            content: ''; position: absolute; width: 12px; height: 12px;
            background: rgba(5, 5, 5, .92); transform: rotate(45deg);
        }
        #eye-bubble[data-tail="bottom"]::after { left: var(--tail, 20px); margin-left: -6px; bottom: -7px; border-right: 1px solid rgba(0, 255, 255, .35); border-bottom: 1px solid rgba(0, 255, 255, .35); }
        #eye-bubble[data-tail="top"]::after { left: var(--tail, 20px); margin-left: -6px; top: -7px; border-left: 1px solid rgba(0, 255, 255, .35); border-top: 1px solid rgba(0, 255, 255, .35); }
        #eye-bubble[data-tail="left"]::after { top: var(--tail, 20px); margin-top: -6px; left: -7px; border-left: 1px solid rgba(0, 255, 255, .35); border-bottom: 1px solid rgba(0, 255, 255, .35); }
        #eye-bubble[data-tail="right"]::after { top: var(--tail, 20px); margin-top: -6px; right: -7px; border-right: 1px solid rgba(0, 255, 255, .35); border-top: 1px solid rgba(0, 255, 255, .35); }
        .eye-bubble .eb-title {
            display: block; color: #00ffff; text-transform: uppercase; font-size: 11px;
            letter-spacing: .08em; font-weight: 600; margin-bottom: 4px;
        }
        .eye-bubble .eb-title:empty { display: none; }
        .eye-bubble .eb-text { display: block; }
        @media (max-width: 420px) {
            .eye-bubble { max-width: calc(100vw - 32px); font-size: 13px; padding: 10px 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
            #eye-bubble { transition: opacity .2s ease; transform: none !important; }
        }`;
    document.head.appendChild(style);
    const make = id => {
        const el = document.createElement('div');
        el.id = id;
        el.className = 'eye-bubble';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="eb-title"></span><span class="eb-text"></span>';
        document.body.appendChild(el);
        return el;
    };
    bubble = make('eye-bubble');
    bubble.setAttribute('role', 'status');
    measurer = make('eye-bubble-measure');
}
function fillBubble(el, text, title) {
    el.querySelector('.eb-title').textContent = title || '';
    el.querySelector('.eb-text').textContent = text || '';
}
// Rozmiar dymka dla danego tekstu, bez ruszania widocznego dymka.
function measureBubble(text, title) {
    fillBubble(measurer, text, title);
    return { w: measurer.offsetWidth || 240, h: measurer.offsetHeight || 70 };
}
let bubbleHiddenAt = 0;
function hideBubble() {
    if (bubble?.classList.contains('is-visible')) bubbleHiddenAt = performance.now();
    bubble?.classList.remove('is-visible');
}
function showBubble(text, title, placement, cx, cy, polite) {
    if (!bubble) return;
    fillBubble(bubble, text, title);
    if (polite) { bubble.removeAttribute('aria-hidden'); bubble.setAttribute('aria-live', 'polite'); }
    else { bubble.setAttribute('aria-hidden', 'true'); bubble.removeAttribute('aria-live'); }
    const { left, top, w, h, tail } = placement;
    bubble.style.left = `${left.toFixed(1)}px`;
    bubble.style.top = `${top.toFixed(1)}px`;
    bubble.dataset.tail = tail;
    // Ogonek zawsze celuje w środek oka, także gdy dymek dosunięto do krawędzi ekranu.
    const tailPos = tail === 'left' || tail === 'right'
        ? clamp(cy - top, 16, Math.max(16, h - 16))
        : clamp(cx - left, 16, Math.max(16, w - 16));
    bubble.style.setProperty('--tail', `${tailPos.toFixed(1)}px`);
    bubble.style.setProperty('--origin', tail === 'bottom' ? `${tailPos}px 100%` : tail === 'top' ? `${tailPos}px 0`
        : tail === 'left' ? `0 ${tailPos}px` : `100% ${tailPos}px`);
    bubble.classList.add('is-visible');
}

// --- ocena, czy dane miejsce zasłania treść ---------------------------------
const CONTENT = 'img, picture, video, figure, svg, canvas, h1, h2, h3, h4, h5, h6, p, li, a, button, input, textarea, blockquote, table';
let contentCache = null; // pamięć próbek na czas jednego planowania (siatka 8 px)
function contentAt(x, y) {
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
    const key = contentCache && `${Math.round(x / 8)},${Math.round(y / 8)}`;
    if (key && contentCache.has(key)) return contentCache.get(key);
    const hit = document.elementsFromPoint(x, y).some(el =>
        !(wrap && wrap.contains(el)) && !el.classList?.contains('eye-bubble')
        && el.id !== 'eye-beam' && el.id !== 'eye-spot-glow' && el.matches?.(CONTENT));
    if (key) contentCache.set(key, hit);
    return hit;
}
function eyeOcclusion(cx, cy, r) {
    return [[cx, cy], [cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]]
        .reduce((score, [x, y]) => score + (contentAt(x, y) ? 1 : 0), 0);
}
function rectOcclusion(left, top, w, h) {
    let score = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (contentAt(left + (w * (i + .5)) / 3, top + (h * (j + .5)) / 3)) score++;
    }
    return score;
}
const rectsOverlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function circleHitsRect(cx, cy, r, rect) {
    const dx = cx - clamp(cx, rect.left, rect.right), dy = cy - clamp(cy, rect.top, rect.bottom);
    return dx * dx + dy * dy < r * r;
}

// Strona dymka przy oku o środku (cx, cy) i promieniu r: nad, obok albo pod,
// zawsze wyśrodkowany względem oka. Zwraca najlepszą propozycję z oceną.
function planBubble(cx, cy, r, w, h, avoid) {
    const M = BUBBLE_MARGIN, g = BUBBLE_GAP;
    const options = [
        { tail: 'bottom', left: cx - w / 2, top: cy - r - g - h },
        { tail: 'left', left: cx + r + g, top: cy - h / 2 },
        { tail: 'right', left: cx - r - g - w, top: cy - h / 2 },
        { tail: 'top', left: cx - w / 2, top: cy + r + g },
    ];
    let best = null;
    options.forEach((o, i) => {
        const left = clamp(o.left, M, Math.max(M, innerWidth - M - w));
        const top = clamp(o.top, M, Math.max(M, innerHeight - M - h));
        const vertical = o.tail === 'bottom' || o.tail === 'top';
        // Przesunięcie w osi "od oka" oznacza, że dymek wjechałby na oko.
        const intoEye = vertical ? Math.abs(top - o.top) : Math.abs(left - o.left);
        let score = rectOcclusion(left, top, w, h) + i * .15;
        if (intoEye > 4) score += 20;
        if (avoid && rectsOverlap({ left, top, right: left + w, bottom: top + h }, avoid)) score += 10;
        if (!best || score < best.score) best = { left, top, w, h, tail: o.tail, score };
    });
    return best;
}

// Miejsce parkowania oka na czas komentarza: kandydaci wokół elementu
// (albo siatka ekranu dla dużych elementów), oceniani razem z dymkiem.
function planPark({ rect, from, pointer, half, w, h }) {
    const r = half * .8, m = half + 6;
    const big = rect && (rect.width > innerWidth * .6 || rect.height > innerHeight * .45);
    const candidates = [];
    if (rect && !big) {
        const g = r + 14;
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const px = pointer ? clamp(pointer.x, rect.left, rect.right) : cx;
        for (const x of new Set([px, cx])) candidates.push([x, rect.top - g, 0], [x, rect.bottom + g, 0]);
        candidates.push([rect.left - g, cy, 0], [rect.right + g, cy, 0],
            [rect.left - g, rect.top - g, 0], [rect.right + g, rect.top - g, 0],
            [rect.left - g, rect.bottom + g, 0], [rect.right + g, rect.bottom + g, 0]);
    }
    // Siatka ekranu: jedyne wyjście przy dużych elementach, zapas przy małych.
    const gridPenalty = rect && !big ? 3 : 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        candidates.push([m + (innerWidth - 2 * m) * i / 3, m + (innerHeight - 2 * m) * j / 2, gridPenalty]);
    }

    contentCache = new Map();
    let best = null;
    for (const [rawX, rawY, penalty] of candidates) {
        const x = clamp(rawX, m, Math.max(m, innerWidth - m));
        const y = clamp(rawY, m, Math.max(m, innerHeight - m));
        let score = penalty + eyeOcclusion(x, y, r) * 2 + Math.hypot(x - from.x, y - from.y) * .003;
        if (rect && circleHitsRect(x, y, r, rect)) score += 10;
        if (pointer && Math.hypot(x - pointer.x, y - pointer.y) < r + 60) score += 6;
        if (best && score >= best.score) continue; // dymek i tak nie poprawi wyniku
        const placement = planBubble(x, y, r, w, h, rect);
        score += placement.score;
        if (!best || score < best.score) best = { x, y, placement, score };
    }
    contentCache = null;
    return best;
}

// Czy użytkownik faktycznie widzi element: nie jest ukryty (np. linki zamkniętego
// menu mobilnego — nakładka na cały ekran z visibility: hidden, więc zawsze
// "na środku") i nic go nie przykrywa w jego widocznym środku (nagłówek, menu).
function isSeen(el, r) {
    if (el.checkVisibility) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    } else {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    }
    const x = clamp(r.left + r.width / 2, 1, innerWidth - 1);
    const y = clamp((Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2, 1, innerHeight - 1);
    const hit = document.elementsFromPoint(x, y)
        .find(h => !wrap.contains(h) && !h.classList.contains('eye-bubble'));
    return !!hit && (hit === el || el.contains(hit));
}

// Dotyk: element [data-eye] najbliższy środka ekranu, w środkowym pasie widoku
// i widoczny co najmniej w połowie; przy remisie wygrywa mniejszy (wewnętrzny).
function pickTouchTarget() {
    const vh = innerHeight;
    let best = null, bestDist = Infinity, bestArea = Infinity;
    document.querySelectorAll('[data-eye]').forEach(el => {
        if (wrap.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.height <= 0 || r.bottom <= 0 || r.top >= vh) return;
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (visible / r.height < .5) return;
        const cy = r.top + r.height / 2;
        if (cy < vh * .3 || cy > vh * .7) return;
        if (!isSeen(el, r)) return;
        const dist = Math.abs(cy - vh / 2), area = r.width * r.height;
        if (dist < bestDist - 1 || (Math.abs(dist - bestDist) <= 1 && area < bestArea)) {
            best = el; bestDist = dist; bestArea = area;
        }
    });
    return best;
}

if (wrap) {
    try {
        const { ObserverEye } = await import('./eye-observer.js?v=20260923');

        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
        const flight = !('noflight' in wrap.dataset) && !reduced;
        const commentsEnabled = !('noflight' in wrap.dataset);

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

        // Oko (i jego dymek) zawsze nad treścią strony: ponad nagłówkiem (100),
        // pod kursorem (9999) i lightboxem (10001).
        if (commentsEnabled) { wrap.style.zIndex = '9000'; initBubble(); }

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

        const size = () => wrap.clientWidth || 120;
        let pointer = null;
        if (finePointer) addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });

        // --- stan lotu i komentarza -----------------------------------------
        // mode: 'free' — zwykły lot; 'travel' — szybki dolot na miejsce komentarza;
        //       'hold' — oko stoi, dymek widoczny.
        const state = {
            x: innerWidth * .8, y: innerHeight * .72, vx: 0, vy: 0,
            tx: innerWidth * .8, ty: innerHeight * .72,
            followX: 170, followY: 130, occTimer: 0, wanderTimer: 0,
            spot: null, drift: 1, mode: 'free', travelStart: 0,
        };
        let comment = null; // { el, text, title, polite, park }
        let introRunning = false;
        let greetingTimers = [];
        const clearGreeting = () => { greetingTimers.forEach(clearTimeout); greetingTimers = []; };

        function eyeCentre() {
            if (flight) return { x: state.x, y: state.y };
            const r = wrap.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }

        // Rozpoczęcie (albo ponowne zaplanowanie) komentarza.
        function startComment(next) {
            comment = next;
            hideBubble();
            const half = size() / 2;
            const { w, h } = measureBubble(next.text, next.title);
            const rect = next.el ? next.el.getBoundingClientRect() : null;
            if (flight) {
                next.park = planPark({ rect, from: { x: state.x, y: state.y }, pointer, half, w, h });
                state.mode = 'travel';
                state.travelStart = performance.now();
            } else {
                // Bez lotu oko stoi w miejscu z CSS — wybieramy tylko stronę dymka.
                const c = eyeCentre();
                if (next.el && !finePointer) eye.focusElement(next.el);
                showBubble(next.text, next.title, planBubble(c.x, c.y, half * .8, w, h, rect), c.x, c.y, next.polite);
            }
        }
        function commentOn(el, force) {
            if (!commentsEnabled || introRunning) return;
            if (!force && comment?.el === el) return;
            clearGreeting();
            startComment({ el, text: el.dataset.eye || '', title: el.dataset.eyeTitle || '' });
        }
        function endComment() {
            clearGreeting();
            comment = null;
            state.mode = 'free';
            hideBubble();
        }
        // Przewijanie/zmiana rozmiaru: dymek znika od razu, oko lata swobodnie,
        // a po uspokojeniu strony komentarz jest planowany od nowa.
        function suspendComment() {
            if (!comment) return;
            hideBubble();
            state.mode = 'free';
        }

        // --- desktop: najechanie ---------------------------------------------
        let hoverEl = null, hoverTimer = null;
        function setHover(el) {
            if (el === hoverEl) return;
            hoverEl = el;
            clearTimeout(hoverTimer);
            // Krótka zwłoka: przelot kursorem przez stronę nie odpala komentarzy,
            // a wyjście poza element nie gasi dymka od razu.
            hoverTimer = el
                ? setTimeout(() => commentOn(el), comment ? 90 : 140)
                : setTimeout(() => { if (!hoverEl && comment && !comment.polite) endComment(); }, 500);
        }
        function elementUnder(x, y) {
            const hit = document.elementsFromPoint(x, y)
                .find(el => !wrap.contains(el) && !el.classList.contains('eye-bubble'));
            return hit?.closest('[data-eye]') || null;
        }
        if (commentsEnabled && finePointer) {
            document.addEventListener('pointerover', e => {
                if (!(e.target instanceof Element) || wrap.contains(e.target) || introRunning) return;
                setHover(e.target.closest('[data-eye]'));
                if (flight) {
                    const link = e.target.closest('a, button, [role="button"]');
                    state.spot = link && !link.closest('[data-eye]') ? link : null;
                }
            }, { passive: true });
            document.documentElement.addEventListener('pointerleave', () => { setHover(null); state.spot = null; });
        }

        // --- dotyk: to, co jest na środku ekranu -------------------------------
        let scrolled = false;
        function lookAgain() {
            if (!commentsEnabled || introRunning) return;
            if (finePointer) {
                const el = pointer ? elementUnder(pointer.x, pointer.y) : null;
                hoverEl = el;
                if (el) commentOn(el, true);
                else if (comment && !comment.polite) endComment();
            } else if (scrolled) {
                const el = pickTouchTarget();
                if (el) commentOn(el, true);
                else endComment();
            }
        }
        let settleTimer = null;
        const onLayoutChange = () => {
            if (introRunning) return;
            // Pierwsze przewinięcie kończy powitanie.
            if (comment?.polite) endComment();
            suspendComment();
            state.occTimer = 0;
            clearTimeout(settleTimer);
            settleTimer = setTimeout(lookAgain, 200);
        };
        addEventListener('scroll', () => { scrolled = true; onLayoutChange(); }, { passive: true });
        addEventListener('resize', onLayoutChange, { passive: true });

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

            // Sprężyna półukryta: ten sam model co w poprzedniej maskotce.
            function spring(pos, vel, target, dt, freq, damping) {
                const f = 1 + 2 * dt * damping * freq, ff = freq * freq;
                const det = 1 / (f + dt * dt * ff);
                return [(pos * f + dt * vel + dt * dt * ff * target) * det, (vel + dt * ff * (target - pos)) * det];
            }

            function wander() {
                const m = size() * .7, r = size() * .4;
                let best = Infinity;
                for (let i = 0; i < 6 && best > 0; i++) {
                    const x = m + Math.random() * Math.max(1, innerWidth - m * 2);
                    const y = m + Math.random() * Math.max(1, innerHeight - m * 2);
                    const score = eyeOcclusion(x, y, r);
                    if (score < best) { best = score; state.tx = x; state.ty = y; }
                }
                state.wanderTimer = 9 + Math.random() * 10;
            }
            wander();

            let frame = 0, previous = 0;
            function tick(now) {
                frame = requestAnimationFrame(tick);
                const dt = Math.min((now - (previous || now)) / 1000, .05);
                previous = now;
                const half = size() / 2;
                const asleep = eye.mode === 'sleeping';

                if (state.spot && !document.contains(state.spot)) state.spot = null;
                if (comment?.el && !document.contains(comment.el)) endComment();

                const parked = state.mode !== 'free' && comment?.park;
                let freq = .35;
                if (parked) {
                    // Szybki, krytycznie tłumiony dolot bez dryfu — bez przestrzelenia.
                    state.tx = comment.park.x; state.ty = comment.park.y;
                    freq = 11;
                } else if (state.spot && !asleep) {
                    // Zatrzymanie po zewnętrznej stronie linku, żeby go nie zasłaniać.
                    const r = state.spot.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const dx = state.x - cx, dy = state.y - cy, len = Math.hypot(dx, dy) || 1;
                    const standoff = Math.max(r.width, r.height) / 2 + size() * .85;
                    state.tx = cx + (dx / len) * standoff;
                    state.ty = cy + (dy / len) * standoff;
                    freq = .95;
                } else if (pointer && !asleep) {
                    // Dryf za kursorem w najmniej zasłoniętej ćwiartce.
                    state.occTimer -= dt;
                    if (state.occTimer <= 0) {
                        state.occTimer = .5;
                        let best = Infinity;
                        for (const sx of [1, -1]) for (const sy of [1, -1]) {
                            const score = eyeOcclusion(pointer.x + sx * 170, pointer.y + sy * 130, half * .8);
                            if (score < best) { best = score; state.followX = sx * 170; state.followY = sy * 130; }
                        }
                    }
                    state.tx = pointer.x + state.followX;
                    state.ty = pointer.y + state.followY;
                } else {
                    state.wanderTimer -= dt;
                    if (state.wanderTimer <= 0) wander();
                }

                // Dryf gaśnie szybko przy komentarzu i wraca łagodnie po nim.
                state.drift += ((parked ? 0 : 1) - state.drift) * Math.min(1, dt * (parked ? 10 : 1.6));
                const driftX = (Math.sin(now / 3200) * 24 + Math.sin(now / 7700 + 2) * 16) * state.drift;
                const driftY = (Math.cos(now / 4300) * 20 + Math.sin(now / 5900 + 5) * 14) * state.drift;

                if (state.mode === 'hold') {
                    state.x = comment.park.x; state.y = comment.park.y; state.vx = state.vy = 0;
                } else {
                    [state.x, state.vx] = spring(state.x, state.vx, state.tx + driftX, dt, freq, 1);
                    [state.y, state.vy] = spring(state.y, state.vy, state.ty + driftY, dt, freq, 1);
                    state.x = clamp(state.x, half, Math.max(half, innerWidth - half));
                    state.y = clamp(state.y, half, Math.max(half, innerHeight - half));
                }

                // Dolot zakończony: oko staje, dymek pojawia się już przy nim.
                if (state.mode === 'travel' && comment?.park) {
                    const { x, y, placement } = comment.park;
                    const arrived = Math.hypot(state.x - x, state.y - y) < 3 && Math.hypot(state.vx, state.vy) < 60;
                    if ((arrived || now - state.travelStart > 1400) && now - bubbleHiddenAt > 200) {
                        state.mode = 'hold';
                        state.x = x; state.y = y; state.vx = state.vy = 0;
                        showBubble(comment.text, comment.title, placement, x, y, comment.polite);
                        // Na dotyku krótkie "skupienie" (zwężona źrenica) na opisywanym elemencie.
                        if (!finePointer && comment.el) eye.trigger('focused', 1.1);
                    }
                }

                wrap.style.transform = `translate3d(${(state.x - half).toFixed(1)}px, ${(state.y - half).toFixed(1)}px, 0)`;

                // Przechył w kierunku lotu.
                eye.bank += (clamp(-state.vx * .0016, -.18, .18) - eye.bank) * Math.min(1, dt * 2);

                // Na dotyku nie ma kursora: przy komentarzu oko patrzy na opisywany
                // element. Kierunek wydłużamy do ~320 px, żeby zwrot był wyraźny także
                // przy bliskim celu, i podtrzymujemy aktywność, żeby nie przeszło
                // w rozglądanie się (curious) w trakcie komentarza.
                if (!finePointer && parked && comment.el) {
                    const r = comment.el.getBoundingClientRect();
                    const dx = r.left + r.width / 2 - state.x, dy = r.top + r.height / 2 - state.y;
                    const k = Math.max(1, 320 / (Math.hypot(dx, dy) || 1));
                    eye.lookAt(state.x + dx * k, state.y + dy * k);
                    eye.lastActivity = eye.time;
                } else if (pointer && eye.options.tracking) {
                    // Kursor zna już pozycję oka; po locie trzeba przeliczyć kierunek patrzenia.
                    eye.lookAt(pointer.x, pointer.y);
                }

                const target = parked ? comment.el : state.spot;
                if (target && !asleep) {
                    const r = target.getBoundingClientRect();
                    const big = r.width > innerWidth * .6 || r.height > innerHeight * .45;
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const bdx = cx - state.x, bdy = cy - state.y;
                    beam.style.width = `${Math.hypot(bdx, bdy).toFixed(0)}px`;
                    beam.style.transform = `translate3d(${state.x.toFixed(1)}px, ${(state.y - 45).toFixed(1)}px, 0) rotate(${Math.atan2(bdy, bdx)}rad)`;
                    beam.style.opacity = big ? '0' : '1';
                    const gw = Math.max(r.width, r.height) * 1.5;
                    spotGlow.style.width = spotGlow.style.height = `${gw.toFixed(0)}px`;
                    spotGlow.style.transform = `translate3d(${(cx - gw / 2).toFixed(1)}px, ${(cy - gw / 2).toFixed(1)}px, 0)`;
                    spotGlow.style.opacity = big ? '0' : '1';
                } else {
                    beam.style.opacity = '0';
                    spotGlow.style.opacity = '0';
                }
            }

            // Podczas intra host zajmuje cały ekran — lot rusza dopiero po złożeniu oka.
            document.addEventListener('visibilitychange', () => {
                cancelAnimationFrame(frame); previous = 0;
                if (!document.hidden && !introRunning) frame = requestAnimationFrame(tick);
            });
            addEventListener('pagehide', () => cancelAnimationFrame(frame));

            // Powitanie po intrze: oko przelatuje w wolne miejsce i stoi, póki mówi.
            function greet() {
                if (!commentsEnabled) return;
                const lines = [
                    'Cześć, jestem obserwatorem tego portfolio, ale będę też obserwował Ciebie.',
                    'Kliknij mnie dwa razy, jeśli Ty chcesz poobserwować mnie.',
                ];
                startComment({ el: null, text: lines[0], title: '', polite: true });
                greetingTimers.push(setTimeout(() => {
                    if (!comment?.polite) return;
                    // Druga kwestia w tym samym miejscu: tylko nowa strona dymka.
                    const { x, y } = comment.park;
                    const { w, h } = measureBubble(lines[1], '');
                    const placement = planBubble(x, y, size() / 2 * .8, w, h, null);
                    comment.park.placement = placement;
                    comment.text = lines[1];
                    hideBubble();
                    greetingTimers.push(setTimeout(() => {
                        if (comment?.polite && state.mode === 'hold') showBubble(lines[1], '', placement, x, y, true);
                    }, 240));
                }, 4500));
                greetingTimers.push(setTimeout(() => { if (comment?.polite) endComment(); }, 4500 + 6000));
            }

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
                    await eye.playAssembly({ duration: 2.6 });
                    // Zamiana pełnoekranowego kadru na mały, latający canvas — bez skoku:
                    // najpierw wracamy do normalnego rozmiaru/pozycji, a dopiero potem startuje lot.
                    wrap.style.width = ''; wrap.style.height = ''; wrap.style.aspectRatio = '';
                    wrap.style.pointerEvents = '';
                    eye.setFraming(null); eye.resize();
                    const half = size() / 2;
                    wrap.style.transform = `translate3d(${(state.x - half).toFixed(1)}px, ${(state.y - half).toFixed(1)}px, 0)`;
                    introRunning = false;
                    greet();
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
