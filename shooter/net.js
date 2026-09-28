/* ==========================================================================
   OVERPRINT: ranking (api/scores.php na m-jaro.pl)
   Serwer wydaje podpisany token na starcie przebiegu i sprawdza wynik przy
   zapisie. Bez serwera (np. lokalnie) wyniki trafiają do localStorage.
   ========================================================================== */

const API = 'api/scores.php';
const LOCAL = 'overprint-local-scores';

async function call(method, body, query = '') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(API + query, {
            method, signal: ctrl.signal, cache: 'no-store',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { server: true });
        return data;
    } finally { clearTimeout(timer); }
}

function localLoad() {
    try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; }
}
function localSave(list) {
    try { localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, 50))); } catch { /* ok */ }
}

export const Board = {
    token: null,
    online: true,

    async startRun() {
        this.token = null;
        try { this.token = (await call('POST', { action: 'start' })).token || null; this.online = true; }
        catch { this.online = false; }
    },

    async submit(name, s) {
        const entry = { name, score: s.score, wave: s.wave, kills: s.kills, time: s.time, build: s.build };
        if (this.token) {
            try {
                const r = await call('POST', { action: 'submit', token: this.token, ...entry });
                this.token = null;
                return { online: true, ...r };
            } catch (e) {
                if (e.server) return { online: true, error: e.message };
            }
        }
        // tryb lokalny
        const list = localLoad();
        const id = 'L' + Date.now().toString(36);
        list.push({ ...entry, id, date: Math.floor(Date.now() / 1000) });
        list.sort((a, b) => b.score - a.score);
        localSave(list);
        return { online: false, id, rank: list.findIndex(x => x.id === id) + 1 };
    },

    async top(period = 'all') {
        try {
            const r = await call('GET', null, `?period=${period}&limit=50`);
            this.online = true;
            return { online: true, entries: r.entries || [] };
        } catch {
            this.online = false;
            let list = localLoad();
            if (period === 'week') { const since = Date.now() / 1000 - 7 * 86400; list = list.filter(x => x.date >= since); }
            return { online: false, entries: list };
        }
    },
};
