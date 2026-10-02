import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSummary } from '../js/activities/summary.js';
import { stations } from '../content/quests.js';
import { writings } from '../content/writings.js';

const activities = [
    ...stations.map(s => ({ id: s.id, frames: s.quest.stages.find(stage => stage.type === 'summary').frames })),
    ...writings.flatMap(unit => unit.options),
];
const specOf = (activityId, blankId) => activities.find(a => a.id === activityId)
    .frames.flatMap(f => f.parts).find(part => part.id === blankId);

test('every quest and writing blank accepts its example and a supplied word-bank answer', () => {
    let checked = 0;
    for (const activity of activities) for (const frame of activity.frames) {
        for (const spec of frame.parts.filter(part => typeof part === 'object' && !part.free)) {
            assert.equal(evaluateSummary(spec, frame.example), true, `${activity.id}:${spec.id} example`);
            assert.equal(frame.wordBank.some(word => evaluateSummary(spec, word)), true, `${activity.id}:${spec.id} word bank`);
            checked++;
        }
    }
    assert.equal(checked, 50);
});

test('all single-syllable keywords explicitly opt into word matching', () => {
    for (const activity of activities) for (const frame of activity.frames) {
        for (const spec of frame.parts.filter(part => typeof part === 'object' && !part.free)) {
            for (const keyword of spec.keywords.filter(k => /^[가-힣]$/.test(k))) {
                assert.ok(spec.wholeKeywords?.includes(keyword), `${activity.id}:${spec.id} ${keyword}`);
            }
        }
    }
});

test('unrelated words containing short keywords are not correct answers', () => {
    for (const [activity, blank, value] of [
        ['q4', 'a', '당근을 먹고'], ['q4', 'a', '식당을 열고'], ['u1-unify', 'a', '당근'],
        ['q6', 'b', '효과가 생겨'], ['q3', 'c', '철학이 발달해서'], ['q3', 'c', '쇠고기가 많아서'],
        ['q3', 'b', '기름을 팔아서'], ['q3', 'b', '땅콩이 많아서'],
        ['q2', 'b', '힘들었다는 것을'], ['q9', 'a', '땅콩을 심으며'], ['q9', 'a', '쌀국수를 먹으며'],
        ['q10', 'a', '남자가 생겨서'], ['q10', 'a', '북극으로 갔고'], ['q10', 'a', '138년'],
        ['q10', 'b', '집착이 늘어'],
    ]) assert.equal(evaluateSummary(specOf(activity, blank), value), false, `${activity}:${blank} ${value}`);
});

test('normal Korean particles, noun forms and paraphrases remain accepted', () => {
    for (const [activity, blank, value] of [
        ['q4', 'a', '당'], ['q4', 'a', '당과힘을합쳐당의군대를몰아내고'], ['q4', 'a', '중국 당나라와 협력하고'],
        ['q4', 'a', '당군을 몰아내고'], ['q6', 'b', '효를 중요하게 여겨'], ['q6', 'b', '효도하며'],
        ['q6', 'b', '웃어른을 공경하며'], ['q3', 'c', '질 좋은 철이 많이 나서'], ['q3', 'c', '쇠로 만든 물건이 많아서'],
        ['q3', 'c', '쇠붙이를 수출해서'], ['q3', 'b', '땅이 기름져서'], ['q3', 'b', '기름지기'],
        ['q2', 'b', '많은 사람을 부릴 힘이 있는 지배자가'], ['q2', 'b', '힘센 사람이'],
        ['q9', 'a', '땅을 빼앗고'], ['q9', 'a', '쌀을 가져가고'], ['q10', 'b', '집과학교가부서져'],
        ['q10', 'a', '38 도 선으로 나뉘었고'], ['q10', 'a', '남과북으로 갈라져서'],
    ]) assert.equal(evaluateSummary(specOf(activity, blank), value), true, `${activity}:${blank} ${value}`);
});

test('two countries and both streetcar endpoints are required', () => {
    const countries = specOf('u1-unify', 'b');
    assert.equal(evaluateSummary(countries, '백제만을'), false);
    assert.equal(evaluateSummary(countries, '고구려를'), false);
    assert.equal(evaluateSummary(countries, '고구려와 백제를'), true);
    const endpoints = specOf('u2-streetcar', 'a');
    assert.equal(evaluateSummary(endpoints, '서대문'), false);
    assert.equal(evaluateSummary(endpoints, '청량리'), false);
    assert.equal(evaluateSummary(endpoints, '서대문에서청량리까지'), true);
});

test('each required fact accepts its own synonym group', () => {
    const jangbogo = specOf('u1-jangbogo', 'b');
    assert.equal(evaluateSummary(jangbogo, '해적을 물리칠'), false);
    assert.equal(evaluateSummary(jangbogo, '해상 무역을 할'), false);
    assert.equal(evaluateSummary(jangbogo, '해적을 물리치고 교역을 할'), true);
    const samil = specOf('u3-samil', 'b');
    assert.equal(evaluateSummary(samil, '태극기를 들고'), false);
    assert.equal(evaluateSummary(samil, '평화적으로'), false);
    assert.equal(evaluateSummary(samil, '태극기를 들고 비폭력으로'), true);
    assert.equal(evaluateSummary(samil, '태극기를 들고 폭력 없이'), true);
    const prison = specOf('u3-yugwansun', 'b');
    assert.equal(evaluateSummary(prison, '서대문'), false);
    assert.equal(evaluateSummary(prison, '형무소'), false);
    assert.equal(evaluateSummary(prison, '서대문 감옥'), true);
});

test('answers naming a place or object must give the requested specific name', () => {
    assert.equal(evaluateSummary(specOf('u1-tripitaka', 'b'), '합천'), false);
    assert.equal(evaluateSummary(specOf('u1-tripitaka', 'b'), '합천 해인사'), true);
    assert.equal(evaluateSummary(specOf('u2-streetcar', 'b'), '철도'), false);
    assert.equal(evaluateSummary(specOf('u2-streetcar', 'b'), '경인선 철도'), true);
    assert.equal(evaluateSummary(specOf('u1-tripitaka', 'a'), '나라를 지키려고'), false);
    assert.equal(evaluateSummary(specOf('u1-tripitaka', 'a'), '부처님의 힘으로 나라를 지키려고'), true);
});

test('spacing, alternative middle dots, ordinary synonyms and free writing stay flexible', () => {
    const samil = specOf('q9', 'b');
    for (const dot of ['·', 'ㆍ', '.', '‧', '•', '・', '･']) {
        assert.equal(evaluateSummary(samil, `3 ${dot} 1 운동을 일으키며`), true);
    }
    assert.equal(evaluateSummary(specOf('u3-kimgu', 'a'), '대한민국 임시 정부'), true);
    assert.equal(evaluateSummary(specOf('u2-sejong', 'a'), '한글'), true);
    assert.equal(evaluateSummary(specOf('q5', 'a'), '몽골의'), true);
    assert.equal(evaluateSummary({ free: true }, '나만의 생각이에요'), true);
    assert.equal(evaluateSummary({ free: true }, '나'), false);
    assert.equal(evaluateSummary({ free: true }, '  '), false);
});
