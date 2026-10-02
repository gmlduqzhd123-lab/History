// Historical worker shipped in commit 2e9a930, retained for upgrade regression testing.
// 오프라인 지원: 인터넷이 되면 항상 최신 파일을 받고(옛 파일과 새 파일이 섞이지 않게),
// 인터넷이 끊기면 저장해 둔 파일로 동작함
const CACHE = 'history-quest-v30';
const FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
    'icons/qr.svg',
    'css/style.css',
    'js/app.js',
    'js/dom.js',
    'js/storage.js',
    'js/tts.js',
    'js/code.js',
    'js/filter.js',
    'js/tone.js',
    'js/art.js',
    'js/picture.js',
    'content/photos.js',
    'js/activities/common.js',
    'js/activities/detective.js',
    'js/activities/reading.js',
    'js/activities/adventure.js',
    'js/activities/mastery.js',
    'js/activities/summary.js',
    'content/quests.js',
    'content/timeline.js',
    'js/extras/timeline.js',
    'js/extras/review.js',
    'js/extras/people.js',
    'content/people.js',
    'js/extras/places.js',
    'content/places.js',
    'js/extras/writing.js',
    'content/writings.js',
    'content/q1-stone-age.js',
    'content/q2-bronze-gojoseon.js',
    'content/q3-three-kingdoms-gaya.js',
    'content/q4-unified-silla-balhae.js',
    'content/q5-goryeo.js',
    'content/q6-joseon-confucian.js',
    'content/q7-late-joseon.js',
    'content/q8-opening-modern.js',
    'content/q9-colonial-independence.js',
    'content/q10-liberation-korean-war.js',
];

self.addEventListener('install', event => {
    // 브라우저의 HTTP 캐시를 거치지 않고 새로 받아 저장 (새 버전 설치 때 옛 파일이 끼어들지 않게)
    event.waitUntil(caches.open(CACHE)
        .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('history-quest-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

// 같은 사이트의 파일: 인터넷 먼저(서버에 바뀐 것이 있는지 확인), 실패하면 저장본
// 글꼴: 저장본 먼저(잘 바뀌지 않으므로)
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!sameOrigin && !isFont) return;

    if (sameOrigin) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                const response = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
                if (response.ok) cache.put(request, response.clone());
                return response;
            } catch (e) {
                const cached = await cache.match(request, { ignoreSearch: true });
                return cached || (request.mode === 'navigate' ? cache.match('./') : Response.error());
            }
        })());
        return;
    }

    event.respondWith(caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
        return response;
    }));
});
