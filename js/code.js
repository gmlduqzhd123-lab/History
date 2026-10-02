// 이어하기 코드: 번호·캐릭터·퀘스트 진도를 10글자로 바꿔, 다른 기기에서도 이어서 할 수 있게 함
// (한 줄 정리 글은 코드에 담기지 않고 처음 쓴 기기에만 남음)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 헷갈리는 I, L, O, U 제외
const SLOTS = 10;        // 지도에 있는 정거장 수 (앞으로 퀘스트가 늘어도 코드 길이 그대로)
const STAGE_BITS = 3n;   // 0~5 = 끝낸 단계 수, 6 = 완료

function checksum(value) {
    let sum = 0n;
    let v = value;
    let i = 1n;
    while (v > 0n) { sum = (sum + (v & 0xFFn) * i) % 251n; v >>= 8n; i++; }
    return sum;
}

export function encodeProgress(profile, questOrder, avatars) {
    let value = BigInt(profile.number & 63);
    value = (value << 4n) | BigInt(Math.max(0, avatars.indexOf(profile.avatar)) & 15);
    for (let i = 0; i < SLOTS; i++) {
        const id = questOrder[i];
        const q = id && profile.quests[id];
        const n = !q ? 0 : q.done ? 6 : Math.min(5, q.stage || 0);
        value = (value << STAGE_BITS) | BigInt(n);
    }
    value = (value << 8n) | checksum(value);
    let out = '';
    for (let i = 0; i < 10; i++) { out = ALPHABET[Number(value & 31n)] + out; value >>= 5n; }
    return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function decodeProgress(code, questOrder, avatars) {
    const clean = String(code).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (clean.length !== 10) return null;
    let value = 0n;
    for (const ch of clean) {
        const d = ALPHABET.indexOf(ch);
        if (d < 0) return null;
        value = (value << 5n) | BigInt(d);
    }
    const sum = value & 0xFFn;
    value >>= 8n;
    if (checksum(value) !== sum) return null;
    const quests = {};
    for (let i = SLOTS - 1; i >= 0; i--) {
        const n = Number(value & 7n);
        value >>= STAGE_BITS;
        const id = questOrder[i];
        if (id && n > 0) quests[id] = { stage: n === 6 ? 5 : n, done: n === 6, notes: [], mastery: n >= 4 ? { passed: true } : null };
    }
    const avatar = avatars[Number(value & 15n)] || avatars[0];
    value >>= 4n;
    const number = Number(value & 63n);
    if (number < 1) return null;
    return { number, avatar, quests };
}
