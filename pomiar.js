/* ==========================================================================
   Pomiar Google Ads (m-jaro.pl): Consent Mode v2, tag, konwersje, baner zgód.

   Wpinać w <head> ZWYKŁYM <script src="pomiar.js"></script> (bez defer/async):
   domyślne zgody muszą być ustawione, zanim załaduje się gtag.js.

   - Domyślnie wszystko „denied”. Tag ładuje się zawsze – bez zgody Google dostaje
     tylko bezciasteczkowe pingi (tak działa Consent Mode; blokowanie tagu je psuje).
   - Konwersje: klik w każdy link tel: i mailto: na stronie (nasłuch delegowany,
     obejmuje też linki dodane później). Etykiety z konta – `ads-manager plan m-jaro`
     sprawdza, czy są tu te same, co w Google Ads.
   - url_passthrough: bez zgody gclid idzie w linkach wewnętrznych, więc klik w telefon
     na innej podstronie niż strona docelowa reklamy nadal się przypisze.
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
    var KLUCZ = 'mj-zgody';

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
    }

    var wybor = odczytaj();
    if (wybor) ustaw(wybor);

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', AW);

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
        if (!a) return;
        var rodzaj = a.getAttribute('href').indexOf('tel:') === 0 ? 'tel' : 'mailto';
        gtag('event', 'conversion', { send_to: KONWERSJE[rodzaj], value: 1.0, currency: 'PLN' });
    }, true);

    /* ---------------------------------------------------------------- baner */
    var CSS =
        '#mj-zgody{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;' +
        'max-width:560px;margin:0 auto;background:#1a1a1a;color:#d9d9d9;' +
        'border:1px solid #333;border-radius:12px;padding:18px 20px;' +
        'font:400 15px/1.55 "Space Grotesk",system-ui,sans-serif;' +
        'box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
        '#mj-zgody p{margin:0 0 14px}' +
        '#mj-zgody a{color:#00ffff}' +
        '#mj-zgody .mj-z-przyciski{display:flex;flex-wrap:wrap;gap:10px}' +
        '#mj-zgody button{font:500 14px/1 "Space Grotesk",system-ui,sans-serif;' +
        'letter-spacing:.05em;padding:12px 20px;border-radius:12px;cursor:pointer;' +
        'border:1px solid #00ffff;background:transparent;color:#00ffff}' +
        '#mj-zgody button.mj-z-tak{background:#00ffff;color:#050505}' +
        '#mj-zgody button:focus-visible{outline:2px solid #ff00ff;outline-offset:2px}';

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
        box.setAttribute('aria-label', 'Zgoda na pliki cookies');
        box.innerHTML =
            '<p>Używam plików cookies Google Ads, żeby wiedzieć, które reklamy przyprowadzają ' +
            'klientów. Bez zgody strona działa tak samo. ' +
            '<a href="/cookies.html">Szczegóły</a></p>' +
            '<div class="mj-z-przyciski">' +
            '<button type="button" class="mj-z-tak">Akceptuję</button>' +
            '<button type="button" class="mj-z-nie">Tylko niezbędne</button></div>';
        box.querySelector('.mj-z-tak').onclick = function () { wybierz('tak'); };
        box.querySelector('.mj-z-nie').onclick = function () { wybierz('nie'); };
        document.body.appendChild(box);
    }
    function wybierz(wartosc) {
        zapisz(wartosc);
        ustaw(wartosc);
        var box = document.getElementById('mj-zgody');
        if (box) box.remove();
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
