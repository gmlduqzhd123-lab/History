// 한 버전의 앱 파일을 모두 저장한 뒤에만 사용함.
// 업데이트는 이전 버전을 쓰는 탭이 모두 닫힐 때 적용하여 실행 중인 파일이 섞이지 않게 함.
const CACHE = 'history-quest-v49';
const RUNTIME_CACHE = `${CACHE}-runtime`;
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
    'media/history-quest-guide-poster.jpg',
    'media/history-quest-guide.ko.vtt',
    'css/style.css',
    'css/inquiry.css',
    'css/landing.css',
    'css/offline.css',
    'fonts/PretendardVariable.woff2',
    'fonts/NotoSerifKRVariable.woff2',
    'js/app.js',
    'js/landing.js',
    'js/offline.js',
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
    'js/extras/inquiry.js',
    'content/inquiries.js',
    'img/inquiries/seoul-streetcar-loc.jpg',
    'img/inquiries/tenant-farmers.svg',
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
        .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
    // skipWaiting하지 않음: 열려 있는 이전 앱은 이전 파일을 계속 사용해야 함.
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('history-quest-') && k !== CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)))));
    // clients.claim하지 않음: 처음 방문한 페이지의 로딩 도중 제어권을 가져오지 않음.
});

const APP_FILES = new Set(FILES.map(file => new URL(file, self.location.href).href));
const GUIDE_VIDEO = new URL('media/history-quest-guide.mp4', self.location.href).href;
let guideDownload;

// 소개 영상은 재생할 때만 저장한다. 영상 다운로드가 학습 앱의 설치를 막지 않게 한다.
// 브라우저가 보내는 부분 요청을 그대로 저장하면 Cache API가 206 응답을 거부하므로,
// 이 영상만 완전한 파일로 받아 저장하고 재생·탐색에 필요한 범위를 만들어 돌려준다.
async function guideFile(request) {
    let cache;
    try {
        cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(GUIDE_VIDEO);
        if (cached?.status === 200) return cached;
    } catch {
        // 저장 공간이 부족해도 온라인 영상은 계속 재생할 수 있다.
    }
    if (!guideDownload) {
        const headers = new Headers(request.headers);
        headers.delete('range');
        guideDownload = (async () => {
            const response = await fetch(new Request(request, { headers, cache: 'reload' }));
            if (response.status === 200 && cache) {
                try {
                    await cache.put(GUIDE_VIDEO, response.clone());
                } catch {
                    // 선택 영상 저장 실패는 학습 앱의 오프라인 준비 상태와 무관하다.
                }
            }
            return response;
        })();
    }
    const download = guideDownload;
    try {
        return (await download).clone();
    } finally {
        if (guideDownload === download) guideDownload = null;
    }
}

async function guideResponse(request) {
    const response = await guideFile(request);
    const range = request.headers.get('range');
    if (!range || response.status !== 200) return response;
    const body = await response.arrayBuffer();
    const size = body.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    let start;
    let end;
    if (match && (match[1] || match[2])) {
        if (!match[1]) {
            const suffix = Number(match[2]);
            if (Number.isSafeInteger(suffix) && suffix > 0) {
                start = Math.max(0, size - suffix);
                end = size - 1;
            }
        } else {
            start = Number(match[1]);
            end = match[2] ? Number(match[2]) : size - 1;
        }
    }
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.set('Accept-Ranges', 'bytes');
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start < 0 || start >= size || end < start) {
        headers.set('Content-Range', `bytes */${size}`);
        headers.set('Content-Length', '0');
        return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
}

// 활성화된 워커라도 브라우저가 저장한 파일을 지울 수 있다. 준비 안내는 실제 저장본을 확인한다.
self.addEventListener('message', event => {
    if (event.data?.type !== 'HISTORY_OFFLINE_STATUS' || !event.ports[0]) return;
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE);
            const stored = await Promise.all([...APP_FILES].map(url => cache.match(url)));
            event.ports[0].postMessage({ complete: stored.every(Boolean), cache: CACHE });
        } catch {
            event.ports[0].postMessage({ complete: false, cache: CACHE });
        }
    })());
});

// 저장본도 없고 사이트에도 닿지 않을 때(저장 공간 정리 + 와이파이 끊김·학교망 차단) 크롬의
// "사이트에 연결할 수 없음" 오류 화면 대신 보여 줄 안내 페이지. 다른 파일 없이 혼자 열려야 함.
function unreachablePage() {
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>역사 탐험 퀘스트 · 연결 안내</title>
<style>body{margin:0;font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#fbf4e8;color:#3f2d20;line-height:1.6;word-break:keep-all}
main{max-width:560px;margin:40px auto;padding:0 16px}.card{background:#fff;border:2px solid #ecdcc4;border-radius:20px;padding:22px}
h1{font-size:22px;margin:0 0 8px}li{margin:6px 0}button{margin-top:14px;width:100%;min-height:52px;border:0;border-radius:14px;background:#c2410c;color:#fff;font-size:18px;font-weight:700}
.small{font-size:14px;color:#7a6250}</style></head><body><main><div class="card">
<h1>🧭 역사 탐험 퀘스트에 지금 연결되지 않아요</h1>
<p>이 기기에 저장된 앱 파일이 정리되었고, 지금은 사이트(gmlduqzhd123-lab.github.io)에 연결되지 않아요.</p>
<ol><li>📶 와이파이나 데이터가 켜져 있는지 확인해요.</li>
<li>🔄 아래 <b>다시 시도</b>를 눌러요. 인터넷이 돌아오면 저절로 다시 열려요.</li>
<li>🏫 학교 인터넷에서만 안 되면, 선생님께 <b>gmlduqzhd123-lab.github.io</b> 접속이 막혀 있지 않은지 여쭤봐요.</li></ol>
<button type="button" onclick="location.reload()">다시 시도</button>
<p><b>앱이 다시 열리면 꼭 해 주세요</b></p>
<ol><li>화면 위쪽 안내의 <b>다시 준비하기</b>를 누르고, <b>✓ 오프라인 준비 완료</b>가 보이는지 확인해요. 다시 연결되는 것만으로는 오프라인용 파일이 저장되지 않아요.</li>
<li>내 탐험가와 기록이 남아 있는지 확인해요. 없다면 공책에 적어 둔 <b>이어하기 코드</b>로 진도를 되살려요.</li></ol>
</div></main><script>addEventListener('online',function(){location.reload()})</script></body></html>`;
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// 앱 파일은 설치 때 완성한 저장본만 사용. 새 파일은 다음 서비스 워커 설치 때 받음.
// 사진·글꼴 등 별도 자원은 앱 저장본을 바꾸지 않는 별도 캐시에 저장.
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!sameOrigin && !isFont) return;

    const appUrl = new URL(url);
    appUrl.search = '';
    if (sameOrigin && appUrl.href === GUIDE_VIDEO) {
        event.respondWith(guideResponse(request).catch(() => Response.error()));
        return;
    }
    if (sameOrigin && APP_FILES.has(appUrl.href)) {
        // 저장본이 있으면 그대로 사용. 브라우저가 저장 공간을 정리해 저장본이 사라졌으면
        // 오류(ERR_FAILED)로 막지 말고 인터넷에서 받아 앱이 열리게 함. 저장본 복구는 '다시 준비하기'가 맡음.
        event.respondWith(caches.open(CACHE)
            .then(cache => cache.match(appUrl.href))
            .catch(() => undefined)
            .then(cached => cached || fetch(request))
            // 첫 화면을 열다가 저장본도 네트워크도 없으면 오류 화면 대신 안내 페이지
            .catch(error => { if (request.mode === 'navigate') return unreachablePage(); throw error; }));
        return;
    }

    if (sameOrigin) {
        event.respondWith((async () => {
            const cache = await caches.open(RUNTIME_CACHE);
            try {
                const response = await fetch(request);
                if (response.ok && response.status !== 206) event.waitUntil(cache.put(request, response.clone()));
                return response;
            } catch (e) {
                const cached = await cache.match(request, { ignoreSearch: true });
                if (cached) return cached;
                const home = request.mode === 'navigate' ? await (await caches.open(CACHE)).match('./') : undefined;
                if (home) return home;
                return request.mode === 'navigate' ? unreachablePage() : Response.error();
            }
        })());
        return;
    }

    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) event.waitUntil(cache.put(request, response.clone()));
        return response;
    }));
});
