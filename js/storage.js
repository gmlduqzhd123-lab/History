// 학습 기록은 이 기기의 브라우저에만 저장 (서버·로그인 없음, 이름 대신 번호만 사용)
const KEY = 'history-quest:v1';

export function loadData() {
    try {
        const data = JSON.parse(localStorage.getItem(KEY));
        if (data && data.profiles && typeof data.profiles === 'object') {
            // 기록이 일부 빠지거나 깨져 있어도 앱이 멈추지 않도록 모양을 맞춤
            for (const [key, p] of Object.entries(data.profiles)) {
                if (!p || typeof p !== 'object' || !Number.isInteger(Number(p.number))) { delete data.profiles[key]; continue; }
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

export function saveData(data) {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
}

export function newProfile(number, avatar) {
    return { number, avatar, quests: {}, createdAt: Date.now() };
}

// 퀘스트 기록: stage = 끝낸 단계 수, done = 퀘스트 완료
export function questRecord(profile, questId) {
    const rec = profile.quests[questId];
    if (!rec || typeof rec !== 'object') profile.quests[questId] = { stage: 0, done: false, notes: [], mastery: null };
    return profile.quests[questId];
}
