// Wspólny header: Esc zamyka menu (otwieranie i zamykanie obsługuje skrypt strony).
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const toggle = document.querySelector('.menu-toggle');
    if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.click();
        toggle.focus();
    }
});

// Stały pasek kontaktu na telefonie: tylko strony z <body data-kontakt-temat="temat maila">.
(function () {
    const temat = document.body.dataset.kontaktTemat;
    if (temat === undefined) return;
    const pasek = document.createElement('nav');
    pasek.id = 'pasek-kontaktu';
    pasek.setAttribute('aria-label', 'Szybki kontakt');
    const mail = 'mailto:graf.m.jar@gmail.com' + (temat ? '?subject=' + encodeURIComponent(temat) : '');
    pasek.innerHTML =
        '<a href="tel:+48608078802" data-eye-title="Zadzwoń" data-eye="Najszybszy sposób na wstępną wycenę. Odbieram sam, bez infolinii.">Zadzwoń</a>' +
        '<a href="' + mail + '" data-eye-title="Napisz" data-eye="Kilka zdań wystarczy. Odpiszę z wyceną albo z pytaniem.">Napisz</a>';
    document.body.appendChild(pasek);
    document.body.classList.add('ma-pasek-kontaktu');

    const kontakt = document.querySelector('#kontakt, #contact');
    if (!kontakt || !('IntersectionObserver' in window)) return;
    new IntersectionObserver((wpisy) => {
        pasek.classList.toggle('ukryty', wpisy[0].isIntersecting);
    }).observe(kontakt);
})();
