import { h } from './dom.js';

let offlineStatus = null;

function storedOfflineFiles(worker) {
    return new Promise(resolve => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => finish(false), 5000);
        function finish(complete) {
            clearTimeout(timer);
            channel.port1.close();
            resolve(complete);
        }
        channel.port1.onmessage = event => finish(event.data?.complete === true);
        try { worker.postMessage({ type: 'HISTORY_OFFLINE_STATUS' }, [channel.port2]); }
        catch { finish(false); }
    });
}

// 화면을 다시 그려도 같은 준비 상태와 재시도 버튼을 유지한다.
// 소개 화면의 본문 건너뛰기 링크가 키보드에서 가장 먼저 선택되도록 뒤에 붙인다.
export function remountOfflineStatus() {
    if (!offlineStatus) return;
    const app = document.getElementById('app');
    const skip = app.querySelector('.landing-skip');
    if (skip) skip.after(offlineStatus);
    else app.prepend(offlineStatus);
}

// 첫 설치가 실패해도 온라인 학습은 계속할 수 있음. 준비 상태는 화면 전환과 별도로 유지한다.
export function prepareOffline(toast) {
    const message = h('span', { id: 'offline-message', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const retry = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => start() }, '다시 준비하기');
    const status = h('aside', { id: 'offline-status', class: 'offline-status', 'aria-label': '오프라인 사용 준비' }, message, retry);
    offlineStatus = status;
    remountOfflineStatus();
    let registration = null;
    let attempt = 0;
    let updateNotified = false;
    let needsRepair = false;
    let checking = 0;
    const registrations = new WeakSet();

    function show(state, text) {
        status.dataset.state = state;
        message.textContent = text;
        retry.hidden = state !== 'failed';
        retry.disabled = false;
    }
    function ready() {
        show('ready', '✓ 오프라인 준비 완료 · 인터넷이 없어도 탐험할 수 있어요.');
        if (!updateNotified && registration?.waiting && navigator.serviceWorker.controller) {
            updateNotified = true;
            toast('새 버전이 준비됐어요. 열린 앱 창을 모두 닫고 다시 열면 새 버전으로 사용할 수 있어요.');
        }
    }
    function failed() {
        show('failed', '오프라인 준비를 마치지 못했어요. 인터넷 연결을 확인하고 다시 준비해 주세요.');
    }
    async function checkReady(currentAttempt) {
        const active = registration?.active;
        if (active?.state !== 'activated') return;
        const currentCheck = ++checking;
        const complete = await storedOfflineFiles(active);
        if (currentAttempt !== attempt || currentCheck !== checking || active !== registration?.active) return;
        if (complete) {
            needsRepair = false;
            ready();
            return;
        }
        needsRepair = true;
        if (registration.installing) return;
        // 새 버전은 별도 저장본이므로 이전 탭을 닫은 뒤 안전하게 사용한다.
        const waiting = registration.waiting;
        if (waiting && await storedOfflineFiles(waiting)) {
            if (currentAttempt !== attempt || currentCheck !== checking) return;
            show('restart', '새 오프라인 파일이 준비됐어요. 열린 앱 창을 모두 닫고 다시 열어 주세요.');
        } else if (currentAttempt === attempt && currentCheck === checking) {
            show('failed', '오프라인 파일을 모두 확인하지 못했어요. 인터넷에 연결한 뒤 다시 준비해 주세요.');
        }
    }
    function watchWorker(worker, currentAttempt) {
        if (!worker) return;
        const check = () => {
            if (currentAttempt !== attempt) return;
            if (registration?.active?.state === 'activated') checkReady(currentAttempt);
            else if (worker.state === 'activated') checkReady(currentAttempt);
            else if (worker.state === 'redundant') failed();
        };
        worker.addEventListener('statechange', check);
        check();
    }
    function watchRegistration(currentAttempt) {
        if (!registrations.has(registration)) {
            const watched = registration;
            registration.addEventListener('updatefound', () => {
                if (watched === registration) watchWorker(watched.installing, attempt);
            });
            registrations.add(registration);
        }
        watchWorker(registration.installing || registration.waiting, currentAttempt);
        if (registration.active?.state === 'activated') checkReady(currentAttempt);
    }
    async function start() {
        const currentAttempt = ++attempt;
        ++checking;
        show('preparing', '오프라인 사용을 준비하고 있어요. 완료 안내가 나올 때까지 인터넷에 연결해 주세요.');
        try {
            // 실패한 첫 설치는 다시 등록하면 필수 파일 전체를 새로 저장한다.
            const existing = await navigator.serviceWorker.getRegistration();
            if (currentAttempt !== attempt) return;
            if (existing) registration = existing;
            const script = new URL('sw.js', location.href);
            const previous = existing?.waiting || existing?.active;
            if (previous) {
                const previousScript = new URL(previous.scriptURL);
                if (previousScript.origin === script.origin && previousScript.pathname === script.pathname) {
                    script.search = previousScript.search;
                }
            }
            // 저장본이 손상되었을 때만 전체 재설치를 요청한다. 개별 옛 파일을 새 파일과 섞지 않는다.
            if (needsRepair) script.searchParams.set('repair', `${Date.now()}-${currentAttempt}`);
            const next = await navigator.serviceWorker.register(script.href, { updateViaCache: 'none' });
            if (currentAttempt !== attempt) return;
            registration = next;
            watchRegistration(currentAttempt);
            if (!registration.active && !registration.installing && !registration.waiting) {
                await registration.update();
                if (currentAttempt !== attempt) return;
                watchRegistration(currentAttempt);
                if (!registration.active && !registration.installing && !registration.waiting) failed();
            }
        } catch {
            if (currentAttempt !== attempt) return;
            if (registration?.active?.state === 'activated') checkReady(currentAttempt);
            else failed();
        }
    }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        show('unavailable', '이 브라우저에서는 오프라인 준비를 할 수 없어요. 인터넷에 연결해서 사용해 주세요.');
        return;
    }
    start();
}
