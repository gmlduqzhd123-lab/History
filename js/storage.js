// 학습 기록은 이 기기의 브라우저에만 저장 (서버·로그인 없음). 이름은 이 기기에만 남고 이어하기 코드에는 담기지 않음
const KEY = 'history-quest:v1';
// 각 창이 읽은 기록을 기억해, 다른 창에서 바꾼 학생 기록을 오래된 값으로 덮어쓰지 않음
const baselines = new WeakMap();
const pendingSaves = new WeakMap();
const pendingRequests = new WeakMap();
const conflictVersions = new WeakMap();
const ownWrites = new WeakMap();
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let coordinationDatabase;

function openCoordinationDatabase() {
    if (!coordinationDatabase) {
        coordinationDatabase = new Promise(resolve => {
            const request = indexedDB.open('history-quest-coordination', 1);
            let blocked = false;
            request.onupgradeneeded = () => request.result.createObjectStore('save');
            request.onerror = () => { coordinationDatabase = null; resolve(null); };
            request.onblocked = () => { blocked = true; coordinationDatabase = null; resolve(null); };
            request.onsuccess = () => {
                const db = request.result;
                if (blocked) { db.close(); return; }
                db.onversionchange = () => { db.close(); coordinationDatabase = null; };
                resolve(db);
            };
        });
    }
    return coordinationDatabase;
}

async function coordinatedSave(write) {
    try {
        const db = await openCoordinationDatabase();
        if (!db) return false;
        return await new Promise(resolve => {
            // 모든 브라우저에서 같은 잠금 사용: iOS 14에서도 다른 창의 저장이 동시에 끼어들지 않음
            const transaction = db.transaction('save', 'readwrite');
            let result = false;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = transaction.onerror = () => resolve(false);
            transaction.objectStore('save').get('lock').onsuccess = () => { result = write(); };
        });
    } catch (e) {
        coordinationDatabase = null;
        return false;
    }
}

function readData(requireAccess = false) {
    let stored;
    try { stored = localStorage.getItem(KEY); }
    catch (e) {
        if (requireAccess) throw e;
        return { current: null, profiles: {} };
    }
    try {
        const data = JSON.parse(stored);
        if (data && data.profiles && typeof data.profiles === 'object') {
            // 기록이 일부 빠지거나 깨져 있어도 앱이 멈추지 않도록 모양을 맞춤
            for (const [key, p] of Object.entries(data.profiles)) {
                if (!p || typeof p !== 'object' || !Number.isInteger(Number(p.number))) { delete data.profiles[key]; continue; }
                p.number = Number(p.number);
                p.name = cleanName(p.name);
                extrasOf(p);
                if (!p.quests || typeof p.quests !== 'object') p.quests = {};
                for (const q of Object.values(p.quests)) {
                    if (!q || typeof q !== 'object') continue;
                    if (!Array.isArray(q.notes)) q.notes = [];
                    q.stage = Number.isFinite(q.stage) ? q.stage : 0;
                }
            }
            if (data.current != null && !data.profiles[data.current]) data.current = null;
            return data;
        }
    } catch (e) { /* 저장된 값이 깨졌거나 저장소를 쓸 수 없음 */ }
    return { current: null, profiles: {} };
}

export function loadData(previous) {
    const data = readData();
    baselines.set(data, copy(data));
    const before = previous && baselines.get(previous);
    if (before) {
        // 다른 학생만 바뀌었다면, 이 창의 진행 중인 활동과 아직 저장하지 않은 기록을 유지
        for (const [key, p] of Object.entries(previous.profiles)) {
            if (same(before.profiles[key], data.profiles[key])) data.profiles[key] = p;
        }
    }
    return data;
}

function replaceData(data, next, baseline = next) {
    const snapshot = copy(baseline);
    // 바뀌지 않은 활동의 기록 객체는 유지: 다른 학생의 저장 때문에 진행 중인 활동이 끊기지 않게 함
    for (const [key, p] of Object.entries(next.profiles)) {
        if (same(data.profiles[key], p)) next.profiles[key] = data.profiles[key];
    }
    data.profiles = next.profiles;
    data.current = next.current;
    baselines.set(data, snapshot);
}

function saveLocked(data, requested, requestBaseline, changed, markers, version) {
    if ((conflictVersions.get(data) || 0) !== version) return 'conflict';
    try {
        const latest = readData(true);
        const before = { profiles: { ...requestBaseline.profiles } };
        const written = ownWrites.get(data) || new Map();
        for (const key of changed) {
            // 앞서 기다리던 이 창의 저장만 기준을 앞당김. 다른 창에서 들어온 기록은 여전히 충돌로 확인
            const prior = written.get(key);
            if (prior && prior !== markers.get(key)) before.profiles[key] = prior.value;
        }
        const merged = { ...latest, profiles: { ...latest.profiles } };
        const refresh = () => {
            latest.current = data.current != null && latest.profiles[data.current] ? data.current : null;
            replaceData(data, latest);
            conflictVersions.set(data, version + 1);
            return 'conflict';
        };
        for (const key of changed) {
            const local = requested.profiles[key];
            // 같은 학생을 다른 창에서 고치거나 지웠으면, 이전 기록을 되살리지 않고 최신 기록을 보여 줌
            if (!same(before.profiles[key], latest.profiles[key]) && !same(local, latest.profiles[key])) return refresh();
            if (local) merged.profiles[key] = local;
            else delete merged.profiles[key];
        }
        for (const key of changed) {
            const p = merged.profiles[key];
            const old = before.profiles[key];
            if (!p || (old && old.number === p.number && old.name === p.name)) continue;
            // 두 창에서 동시에 같은 번호·이름으로 새로 만들거나 이름을 바꾸는 경우도 보호
            if (Object.entries(merged.profiles).some(([otherKey, other]) => otherKey !== key && other.number === p.number && other.name === p.name)) return refresh();
        }
        merged.current = requested.current != null && merged.profiles[requested.current] ? requested.current : null;
        localStorage.setItem(KEY, JSON.stringify(merged));
        for (const key of changed) written.set(key, { value: merged.profiles[key] && copy(merged.profiles[key]) });
        ownWrites.set(data, written);
        const memory = { ...merged, profiles: { ...merged.profiles } };
        // 잠금을 기다리는 동안 같은 창에서 요청한 다음 저장의 변경분은 메모리에 남겨 둠
        for (const key of new Set([...Object.keys(data.profiles), ...Object.keys(requested.profiles)])) {
            if (same(data.profiles[key], requested.profiles[key])) continue;
            if (data.profiles[key]) memory.profiles[key] = data.profiles[key];
            else delete memory.profiles[key];
        }
        if (data.current !== requested.current) memory.current = data.current != null && memory.profiles[data.current] ? data.current : null;
        replaceData(data, memory, merged);
        return true;
    } catch (e) {
        return false;
    }
}

// Promise: true = 저장됨, false = 저장소 오류, 'conflict' = 다른 창의 더 최신 기록을 불러옴
export function saveData(data) {
    const requested = copy(data);
    const before = copy(baselines.get(data) || { current: null, profiles: {} });
    const prior = pendingRequests.get(data);
    const changed = [...new Set([...Object.keys(before.profiles), ...Object.keys(requested.profiles), ...Object.keys(prior?.requested.profiles || {})])]
        .filter(key => !same(before.profiles[key], requested.profiles[key]) || (prior && !same(prior.requested.profiles[key], requested.profiles[key])));
    const written = ownWrites.get(data) || new Map();
    const markers = new Map(changed.map(key => [key, written.get(key)]));
    const version = conflictVersions.get(data) || 0;
    const previous = pendingSaves.get(data) || Promise.resolve();
    const saving = previous.then(() => coordinatedSave(() => saveLocked(data, requested, before, changed, markers, version)));
    pendingSaves.set(data, saving);
    const request = { requested };
    pendingRequests.set(data, request);
    saving.then(() => { if (pendingRequests.get(data) === request) pendingRequests.delete(data); });
    return saving;
}

export const MAX_NAME = 10;
export function cleanName(name) {
    return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
}

export function newProfile(number, avatar, name = '') {
    const profile = { number, avatar, name: cleanName(name), quests: {}, createdAt: Date.now() };
    extrasOf(profile);
    return profile;
}

// 더 탐험하기 활동 기록. 쓴 글과 자료 탐구는 이 기기에만 남고 이어하기 코드에는 담기지 않음
const EXTRA_KEYS = ['timeline', 'review', 'people', 'places', 'writings', 'inquiries'];
export function extrasOf(profile) {
    if (!profile.extras || typeof profile.extras !== 'object') profile.extras = {};
    for (const key of EXTRA_KEYS) {
        if (!profile.extras[key] || typeof profile.extras[key] !== 'object') profile.extras[key] = {};
    }
    return profile.extras;
}

// 퀘스트 기록: stage = 끝낸 단계 수, done = 퀘스트 완료
export function questRecord(profile, questId) {
    const rec = profile.quests[questId];
    if (!rec || typeof rec !== 'object') profile.quests[questId] = { stage: 0, done: false, notes: [], mastery: null };
    return profile.quests[questId];
}
