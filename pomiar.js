/* ==========================================================================
   Pomiar (m-jaro.pl): Google Ads + GA4 (Consent Mode v2), Microsoft Clarity,
   konwersje, baner zgód.

   Wpinać w <head> ZWYKŁYM <script src="pomiar.js"></script> (bez defer/async):
   domyślne zgody muszą być ustawione, zanim załaduje się gtag.js.

   - Domyślnie wszystko „denied”. Tag ładuje się zawsze – bez zgody Google dostaje
     tylko pingi bez cookies (tak działa Consent Mode; blokowanie tagu je psuje).
   - Konwersje: klik w każdy link tel: i mailto: na stronie (nasłuch delegowany,
     obejmuje też linki dodane później). Etykiety z konta – `ads-manager plan m-jaro`
     sprawdza, czy są tu te same, co w Google Ads.
   - url_passthrough: bez zgody gclid idzie w linkach wewnętrznych, więc klik w telefon
     na innej podstronie niż strona docelowa reklamy nadal się przypisze.
   - GA4: ten sam gtag.js, config dopiero po „load” i w wolnej chwili przeglądarki –
     żeby nie dokładać pracy w trakcie ładowania ciężkiej strony. Bez zgody pingi bez
     cookies, jak w Ads. Klik w tel:/mailto: idzie też do GA4 jako generate_lead.
   - Clarity (nagrania sesji, mapy cieplne): ładowana WYŁĄCZNIE po zgodzie „tak”,
     też dopiero po „load” – kto odmówi, nie pobiera jej wcale. Cofnięcie zgody:
     clarity('consent', false) kasuje jej cookies i zatrzymuje nagrywanie.
   - Wybór zapisany w localStorage („mj-zgody”). Zmiana: window.mjZgody() (link w stopce
     polityki cookies).
   ========================================================================== */
(function () {
    var AW = 'AW-18340626804';
    var KONWERSJE = {
        // pełne send_to jak w Google Ads – `ads-manager plan` szuka ich dosłownie
        tel: 'AW-18340626804/L0XuCOyi3aodEPSCv6lE',     // MJ – Telefon klik
        mailto: 'AW-18340626804/iGr6CO-i3aodEPSCv6lE'   // MJ – E-mail klik
    };
    var GA4 = 'G-2F6MM2QZ49';            // strumień m-jaro.pl w GA4
    var CLARITY = 'z5rblhvwsz';    // projekt m-jaro.pl w Microsoft Clarity
    var KLUCZ = 'mj-zgody';
    var clarityWlaczona = false;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        wait_for_update: 500
    });
    gtag('set', 'url_passthrough', true);
    gtag('set', 'ads_data_redaction', true);

    function odczytaj() {
        try { return localStorage.getItem(KLUCZ); } catch (e) { return null; }
    }
    function zapisz(wartosc) {
        try { localStorage.setItem(KLUCZ, wartosc); } catch (e) { /* tryb prywatny */ }
    }
    function ustaw(wartosc) {
        var stan = wartosc === 'tak' ? 'granted' : 'denied';
        gtag('consent', 'update', {
            ad_storage: stan,
            ad_user_data: stan,
            ad_personalization: stan,
            analytics_storage: stan
        });
        if (stan === 'granted') {
            poZaladowaniu(wlaczClarity);
        } else if (clarityWlaczona) {
            window.clarity('consent', false);
        }
    }

    // po „load”, w wolnej chwili przeglądarki (Safari bez requestIdleCallback: 1,5 s)
    function poZaladowaniu(fn) {
        function bezczynnie() {
            if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 4000 });
            else setTimeout(fn, 1500);
        }
        if (document.readyState === 'complete') bezczynnie();
        else window.addEventListener('load', bezczynnie);
    }

    function wlaczClarity() {
        if (clarityWlaczona) return;
        clarityWlaczona = true;
        window.clarity = window.clarity || function () {
            (window.clarity.q = window.clarity.q || []).push(arguments);
        };
        var t = document.createElement('script');
        t.async = true;
        t.src = 'https://www.clarity.ms/tag/' + CLARITY;
        document.head.appendChild(t);
        window.clarity('consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' });
    }

    var wybor = odczytaj();
    if (wybor) ustaw(wybor);

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', AW);
    poZaladowaniu(function () { gtag('config', GA4); });

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
        if (!a) return;
        var rodzaj = a.getAttribute('href').indexOf('tel:') === 0 ? 'tel' : 'mailto';
        gtag('event', 'conversion', { send_to: KONWERSJE[rodzaj], value: 1.0, currency: 'PLN' });
        gtag('event', 'generate_lead', { send_to: GA4, metoda: rodzaj === 'tel' ? 'telefon' : 'e-mail' });
    }, true);

    /* ---------------------------------------------------------------- baner */
    // Wygląd jak płyta K z cennika: arkusz papieru z paskiem kontrolnym C/M/Y/K.
    // z-index poniżej własnego kursora strony (.cursor = 9999), inaczej mysz znika
    // pod banerem, bo systemowy kursor jest ukryty (cursor: none).
    var CSS =
        '#mj-zgody{position:fixed;left:24px;bottom:24px;z-index:9000;' +
        'width:min(440px,calc(100vw - 32px));box-sizing:border-box;' +
        'background:#1a1a1a;color:#d9d9d9;border:1px solid #333;border-radius:16px;' +
        'padding:22px 24px 24px;overflow:hidden;' +
        'font:300 1rem/1.6 "Space Grotesk",system-ui,sans-serif;' +
        'opacity:0;transform:translateY(24px);' +
        'transition:opacity .5s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}' +
        '#mj-zgody.mj-z-widoczny{opacity:1;transform:none}' +
        '#mj-zgody.mj-z-znika{opacity:0;transform:translateY(16px);transition-duration:.25s}' +
        // pasek kontrolny drukarni: cztery farby na górnej krawędzi
        '#mj-zgody::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;' +
        'background:linear-gradient(90deg,#00ffff 0 25%,#ff00ff 25% 50%,#ffff00 50% 75%,#f8f6f4 75%)}' +
        '#mj-zgody .mj-z-etykieta{display:flex;align-items:center;gap:8px;margin:0 0 10px;' +
        'font:500 .75rem/1 "Space Grotesk",system-ui,sans-serif;letter-spacing:.1em;' +
        'text-transform:uppercase;color:#888}' +
        '#mj-zgody .mj-z-etykieta svg{flex:none}' +
        '#mj-zgody h2{margin:0 0 8px;font:500 1.35rem/1.25 "Space Grotesk",system-ui,sans-serif;' +
        'color:#f8f6f4;letter-spacing:-.01em;text-transform:none}' +
        '#mj-zgody p{margin:0 0 20px;max-width:46ch}' +
        '#mj-zgody a{color:#00ffff;text-underline-offset:3px;white-space:nowrap}' +
        '#mj-zgody a:hover{text-decoration-thickness:2px}' +
        '#mj-zgody .mj-z-przyciski{display:flex;flex-wrap:wrap;gap:10px}' +
        '#mj-zgody button{flex:1 1 140px;min-height:46px;margin:0;' +
        'font:500 .85rem/1 "Space Grotesk",system-ui,sans-serif;letter-spacing:.05em;' +
        'text-transform:uppercase;padding:14px 18px;border-radius:12px;' +
        'border:1px solid #00ffff;background:transparent;color:#00ffff;' +
        'transition:background-color .3s,color .3s,border-color .3s,box-shadow .4s,' +
        'transform .4s cubic-bezier(.165,.84,.44,1)}' +
        '#mj-zgody button:hover{transform:translateY(-2px)}' +
        '#mj-zgody button.mj-z-tak{background:#00ffff;color:#050505}' +
        '#mj-zgody button.mj-z-tak:hover{box-shadow:0 0 30px rgba(0,255,255,.3)}' +
        '#mj-zgody button.mj-z-nie{border-color:#333;color:#d9d9d9}' +
        '#mj-zgody button.mj-z-nie:hover{border-color:#00ffff;color:#00ffff}' +
        '#mj-zgody button:active{transform:translateY(0)}' +
        '#mj-zgody button:focus-visible,#mj-zgody a:focus-visible{outline:2px solid #00ffff;outline-offset:4px}' +
        '@media (max-width:600px){#mj-zgody{left:16px;bottom:16px;padding:20px 18px 18px}}' +
        '@media (prefers-reduced-motion:reduce){#mj-zgody,#mj-zgody button{transition:opacity .2s}' +
        '#mj-zgody{transform:none}}';

    // znak pasowania, jak na marginesie arkusza drukarskiego
    var ZNAK =
        '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" ' +
        'stroke="currentColor" stroke-width="1.2"><circle cx="7" cy="7" r="3.5"/>' +
        '<path d="M7 0v14M0 7h14"/></svg>';

    function pokaz() {
        if (document.getElementById('mj-zgody')) return;
        if (!document.getElementById('mj-zgody-css')) {
            var st = document.createElement('style');
            st.id = 'mj-zgody-css';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        var box = document.createElement('div');
        box.id = 'mj-zgody';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-labelledby', 'mj-zgody-tytul');
        box.setAttribute('data-eye-title', 'Pliki cookies');
        box.setAttribute('data-eye', 'Google podpowiada mi, która reklama Cię tu przyprowadziła. Odmówisz? Nie obrażę się.');
        box.innerHTML =
            '<div class="mj-z-etykieta">' + ZNAK + 'Próba koloru: cookies</div>' +
            '<h2 id="mj-zgody-tytul">Kto Cię tu przysłał?</h2>' +
            '<p>Pliki cookies Google i Microsoft Clarity podpowiadają mi, która reklama Cię ' +
            'przyprowadziła i co na stronie jest czytelne, a co nie. Bez zgody strona działa ' +
            'dokładnie tak samo. ' +
            '<a href="/cookies.html">Co dokładnie zbieram</a></p>' +
            '<div class="mj-z-przyciski">' +
            '<button type="button" class="mj-z-tak" data-eye-title="Pozwalam" ' +
            'data-eye="Dzięki! Teraz wiem, gdzie warto się reklamować, a gdzie szkoda pieniędzy.">Pozwalam</button>' +
            '<button type="button" class="mj-z-nie" data-eye-title="Wolę bez cookies" ' +
            'data-eye="Też dobrze. Zostają tylko pliki niezbędne do działania strony.">Wolę bez cookies</button></div>';
        box.querySelector('.mj-z-tak').onclick = function () { wybierz('tak'); };
        box.querySelector('.mj-z-nie').onclick = function () { wybierz('nie'); };

        // własny kursor strony powiększa się nad linkami; podpięcie dzieje się przy
        // ładowaniu strony, więc elementy banera trzeba dopiąć tutaj
        var kursor = document.querySelector('.cursor');
        if (kursor) {
            box.querySelectorAll('a, button').forEach(function (el) {
                el.addEventListener('mouseenter', function () { kursor.classList.add('hovered'); });
                el.addEventListener('mouseleave', function () { kursor.classList.remove('hovered'); });
            });
        }

        document.body.appendChild(box);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { box.classList.add('mj-z-widoczny'); });
        });
    }
    function wybierz(wartosc) {
        zapisz(wartosc);
        ustaw(wartosc);
        var box = document.getElementById('mj-zgody');
        if (!box) return;
        var kursor = document.querySelector('.cursor');
        if (kursor) kursor.classList.remove('hovered');
        box.classList.add('mj-z-znika');
        setTimeout(function () { box.remove(); }, 260);
    }
    window.mjZgody = pokaz;

    if (!wybor) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', pokaz);
        } else {
            pokaz();
        }
    }
})();
