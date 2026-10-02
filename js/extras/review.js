// 🔁 복습 상자: 개념 도전에서 첫 시도에 틀린 개념을 다음 날 다시 풀어 봄
// 기록: extras.review["q3|kings"] = { q: 'q3', c: 'kings', at: 넣은(또는 다시 틀린) 시각 }
// 맞히면 상자에서 꺼내고, 또 틀리면 다음 날 다시 나옴 (하루 뒤에 다시 떠올리는 것이 기억에 오래 남음)
import { h, scrollTop } from '../dom.js';
import { feedbackBox, nextButton } from '../activities/common.js';
import { renderQuestion } from '../activities/mastery.js';
import { setCalm, tone } from '../tone.js';
import { extrasOf } from '../storage.js';

const PER_DAY = 3; // 한 번에 다시 풀 개념 수

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function masteryOf(stations, questId) {
    return stations.find(s => s.id === questId)?.quest?.stages.find(s => s.type === 'mastery');
}

// 개념 도전 결과를 상자에 반영
export function updateReview(profile, questId, wrongConcepts, rightConcepts) {
    const box = extrasOf(profile).review;
    const now = Date.now();
    wrongConcepts.forEach(c => { box[`${questId}|${c}`] = { q: questId, c, at: now }; });
    rightConcepts.forEach(c => { delete box[`${questId}|${c}`]; });
}

// 오늘 다시 풀 차례인 개념 (어제 이전에 넣은 것, 오래된 것부터)
export function dueItems(profile, stations) {
    const box = extrasOf(profile).review;
    const today = startOfToday();
    // 내용이 바뀌어 더는 없는 개념이나 깨진 기록은 상자에서 치움
    for (const [key, item] of Object.entries(box)) {
        if (!item || !masteryOf(stations, item.q)?.questions.some(q => q.concept === item.c)) delete box[key];
    }
    return Object.entries(box)
        .filter(([, item]) => item.at < today)
        .sort((a, b) => a[1].at - b[1].at)
        .map(([key, item]) => ({ key, ...item }));
}

// 상자에 있지만 아직 차례가 아닌 개념 수 (오늘 틀린 것)
export function waitingCount(profile) {
    const today = startOfToday();
    return Object.values(extrasOf(profile).review).filter(item => item && item.at >= today).length;
}

// env: { mount, topbar, go, profile, persist }
export function renderReview(env, stations) {
    const profile = env.profile();
    const box = extrasOf(profile).review;
    const items = dueItems(profile, stations).slice(0, PER_DAY);
    if (!items.length) return env.go({ screen: 'map' });
    let index = 0;
    let remembered = 0;
    const content = h('div');
    env.mount(env.topbar('🔁 오늘의 복습 상자', () => env.go({ screen: 'map' }), '🗺️ 지도'), content);

    function showItem() {
        const item = items[index];
        const station = stations.find(s => s.id === item.q);
        setCalm(station.quest.calm);
        const pool = masteryOf(stations, item.q).questions.filter(q => q.concept === item.c);
        const question = pool[Math.floor(Math.random() * pool.length)];
        const slot = h('div');
        const headRow = h('div', { class: 'row', style: 'margin-bottom:8px' },
            h('span', { class: 'counter' }, `복습 ${index + 1} / ${items.length} · ${station.emoji} ${station.name}`),
            h('span', { class: 'spacer' }));
        const body = renderQuestion(question, async correct => {
            if (correct) {
                remembered++;
                delete box[item.key];
                slot.append(feedbackBox('good', `${tone('correct')} 이제 기억하고 있어요`, question.explain));
            } else {
                box[item.key] = { q: item.q, c: item.c, at: Date.now() };
                slot.append(feedbackBox('bad', '📚 이렇게 기억해요 (내일 한 번 더 나와요)', question.explain));
            }
            if (await env.persist() === false) return;
            const last = index === items.length - 1;
            slot.append(nextButton(last ? '복습 마치기 ▶' : '다음 복습 ▶', () => {
                if (last) return showEnd();
                index++;
                showItem();
            }));
        }, headRow);
        const intro = h('div', { class: 'feedback info', style: 'margin:0 0 12px' }, '지난번에 헷갈렸던 개념이에요. 하루 지나 다시 떠올리면 오래 기억할 수 있어요.');
        const card = h('div', { class: 'card' }, headRow, body, slot);
        if (index === 0) content.replaceChildren(intro, card);
        else content.replaceChildren(card);
        scrollTop();
    }

    function showEnd() {
        setCalm(false);
        const left = Object.keys(box).length;
        content.replaceChildren(h('div', { class: 'card center' },
            h('div', { class: 'stamp' }, h('span', { class: 'big' }, '🔁'), '복습 완료'),
            h('p', {}, `${items.length}개 가운데 ${remembered}개를 기억해 냈어요.`),
            h('p', { class: 'small muted' }, left ? `상자에 남은 개념 ${left}개는 다음에 다시 나와요.` : '복습 상자가 텅 비었어요!'),
            nextButton('🗺️ 지도로 돌아가기', () => env.go({ screen: 'map' }))));
        scrollTop();
    }

    showItem();
}
