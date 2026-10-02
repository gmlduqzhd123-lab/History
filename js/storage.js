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
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
// 배열에 문자열 열쇠로 넣은 기록은 JSON 저장 시 사라지므로, 맵은 항상 일반 객체로 맞춤.
// 기존 숫자 열쇠에 남은 학생 기록도 버리지 않고 보존함.
const mapOf = value => isRecord(value) ? value : Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
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
            data.profiles = mapOf(data.profiles);
            for (const [key, p] of Object.entries(data.profiles)) {
                // 잘못 남은 번호 객체의 숫자 변환이 예외를 내더라도 다른 학생 기록은 보존함.
                const number = isRecord(p) && (typeof p.number === 'number' || typeof p.number === 'string') ? Number(p.number) : NaN;
                if (!Number.isInteger(number)) { delete data.profiles[key]; continue; }
                p.number = number;
                p.name = cleanName(p.name);
                extrasOf(p);
                p.quests = mapOf(p.quests);
                for (const [questId, q] of Object.entries(p.quests)) {
                    if (!isRecord(q)) { delete p.quests[questId]; continue; }
                    if (!Array.isArray(q.notes)) q.notes = [];
                    // 단계는 끝낸 단계 수(0~5). 음수·소수로 잘못 남으면 없는 화면을 렌더하지 않음.
                    q.stage = Number.isFinite(q.stage) ? Math.max(0, Math.min(5, Math.trunc(q.stage))) : 0;
                }
            }
            if (data.current != null && !Object.prototype.hasOwnProperty.call(data.profiles, data.current)) data.current = null;
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
    profile.extras = mapOf(profile.extras);
    for (const key of EXTRA_KEYS) {
        profile.extras[key] = mapOf(profile.extras[key]);
    }
    for (const [key, writing] of Object.entries(profile.extras.writings)) {
        if (!isRecord(writing)) { delete profile.extras.writings[key]; continue; }
        if (!Array.isArray(writing.lines)) writing.lines = [];
    }
    const places = profile.extras.places;
    if (places.visited != null) places.visited = mapOf(places.visited);
    return profile.extras;
}

// 퀘스트 기록: stage = 끝낸 단계 수, done = 퀘스트 완료
export function questRecord(profile, questId) {
    const rec = profile.quests[questId];
    if (!isRecord(rec)) profile.quests[questId] = { stage: 0, done: false, notes: [], mastery: null };
    return profile.quests[questId];
}
