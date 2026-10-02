import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { loadData, saveData, newProfile, questRecord } from '../js/storage.js';
import { encodeProgress, decodeProgress } from '../js/code.js';
import { questOrder, avatars } from '../content/quests.js';

const KEY = 'history-quest:v1';
let stored;
let unavailable;
let unreadable;
let databaseUnavailable;
let transactions = Promise.resolve();
const database = {
    transaction() {
        if (databaseUnavailable) throw new Error('database unavailable');
        const transaction = {
            objectStore: () => ({ get() {
                const request = {};
                transactions = transactions.then(() => new Promise(resolve => queueMicrotask(() => {
                    try { request.onsuccess?.(); transaction.oncomplete?.(); }
                    catch { transaction.onerror?.(); }
                    resolve();
                })));
                return request;
            } }),
        };
        return transaction;
    },
};
globalThis.indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
        if (databaseUnavailable) request.onerror?.();
        else { request.result = database; request.onsuccess?.(); }
    });
    return request;
} };
globalThis.localStorage = {
    getItem: () => {
        if (unreadable) throw new Error('storage access blocked');
        return stored ?? null;
    },
    setItem(key, value) {
        assert.equal(key, KEY);
        if (unavailable) throw new Error('storage full');
        stored = value;
    },
};
const read = () => JSON.parse(stored);
function seed() {
    stored = JSON.stringify({ current: '1:하늘', profiles: {
        '1:하늘': newProfile(1, avatars[0], '하늘'),
        '2:바다': newProfile(2, avatars[1], '바다'),
    } });
}
beforeEach(() => { unavailable = false; unreadable = false; databaseUnavailable = false; seed(); });

test('a stale tab preserves another tab’s new student and unrelated progress', async () => {
    const first = loadData();
    const stale = loadData();
    first.profiles['3:별'] = newProfile(3, avatars[2], '별');
    questRecord(first.profiles['2:바다'], 'q1').stage = 2;
    assert.equal(await saveData(first), true);
    stale.profiles['1:하늘'].name = '새하늘';
    assert.equal(await saveData(stale), true);
    assert.equal(Object.keys(read().profiles).length, 3);
    assert.equal(read().profiles['2:바다'].quests.q1.stage, 2);
    assert.equal(read().profiles['1:하늘'].name, '새하늘');
});

test('a stale same-student edit is rejected and receives the latest progress', async () => {
    const first = loadData();
    const stale = loadData();
    const record = questRecord(first.profiles['1:하늘'], 'q1');
    Object.assign(record, { stage: 5, done: true, notes: ['내가 쓴 정리'], mastery: { passed: true, best: 5 } });
    assert.equal(await saveData(first), true);
    questRecord(stale.profiles['1:하늘'], 'q1').stage = 1;
    assert.equal(await saveData(stale), 'conflict');
    assert.deepEqual(stale.profiles['1:하늘'].quests.q1, read().profiles['1:하늘'].quests.q1);
    assert.equal(stale.profiles['1:하늘'].quests.q1.stage, 5);
    stale.profiles['1:하늘'].name = '새하늘';
    assert.equal(await saveData(stale), true);
    assert.equal(read().profiles['1:하늘'].quests.q1.done, true);
});

test('deleting a student does not erase unrelated changes or resurrect on a stale save', async () => {
    const first = loadData();
    const stale = loadData();
    delete first.profiles['1:하늘'];
    first.current = null;
    assert.equal(await saveData(first), true);
    stale.profiles['2:바다'].name = '새바다';
    assert.equal(await saveData(stale), true);
    assert.equal(read().profiles['1:하늘'], undefined);
    assert.equal(stale.current, null);
    assert.equal(read().profiles['2:바다'].name, '새바다');
});

test('editing a remotely deleted student conflicts rather than restoring it', async () => {
    const first = loadData();
    const stale = loadData();
    delete first.profiles['1:하늘'];
    first.current = null;
    assert.equal(await saveData(first), true);
    questRecord(stale.profiles['1:하늘'], 'q1').stage = 1;
    assert.equal(await saveData(stale), 'conflict');
    assert.equal(read().profiles['1:하늘'], undefined);
    assert.equal(stale.current, null);
});

test('a stale delete cannot erase a student’s newer work', async () => {
    const first = loadData();
    const stale = loadData();
    questRecord(first.profiles['1:하늘'], 'q1').stage = 4;
    assert.equal(await saveData(first), true);
    delete stale.profiles['1:하늘'];
    stale.current = null;
    assert.equal(await saveData(stale), 'conflict');
    assert.equal(read().profiles['1:하늘'].quests.q1.stage, 4);
});

test('refreshing unrelated changes preserves an in-progress record and its later save', async () => {
    const first = loadData();
    const active = loadData();
    const record = questRecord(active.profiles['1:하늘'], 'q1');
    first.current = '2:바다';
    first.profiles['2:바다'].name = '새바다';
    assert.equal(await saveData(first), true);
    const refreshed = loadData(active);
    assert.equal(refreshed.profiles['1:하늘'].quests.q1, record);
    record.stage = 1;
    assert.equal(await saveData(refreshed), true);
    assert.equal(read().profiles['1:하늘'].quests.q1.stage, 1);
    assert.equal(read().profiles['2:바다'].name, '새바다');
});

test('concurrent creation of an identical student identity is rejected', async () => {
    const first = loadData();
    const stale = loadData();
    first.profiles['3:별'] = newProfile(3, avatars[0], '별');
    assert.equal(await saveData(first), true);
    stale.profiles['3:별:2'] = newProfile(3, avatars[1], '별');
    assert.equal(await saveData(stale), 'conflict');
    assert.equal(read().profiles['3:별:2'], undefined);
    assert.equal(Object.keys(read().profiles).length, 3);
});

test('legacy records keep their keys, notes and progress through a valid rename', async () => {
    stored = JSON.stringify({ current: '1', profiles: { '1': { number: 1, avatar: avatars[0], quests: {
        q1: { stage: 4, notes: ['옛 기록'], mastery: { passed: true, best: 4 } },
    } } } });
    const data = loadData();
    data.profiles['1'].name = '하늘';
    assert.equal(await saveData(data), true);
    assert.deepEqual(read().profiles['1'].quests.q1.notes, ['옛 기록']);
    assert.equal(read().profiles['1'].quests.q1.stage, 4);
    assert.equal(read().current, '1');
});

test('storage errors return failure without deleting stored records', async () => {
    const data = loadData();
    const before = stored;
    data.profiles['1:하늘'].name = '새하늘';
    unavailable = true;
    assert.equal(await saveData(data), false);
    assert.equal(stored, before);
});

test('an unreadable storage does not masquerade as a remote deletion', async () => {
    const data = loadData();
    data.profiles['1:하늘'].name = '새하늘';
    unreadable = true;
    assert.equal(await saveData(data), false);
    assert.equal(data.profiles['1:하늘'].name, '새하늘');
    assert.equal(data.current, '1:하늘');
});

test('database coordination failure never falls back to an unsafe write', async () => {
    const data = loadData();
    const before = stored;
    data.profiles['1:하늘'].name = '새하늘';
    databaseUnavailable = true;
    assert.equal(await saveData(data), false);
    assert.equal(stored, before);
    assert.equal(data.profiles['1:하늘'].name, '새하늘');
});

test('queued saves retain later local mutations and unrelated remote progress', async () => {
    const local = loadData();
    const remote = loadData();
    questRecord(remote.profiles['2:바다'], 'q1').stage = 4;
    assert.equal(await saveData(remote), true);
    local.profiles['1:하늘'].name = '새하늘';
    const first = saveData(local);
    questRecord(local.profiles['1:하늘'], 'q1').stage = 1;
    const second = saveData(local);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(read().profiles['2:바다'].quests.q1.stage, 4);
    assert.equal(read().profiles['1:하늘'].quests.q1.stage, 1);
    assert.equal(read().profiles['1:하늘'].name, '새하늘');
});

test('remote data absorbed by a predecessor does not authorize a queued stale edit', async () => {
    const local = loadData();
    const remote = loadData();
    questRecord(remote.profiles['2:바다'], 'q1').stage = 4;
    assert.equal(await saveData(remote), true);
    local.profiles['1:하늘'].name = '새하늘';
    const first = saveData(local);
    questRecord(local.profiles['2:바다'], 'q1').stage = 1;
    const second = saveData(local);
    assert.deepEqual(await Promise.all([first, second]), [true, 'conflict']);
    assert.equal(read().profiles['2:바다'].quests.q1.stage, 4);
    assert.equal(read().profiles['1:하늘'].name, '새하늘');
});

test('conflicting queued writes cannot overwrite a remote same-student update', async () => {
    const local = loadData();
    const remote = loadData();
    questRecord(remote.profiles['1:하늘'], 'q1').stage = 4;
    assert.equal(await saveData(remote), true);
    questRecord(local.profiles['1:하늘'], 'q1').stage = 1;
    const first = saveData(local);
    local.profiles['1:하늘'].quests.q1.stage = 2;
    const second = saveData(local);
    assert.deepEqual(await Promise.all([first, second]), ['conflict', 'conflict']);
    assert.equal(read().profiles['1:하늘'].quests.q1.stage, 4);
    assert.equal(local.profiles['1:하늘'].quests.q1.stage, 4);
});

test('queued reversions and deletion of a just-created student retain the later intent', async () => {
    const data = loadData();
    data.profiles['1:하늘'].name = '새하늘';
    data.profiles['3:별'] = newProfile(3, avatars[0], '별');
    const first = saveData(data);
    data.profiles['1:하늘'].name = '하늘';
    delete data.profiles['3:별'];
    const second = saveData(data);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(read().profiles['1:하늘'].name, '하늘');
    assert.equal(read().profiles['3:별'], undefined);
});

test('existing stage-four and completed codes retain mastery pass state', async () => {
    assert.deepEqual(decodeProgress('04400-0004M', questOrder, avatars).quests.q1.mastery, { passed: true });
    assert.equal(decodeProgress('04600-0006M', questOrder, avatars).quests.q1.done, true);
});

test('all supported student numbers and avatars round-trip progress without changing codes', async () => {
    for (let number = 1; number <= 40; number++) {
        for (const avatar of avatars) {
            const p = newProfile(number, avatar, '하늘');
            questOrder.forEach((id, index) => {
                const stage = index % 6;
                p.quests[id] = { stage, done: stage === 5, notes: [] };
            });
            const encoded = encodeProgress(p, questOrder, avatars);
            const result = decodeProgress(encoded.toLowerCase(), questOrder, avatars);
            assert.equal(result.number, number);
            assert.equal(result.avatar, avatar);
            assert.equal(encodeProgress(result, questOrder, avatars), encoded);
            questOrder.forEach((id, index) => {
                const stage = index % 6;
                assert.equal(result.quests[id]?.stage || 0, stage);
                assert.equal(!!result.quests[id]?.mastery?.passed, stage >= 4);
            });
        }
    }
});
