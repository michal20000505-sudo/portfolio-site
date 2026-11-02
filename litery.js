// Efekt z tytułu strony głównej: litery odbijają się po najechaniu i strzepują z siebie pył.
// Działa na wszystkich h1 i h2 strony. Wpinać w <head>: <script src="litery.js?v=…" defer></script>
// index.html ma własną wersję (klasa .letter), dlatego nagłówki z .letter są tu pomijane.
(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const style = document.createElement('style');
    style.textContent = `
        .slowo { display: inline-block; white-space: nowrap; }
        .litera { display: inline-block; position: relative; z-index: 10; transition: color 0.3s ease-out; }
        /* Reguły stron typu .motion-title span nie mogą przebarwiać liter: kolor ma przyjść z rodzica. */
        .slowo.slowo.slowo, .litera.litera.litera { color: inherit; }
        .litera.odbija { animation: literaOdbicie 1s forwards; }
        .pyl { position: fixed; border-radius: 50%; pointer-events: none; opacity: 0; }
        @keyframes literaOdbicie {
            0% { transform: scale3d(1, 1, 1); color: inherit; text-shadow: none; }
            30% { transform: scale3d(1.15, 0.85, 1); color: var(--litera-kolor); text-shadow: 0 0 10px var(--litera-kolor); }
            40% { transform: scale3d(0.85, 1.15, 1); }
            50% { transform: scale3d(1.05, 0.95, 1); color: var(--litera-kolor); text-shadow: 0 0 5px var(--litera-kolor); }
            65% { transform: scale3d(0.98, 1.02, 1); }
            75% { transform: scale3d(1.02, 0.98, 1); }
            100% { transform: scale3d(1, 1, 1); color: inherit; text-shadow: none; }
        }
        @keyframes literaPyl {
            0% { transform: translate(0, 0) scale(1); opacity: 1; }
            100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    function rozbij(naglowek) {
        const walker = document.createTreeWalker(naglowek, NodeFilter.SHOW_TEXT);
        const wezly = [];
        let wezel;
        while ((wezel = walker.nextNode())) {
            if (wezel.textContent.trim() && !wezel.parentElement.closest('.slowo')) wezly.push(wezel);
        }
        wezly.forEach((tekst) => {
            const fragment = document.createDocumentFragment();
            let slowo = null;
            for (const znak of tekst.textContent) {
                if (/\s/.test(znak)) {
                    slowo = null;
                    fragment.appendChild(document.createTextNode(znak));
                } else {
                    if (!slowo) {
                        slowo = document.createElement('span');
                        slowo.className = 'slowo';
                        fragment.appendChild(slowo);
                    }
                    const litera = document.createElement('span');
                    litera.className = 'litera';
                    litera.textContent = znak;
                    slowo.appendChild(litera);
                }
            }
            tekst.parentNode.replaceChild(fragment, tekst);
        });
        return wezly.length > 0;
    }

    function przygotuj(naglowek) {
        // Czytniki ekranu dostają całe słowa, nie pojedyncze litery.
        const wlasnaEtykieta = naglowek.hasAttribute('aria-label') && !naglowek.dataset.litery;
        if (!rozbij(naglowek) && naglowek.dataset.litery) return;
        naglowek.dataset.litery = '1';
        if (!wlasnaEtykieta) naglowek.setAttribute('aria-label', naglowek.textContent.trim().replace(/\s+/g, ' '));
    }

    document.querySelectorAll('h1, h2').forEach((naglowek) => {
        if (naglowek.closest('#mj-zgody') || naglowek.querySelector('.letter')) return;
        if (!naglowek.textContent.trim()) return;
        przygotuj(naglowek);
        // Zmiana języka (press kit) podmienia tekst nagłówka: litery trzeba rozbić od nowa.
        const obserwator = new MutationObserver(() => {
            obserwator.disconnect();
            przygotuj(naglowek);
            obserwator.observe(naglowek, { childList: true });
        });
        obserwator.observe(naglowek, { childList: true });
    });

    function pyl(litera, kolor) {
        const r = litera.getBoundingClientRect();
        const ile = 6 + Math.random() * 4;
        for (let i = 0; i < ile; i++) {
            const d = document.createElement('div');
            const rozmiar = Math.random() * 3 + 2;
            const kat = Math.random() * Math.PI * 2;
            const dystans = Math.random() * 120 + 60;
            d.className = 'pyl';
            d.style.cssText =
                `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;` +
                `width:${rozmiar}px;height:${rozmiar}px;background:${kolor};box-shadow:0 0 5px ${kolor};` +
                `--tx:${Math.cos(kat) * dystans}px;--ty:${Math.sin(kat) * dystans}px;` +
                'animation:literaPyl 4s cubic-bezier(0.2, 1, 0.3, 1) forwards';
            document.body.appendChild(d);
            setTimeout(() => d.remove(), 4000);
        }
    }

    document.addEventListener('mouseover', (e) => {
        const litera = e.target.closest && e.target.closest('.litera');
        if (!litera) return;
        // Kolor odbicia i pyłu bierzemy z samej litery, dopóki nie trwa animacja.
        if (!litera.classList.contains('odbija')) {
            litera.style.setProperty('--litera-kolor', getComputedStyle(litera).color);
        }
        const kolor = litera.style.getPropertyValue('--litera-kolor');
        litera.classList.remove('odbija');
        void litera.offsetWidth;
        litera.classList.add('odbija');
        clearTimeout(litera.pylTimer);
        litera.pylTimer = setTimeout(() => pyl(litera, kolor), 400);
        litera.addEventListener('animationend', () => litera.classList.remove('odbija'), { once: true });
    });
})();
