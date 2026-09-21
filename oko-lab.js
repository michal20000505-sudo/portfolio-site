const $ = selector => document.querySelector(selector);
const stage = $('#observer-stage');
let eye, toastTimer, loadTimer;
const descriptions = {
    idle: 'Wszystkie systemy gotowe', tracking: 'Podążam za Twoim ruchem', curious: 'Szukam czegoś interesującego',
    focused: 'Kalibruję ostrość na elemencie', typing: 'Czytam razem z Tobą', scrolling: 'Kompensuję ruch strony',
    startled: 'Odruch ochronny optyki', scanning: 'Analizuję otoczenie', happy: 'Miło Cię widzieć!', confused: 'Hmm… to ciekawe',
    sleeping: 'Optyka zamknięta · tryb spoczynku', waking: 'Uruchamiam serwomechanizmy', greeting: 'Dobrze, że jesteś',
};
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200); }
function log(label, time = 0) {
    const li = document.createElement('li'), stamp = document.createElement('time'), text = document.createElement('span');
    stamp.textContent = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
    text.textContent = label; li.append(stamp, text); $('#event-log').prepend(li);
    while ($('#event-log').children.length > 30) $('#event-log').lastElementChild.remove();
}
function error(message) {
    clearTimeout(loadTimer); $('#loading').hidden = true; $('#render-error').hidden = false; $('#error-message').textContent = message;
    $('#eye-controls').disabled = true; $('#capture').disabled = true; $('#state-label').textContent = 'Podgląd niedostępny';
}
stage.addEventListener('observererror', e => error(e.detail.message));
stage.addEventListener('observerstate', e => {
    const { state, label, time } = e.detail;
    $('#state-label').textContent = label; $('#state-description').textContent = descriptions[state]; $('#last-signal').textContent = label;
    $('#sleep span').textContent = state === 'sleeping' ? 'Obudź oko' : 'Uśpij oko';
    document.querySelectorAll('[data-action]').forEach(b => b.classList.toggle('is-active', b.dataset.action === state));
    log(label, time);
});
stage.addEventListener('observertelemetry', e => {
    const data = e.detail;
    $('#pupil-meter').textContent = `${Math.round(data.pupil * 100)}%`;
    $('#aperture-meter').textContent = `${Math.round(data.opening * 100)}%`;
    $('#assembly-meter').textContent = data.spread > .02 ? `${Math.round(data.spread * 100)}% otwarcia` : 'Złożony';
    $('#motion-label').textContent = data.reducedMotion ? 'OGRANICZONY RUCH' : 'PROCEDURAL 3D · WEBGL';
});
$('#retry').addEventListener('click', () => location.reload());
$('#clear-log').addEventListener('click', () => { $('#event-log').replaceChildren(); log('Dziennik wyczyszczony', eye?.time); });

loadTimer = setTimeout(() => error('Ładowanie trwa zbyt długo. Sprawdź połączenie z CDN biblioteki Three.js i spróbuj ponownie.'), 25000);
try {
    const { ObserverEye } = await import('./eye-observer.js');
    eye = new ObserverEye(stage);
    // Public console handle for inspecting the standalone prototype; no dependency
    // on this handle in the renderer, model or future homepage integration.
    window.observerLab = eye;
    clearTimeout(loadTimer); $('#loading').hidden = true; $('#render-error').hidden = true;
    $('#eye-controls').disabled = false; $('#capture').disabled = false;
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'blink') { eye.blink(); log('Ręczne mrugnięcie', eye.time); }
        else eye.trigger(action === 'sleeping' && eye.mode === 'sleeping' ? 'waking' : action, action === 'scanning' ? 4 : 2.5);
    }));
    for (const name of ['spread', 'light', 'zoom', 'sensitivity']) {
        $(`#${name}`).addEventListener('input', e => { eye.setOptions({ [name]: Number(e.target.value) / 100 }); $(`#${name}-value`).textContent = `${e.target.value}%`; });
    }
    for (const name of ['tracking', 'reactions', 'autoBlink', 'turntable']) $(`#${name}`).addEventListener('change', e => eye.setOptions({ [name]: e.target.checked }));
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
        eye.setView(button.dataset.view); $('#turntable').checked = false;
        document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    }));
    $('#pause').addEventListener('click', () => {
        eye.setOptions({ paused: !eye.options.paused }); $('#pause').textContent = eye.options.paused ? '▷ Wznów' : 'Ⅱ Pauza';
        $('#pause').setAttribute('aria-pressed', String(eye.options.paused));
        $('#state-description').textContent = eye.options.paused ? 'Animacja zatrzymana' : descriptions[eye.mode];
        log(eye.options.paused ? 'Pauza animacji' : 'Wznowienie animacji', eye.time);
    });
    $('#reset').addEventListener('click', () => {
        eye.reset();
        for (const name of ['spread', 'light', 'zoom', 'sensitivity']) { $(`#${name}`).value = Math.round(eye.options[name] * 100); $(`#${name}-value`).textContent = `${$(`#${name}`).value}%`; }
        for (const name of ['tracking', 'reactions', 'autoBlink', 'turntable']) $(`#${name}`).checked = eye.options[name];
        $('#pause').textContent = 'Ⅱ Pauza'; $('#pause').setAttribute('aria-pressed', 'false');
        document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'reference')));
        log('Przywrócono ustawienia początkowe', eye.time);
    });
    $('#hello-form').addEventListener('submit', e => {
        e.preventDefault(); const name = $('#hello').value.trim();
        if (!name) { $('#hello-result').textContent = 'Wpisz imię — same spacje to za mało.'; eye.trigger('confused'); return; }
        $('#hello-result').textContent = `Cześć, ${name}! Dobrze Cię widzieć.`; eye.trigger('greeting', 3);
    });
    $('#hello').addEventListener('invalid', () => { eye.trigger('confused', 2); $('#hello-result').textContent = 'Najpierw wpisz swoje imię.'; });
    $('#capture').addEventListener('click', async () => {
        try {
            const blob = await eye.capture(), url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'observer-01.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
            toast('Zapisano kadr PNG z przezroczystym tłem.');
        } catch (e) { toast(e.message); }
    });
    $('#explore').addEventListener('click', () => {
        eye.setOptions({ spread: 1 }); $('#spread').value = '100'; $('#spread-value').textContent = '100%';
        $('#controls').scrollIntoView({ behavior: eye.reduced ? 'instant' : 'smooth', block: 'center' });
    });

    // Keep the very same canvas alive during the interaction tests. No second
    // model or divergent preview renderer; the placeholder preserves page layout.
    const viewport = $('.viewport-shell'), placeholder = document.createElement('div');
    placeholder.className = 'viewport-placeholder'; placeholder.textContent = 'Obserwator towarzyszy Ci podczas testów ↘';
    const anchor = document.createElement('div'); anchor.setAttribute('aria-hidden', 'true'); anchor.style.cssText = 'position:absolute;width:1px;height:1px;left:0;pointer-events:none';
    $('.workbench').style.position = 'relative'; $('.workbench').append(anchor);
    const dockResize = new ResizeObserver(() => { anchor.style.top = `${(viewport.classList.contains('is-docked') ? placeholder.clientHeight : viewport.clientHeight) * .45}px`; });
    dockResize.observe($('.workbench'));
    const dockObserver = new IntersectionObserver(entries => {
        const dock = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
        if (dock && !viewport.classList.contains('is-docked')) { viewport.before(placeholder); viewport.classList.add('is-docked'); eye.resize(); }
        if (!dock && viewport.classList.contains('is-docked')) { viewport.classList.remove('is-docked'); placeholder.remove(); eye.resize(); }
    }); dockObserver.observe(anchor);
    window.addEventListener('pagehide', e => { if (!e.persisted) { dockObserver.disconnect(); dockResize.disconnect(); eye.dispose(); clearTimeout(toastTimer); } });
} catch (e) {
    console.error('[observer-lab]', e);
    error('Nie udało się uruchomić WebGL lub pobrać biblioteki 3D. Sprawdź połączenie, włącz akcelerację sprzętową i odśwież stronę.');
}
