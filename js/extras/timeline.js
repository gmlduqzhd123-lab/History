// ⏳ 연표 잇기: 섞인 사건 카드를 가장 먼저 일어난 일부터 눌러 연표에 붙임
import { h, shuffle, scrollTop } from '../dom.js';
import { feedbackBox, nextButton } from '../activities/common.js';
import { setCalm, tone } from '../tone.js';
import { extrasOf } from '../storage.js';

// env: { mount, topbar, go, profile, persist }
export function renderTimeline(env, timeline, { calm = false } = {}) {
    setCalm(calm);
    const record = extrasOf(env.profile()).timeline;
    const placed = []; // 붙인 사건의 순서 번호
    let mistakes = 0;

    const strip = h('ol', { class: 'tl-strip', 'aria-label': '내가 만든 연표' });
    const pool = h('div', { class: 'tl-pool' });
    const feedback = h('div', { 'aria-live': 'polite' });
    const progress = h('span', { class: 'counter' });
    const body = h('div');

    const updateProgress = () => { progress.textContent = `${placed.length} / ${timeline.events.length}`; };

    function place(index) {
        const ev = timeline.events[index];
        placed.push(index);
        strip.append(h('li', { class: 'tl-item' },
            h('span', { class: 'tl-year' }, ev.year),
            h('span', { class: 'tl-text' }, ev.t)));
        updateProgress();
        if (placed.length === timeline.events.length) finish();
    }

    function finish() {
        const best = record[timeline.key]?.best;
        record[timeline.key] = { done: true, best: best == null ? mistakes : Math.min(best, mistakes), at: Date.now() };
        env.persist();
        poolCard.remove();
        body.append(h('div', { class: 'card center', style: 'margin-top:16px' },
            h('div', { class: 'stamp' }, h('span', { class: 'big' }, '⏳'), calm ? '연표 완성' : '연표 완성!'),
            h('p', {}, mistakes === 0 ? '한 번도 틀리지 않고 순서대로 이었어요.' : `${mistakes}번 다시 생각해서 연표를 완성했어요.`),
            h('p', { class: 'small muted' }, '완성한 연표를 위에서 처음부터 끝까지 한 번 더 읽어 보세요.'),
            nextButton('🔁 다시 해 보기', () => env.go({ screen: 'timeline', key: timeline.key }), false),
            nextButton('🗺️ 지도로 돌아가기', () => env.go({ screen: 'map' }))));
    }

    const cards = shuffle(timeline.events.map((ev, i) => ({ ev, i })));
    cards.forEach(({ ev, i }) => {
        const btn = h('button', { class: 'tl-card', type: 'button' }, ev.t);
        btn.addEventListener('click', () => {
            if (i === placed.length) {
                btn.remove();
                feedback.replaceChildren(feedbackBox('good', tone('correct'), `${ev.year} — ${ev.t}`));
                place(i);
                return;
            }
            mistakes++;
            btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
            feedback.replaceChildren(feedbackBox('bad', '🤔 이보다 먼저 일어난 일이 남아 있어요', `${ev.hint} 더 앞선 일을 먼저 찾아봐요.`));
        });
        pool.append(btn);
    });
    updateProgress();

    const poolCard = h('div', { class: 'card' },
        h('h3', { style: 'margin-bottom:10px' }, '사건 카드'),
        pool,
        feedback);
    body.append(
        h('div', { class: 'card' },
            h('div', { class: 'row', style: 'margin-bottom:6px' }, h('h2', { style: 'flex:1' }, `⏳ ${timeline.title}`), progress),
            h('p', { class: 'muted' }, '가장 먼저 일어난 일부터 차례대로 눌러 연표에 붙여요.'),
            strip),
        poolCard,
    );
    env.mount(env.topbar('⏳ 연표 잇기', () => env.go({ screen: 'map' }), '🗺️ 지도'), body);
    scrollTop();
}
