/* ==========================================================================
   VEGAS PROSPECÇÃO — Service Worker
   Guarda a interface no aparelho para abrir rápido (e mesmo sem sinal).
   Os dados SEMPRE vêm do Google Sheets: chamadas ao Apps Script não são cacheadas.
   Ao publicar uma nova versão, altere CACHE para forçar a atualização.
   ========================================================================== */
const CACHE = 'vegas-prospeccao-v1.1.0';
const APP_SHELL = [
  './', './index.html', './style.css', './script.js', './pdf.js', './manifest.json',
  './assets/logo-branca.png', './assets/logo-escura.png', './assets/pdf-fundo.jpg', './assets/login-fundo.jpg', './assets/login-fundo-blur.jpg',
  './assets/fonts/Carlito-Regular.ttf', './assets/fonts/Carlito-Bold.ttf',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'
];
const CDN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                          // POST para o Apps Script: sempre rede
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  if (/nominatim|viacep/.test(url.hostname)) return;        // localização e CEP: sempre rede

  if (CDN.includes(url.hostname)) {                          // bibliotecas e fontes: cache primeiro
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin === self.location.origin) {                 // arquivos do app: rede primeiro, cache se offline
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
  }
});
