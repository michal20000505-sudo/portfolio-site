// Wspólny header: Esc zamyka menu (otwieranie i zamykanie obsługuje skrypt strony).
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const toggle = document.querySelector('.menu-toggle');
    if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.click();
        toggle.focus();
    }
});
