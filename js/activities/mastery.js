// ④ 개념 도전: 개념마다 한 문제씩, 틀린 개념은 한 번 더 확인 (비슷한 문제가 있으면 그 문제로, 점수는 첫 시도만 셈)
import { h, rich, shuffle, scrollTop, modal } from '../dom.js';
import { feedbackBox, questionHead, nextButton } from './common.js';
import { readingReview } from './reading.js';
import { tone } from '../tone.js';

const FAST_MS = 2000;

export function renderMastery(root, stage, ctx) {
    const byConcept = new Map();
    stage.questions.forEach(q => {
        if (!byConcept.has(q.concept)) byConcept.set(q.concept, []);
        byConcept.get(q.concept).push(q);
    });

    function start() {
        // 꼭 나올 개념 + 나머지는 무작위로 골라 pick개
        const always = (stage.always || []).filter(c => byConcept.has(c));
        const others = shuffle([...byConcept.keys()].filter(c => !always.includes(c)));
        const concepts = shuffle([...always, ...others.slice(0, Math.max(0, stage.pick - always.length))]);

        const queue = concepts.map(c => ({ q: pickQuestion(c), retry: false }));
        const firstTry = new Map(); // concept → 첫 시도 정답 여부
        const missed = [];
        let fastWrongs = 0;
        let done = 0;
        let finishing = false;

        function pickQuestion(concept, avoid) {
            const pool = byConcept.get(concept);
            const others = pool.filter(q => q !== avoid);
            const list = others.length ? others : pool;
            return list[Math.floor(Math.random() * list.length)];
        }

        function showNext() {
            if (!queue.length) return showResult();
            const { q, retry, same } = queue.shift();
            const total = concepts.length;
            const slot = h('div');
            const headRow = h('div', { class: 'row', style: 'margin-bottom:8px' },
                h('span', { class: 'counter' }, retry ? (same ? '🔁 해설을 떠올리며 한 번 더' : '🔁 비슷한 문제로 다시 도전') : `문제 ${Math.min(done + 1, total)} / ${total}`),
                h('span', { class: 'spacer' }));

            const onAnswer = (correct, quick) => {
                if (!retry) { firstTry.set(q.concept, correct); done++; }
                if (correct) {
                    fastWrongs = 0;
                    slot.append(feedbackBox('good', retry ? tone('retryCorrect') : tone('correct'), q.explain));
                } else {
                    fastWrongs = quick ? fastWrongs + 1 : 0;
                    slot.append(feedbackBox('bad', '📚 이렇게 기억해요', q.explain));
                    if (!retry) {
                        const again = pickQuestion(q.concept, q);
                        queue.push({ q: again, retry: true, same: again === q });
                    }
                    else missed.push(q);
                }
                const btn = nextButton(queue.length ? '다음 문제 ▶' : '결과 보기 ▶', showNext);
                if (fastWrongs >= 2) {
                    // 빠르게 연달아 틀리면 해설을 읽을 시간을 줌
                    fastWrongs = 0;
                    btn.disabled = true;
                    slot.append(feedbackBox('info', '⏳ 잠깐! 해설을 천천히 읽어 볼까요?', null));
                    setTimeout(() => { btn.disabled = false; }, 4000);
                }
                slot.append(btn);
            };

            const body = renderQuestion(q, onAnswer, headRow);
            root.replaceChildren(h('div', { class: 'card' }, headRow, body, slot));
            scrollTop();
        }

        async function showResult() {
            if (finishing) return;
            finishing = true;
            try {
                const score = concepts.filter(c => firstTry.get(c)).length;
                const passMark = Math.min(stage.pass, concepts.length);
                const passed = score >= passMark;
                const wrongConcepts = concepts.filter(c => !firstTry.get(c));
                ctx.record.mastery = { passed: passed || !!ctx.record.mastery?.passed, best: Math.max(score, ctx.record.mastery?.best || 0), total: concepts.length };
                if (await ctx.save() === false) return;
                // 첫 시도에 틀린 개념은 복습 상자에 넣고, 맞힌 개념은 꺼냄
                if (await ctx.reviewUpdate?.(wrongConcepts, concepts.filter(c => firstTry.get(c))) === false) return;

                const tips = wrongConcepts.map(c => byConcept.get(c)[0].explain);
                root.replaceChildren(h('div', { class: 'card center' },
                    h('div', { class: 'score-big' }, `${score} / ${concepts.length}`),
                    passed
                        ? h('div', {}, h('div', { class: 'stamp' }, h('span', { class: 'big' }, tone('masteryIcon')), tone('masteryStamp')),
                            h('p', {}, tone('masteryPraise')))
                        : h('div', {},
                            h('p', { style: 'font-size:20px' }, `${passMark}문제 이상 맞히면 통과예요. 조금만 더 힘내요! 💪`),
                            h('p', { class: 'muted' }, '틀린 개념을 다시 확인하고 새 문제로 도전해 보세요.')),
                    tips.length ? h('div', { style: 'text-align:left' },
                        h('h3', { style: 'margin-top:12px' }, '📌 다시 기억할 것'),
                        ...tips.map(t => h('div', { class: 'note-line' }, rich(t)))) : null,
                    passed
                        ? nextButton('다음 단계로 ▶', async event => {
                            if (finishing) return;
                            finishing = true;
                            const button = event.currentTarget;
                            button.disabled = true;
                            try { await ctx.done(); }
                            finally {
                                finishing = false;
                                if (button.isConnected) button.disabled = false;
                            }
                        })
                        : h('div', {},
                            ctx.readingStage ? nextButton('📖 이야기 카드 요점 다시 보기', () => {
                                const close = modal(h('h2', {}, '📖 요점 다시 보기'), readingReview(ctx.readingStage),
                                    nextButton('다 봤어요', () => close()));
                            }, false) : null,
                            nextButton('🔁 새 문제로 다시 도전', start)),
                ));
                scrollTop();
            } finally { finishing = false; }
        }

        showNext();
    }

    start();
}

// 문제 유형별 화면. onAnswer(correct, quick) — 복습 상자에서도 씀
export function renderQuestion(q, onAnswer, headRow) {
    const shownAt = Date.now();
    const quick = () => Date.now() - shownAt < FAST_MS;
    const wrap = h('div');
    const hintSlot = h('div');
    let answered = false;

    const hintBtn = h('button', { class: 'btn btn-small', type: 'button' }, '🙋 힌트');
    headRow.append(hintBtn);

    if (q.type === 'sort') {
        const items = pickSortItems(q);
        const choice = new Map();
        const rows = items.map(item => {
            const seg = h('div', { class: 'seg', role: 'group' });
            const row = h('div', { class: 'sort-item' }, h('span', { class: 'label' }, item.t), seg);
            q.buckets.forEach((name, b) => {
                const btn = h('button', { type: 'button', 'aria-pressed': 'false' }, name);
                btn.addEventListener('click', () => {
                    if (answered) return;
                    choice.set(item, b);
                    [...seg.children].forEach((c, i) => { c.classList.toggle('on', i === b); c.setAttribute('aria-pressed', i === b); });
                    checkBtn.disabled = choice.size < items.length;
                });
                seg.append(btn);
            });
            return { item, row };
        });
        const checkBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true, style: 'margin-top:12px' }, '확인하기');
        checkBtn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            checkBtn.classList.add('hidden');
            hintBtn.disabled = true;
            let allRight = true;
            rows.forEach(({ item, row }) => {
                const ok = choice.get(item) === item.b;
                if (!ok) allRight = false;
                row.classList.add(ok ? 'correct' : 'wrong');
                if (!ok) row.append(h('span', { class: 'small' }, `→ 정답: ${q.buckets[item.b]}`));
            });
            onAnswer(allRight, quick());
        });
        hintBtn.addEventListener('click', () => { hintBtn.disabled = true; hintSlot.append(feedbackBox('info', '💡 힌트', q.hint)); });
        wrap.append(questionHead(q.q), hintSlot, ...rows.map(r => r.row), checkBtn);
        return wrap;
    }

    // 선택형·OX
    const options = q.type === 'ox'
        ? [{ t: '⭕ 맞아요', right: q.answer === true }, { t: '❌ 틀려요', right: q.answer === false }]
        : shuffle(q.choices.map((t, i) => ({ t, right: i === q.answer })));
    const list = h('div', { class: `choices${q.type === 'ox' ? ' two-col' : ''}` });
    const buttons = options.map(opt => {
        const btn = h('button', { class: 'choice', type: 'button', style: q.type === 'ox' ? 'justify-content:center;font-size:22px' : '' },
            q.type === 'ox' ? null : h('span', { class: 'mark' }, '○'), h('span', {}, opt.t));
        btn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            hintBtn.disabled = true;
            buttons.forEach((b, i) => {
                b.disabled = true;
                if (options[i].right) b.classList.add('correct');
            });
            if (!opt.right) btn.classList.add('wrong');
            const mark = btn.querySelector('.mark');
            if (mark) mark.textContent = opt.right ? '✅' : '✖';
            onAnswer(opt.right, quick());
        });
        list.append(btn);
        return btn;
    });

    hintBtn.addEventListener('click', () => {
        hintBtn.disabled = true;
        hintSlot.append(feedbackBox('info', '💡 힌트', q.hint));
        // 보기가 3개 이상이면 오답 하나를 지워 줌
        if (options.length > 2) {
            const wrongIdx = options.map((o, i) => (o.right ? -1 : i)).filter(i => i >= 0);
            const i = wrongIdx[Math.floor(Math.random() * wrongIdx.length)];
            buttons[i].disabled = true;
            buttons[i].classList.add('eliminated');
        }
    });

    wrap.append(questionHead(q.q), hintSlot, list);
    return wrap;
}

// 분류 문제: 칸마다 적어도 하나씩 들어가도록 show개를 고름
function pickSortItems(q) {
    const n = Math.max(q.show || q.items.length, q.buckets.length);
    const pool = shuffle(q.items);
    const pick = q.buckets.map((_, b) => pool.find(it => it.b === b)).filter(Boolean);
    pool.forEach(it => { if (pick.length < n && !pick.includes(it)) pick.push(it); });
    return shuffle(pick);
}
