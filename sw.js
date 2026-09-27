// 오프라인 지원: 앱 파일을 저장해 두고, 인터넷이 되면 새 버전으로 조용히 바꿈
const CACHE = 'history-quest-v1';
const FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'icons/icon.svg',
    'css/style.css',
    'js/app.js',
    'js/dom.js',
    'js/storage.js',
    'js/tts.js',
    'js/code.js',
    'js/filter.js',
    'js/art.js',
    'js/activities/common.js',
    'js/activities/detective.js',
    'js/activities/reading.js',
    'js/activities/adventure.js',
    'js/activities/mastery.js',
    'js/activities/summary.js',
    'content/quests.js',
    'content/q1-stone-age.js',
    'content/q2-bronze-gojoseon.js',
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('history-quest-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

// 저장해 둔 파일을 먼저 보여 주고, 뒤에서 새로 받아 저장 (글꼴 포함)
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!sameOrigin && !isFont) return;

    event.respondWith(caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request, { ignoreSearch: sameOrigin });
        const network = fetch(request).then(response => {
            if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
            return response;
        }).catch(() => cached);
        return cached || network;
    }));
});
