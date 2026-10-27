(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[246],{4940:(e,t,a)=>{"use strict";a.d(t,{ZU:()=>u,bi:()=>i,hp:()=>g,hr:()=>c,qY:()=>d,sx:()=>o,yH:()=>s,zs:()=>n});let n="GTM-PXZFLKQT",r="hb-zgody-marketing";`
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('set', 'url_passthrough', true);
  gtag('set', 'ads_data_redaction', true);

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  try {
    if (localStorage.getItem('${r}') === 'granted') {
      gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });
    }
  } catch (e) {}
})();
`.trim();let d={phoneClick:"klik_telefon",emailClick:"klik_email",formSent:"formularz_wyslany"};function o(e,t={}){window.dataLayer=window.dataLayer??[],window.dataLayer.push({event:e,...t})}function i(e){let t=e?"granted":"denied";try{localStorage.setItem(r,t)}catch{}window.gtag?.("consent","update",{ad_storage:t,ad_user_data:t,ad_personalization:t,analytics_storage:t}),l.forEach(e=>e())}function s(){try{localStorage.removeItem(r)}catch{}window.gtag?.("consent","update",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied"}),l.forEach(e=>e())}let l=new Set;function g(e){return l.add(e),()=>{l.delete(e)}}function c(){try{let e=localStorage.getItem(r);return"granted"===e||"denied"===e?e:null}catch{return null}}function u(){return"nieznana"}},6634:(e,t,a)=>{"use strict";a.d(t,{ConsentSettings:()=>o});var n=a(5155),r=a(2115),d=a(4940);function o(){let e=(0,r.useSyncExternalStore)(d.hp,d.hr,d.ZU);return d.zs&&null!==e&&"nieznana"!==e?(0,n.jsxs)("div",{className:"mt-5 rounded-lg border-2 border-line/40 bg-paper-2 p-5",children:[(0,n.jsxs)("p",{className:"text-sm text-ink",children:["Twoja obecna decyzja:"," ",(0,n.jsx)("strong",{children:"granted"===e?"zgoda na statystyki udzielona":"brak zgody na statystyki"}),"."]}),(0,n.jsx)("button",{type:"button",onClick:d.yH,className:"mt-4 inline-flex min-h-13 items-center rounded-lg border-2 border-ink px-6 font-display text-base font-semibold text-ink transition-colors hover:bg-ink hover:text-paper",children:"Zmień decyzję"})]}):null}},8224:(e,t,a)=>{Promise.resolve().then(a.bind(a,6634)),Promise.resolve().then(a.t.bind(a,8500,23))}},e=>{e.O(0,[500,441,794,358],()=>e(e.s=8224)),_N_E=e.O()}]);