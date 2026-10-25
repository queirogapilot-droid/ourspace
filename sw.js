// OurSpace service worker: app shell cache, daily reminder notifications and icon badge.
const C = 'ourspace-v4';
const META = 'ourspace-meta';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== META).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
async function getMeta() { const c = await caches.open(META); const r = await c.match('/__meta'); return r ? r.json() : {}; }
async function setMeta(m) { const c = await caches.open(META); await c.put('/__meta', new Response(JSON.stringify(m))); }
const TXT = {
  en: { today: 'TODAY', d: n => n === 30 ? 'in 1 month' : n === 14 ? 'in 2 weeks' : n === 7 ? 'in 1 week' : 'in ' + n + ' days', title: n => 'OurSpace · ' + n + ' reminder' + (n > 1 ? 's' : ''), appr: n => n + ' approval(s) waiting' },
  pt: { today: 'HOJE', d: n => n === 30 ? 'em 1 mês' : n === 14 ? 'em 2 semanas' : n === 7 ? 'em 1 semana' : 'em ' + n + ' dias', title: n => 'OurSpace · ' + n + (n > 1 ? ' lembretes' : ' lembrete'), appr: n => n + ' aprovação(ões) pendente(s)' }
};
async function check(force) {
  const m = await getMeta();
  if (!m.token || !m.api) return;
  let j;
  try { const r = await fetch(m.api, { method: 'POST', body: JSON.stringify({ fn: 'api_badge', token: m.token }) }); j = await r.json(); } catch (e) { return; }
  if (!j || !j.ok) return;
  const b = j.data;
  try { if (self.navigator.setAppBadge) { b.count ? await self.navigator.setAppBadge(b.count) : await self.navigator.clearAppBadge(); } } catch (e) {}
  if (!b.count || (!force && m.notified === b.date)) return;
  const t = TXT[m.lang === 'pt' ? 'pt' : 'en'];
  const lines = b.items.map(i => (i.days_left === 0 ? t.today : t.d(i.days_left)) + ' — ' + i.title);
  if (b.approvals) lines.push(t.appr(b.approvals));
  await self.registration.showNotification(t.title(b.count), { body: lines.join('\n'), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'ourspace-' + b.date, data: { url: './#calendar' } });
  m.notified = b.date; await setMeta(m);
}
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'auth') e.waitUntil(getMeta().then(m => setMeta(Object.assign(m, { token: d.token, lang: d.lang, api: d.api }))).then(() => check(false)));
  if (d.type === 'check') e.waitUntil(check(!!d.force));
});
self.addEventListener('periodicsync', e => { if (e.tag === 'os-reminders') e.waitUntil(check(false)); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
