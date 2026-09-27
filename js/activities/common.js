// 여러 활동에서 함께 쓰는 선택형 문제
import { h, rich, plain, shuffle } from '../dom.js';
import { speakButton } from '../tts.js';

const FAST_MS = 2000; // 이보다 빨리 고른 오답은 "찍은" 것으로 봄

export function feedbackBox(kind, title, body) {
    return h('div', { class: `feedback ${kind}`, role: 'status' },
        title ? h('div', { class: 'fb-title' }, title) : null,
        body ? h('div', {}, typeof body === 'string' ? rich(body) : body) : null,
    );
}

export function questionHead(text) {
    return h('div', { class: 'row' },
        h('h3', { style: 'flex:1; min-width: 200px;' }, rich(text)),
        speakButton(() => text, '문제 읽기'),
    );
}

// 틀리면 그 선택지를 지우고 다시 고르게 하는 문제 (정답을 찾을 때까지)
// choices: [{ t, correct|good, fb }], onSolved(firstTry)
export function retryChoice({ question, choices, onSolved, twoCol = false }) {
    const wrap = h('div', { class: 'retry-choice' });
    const feedbackSlot = h('div');
    const list = h('div', { class: `choices${twoCol ? ' two-col' : ''}` });
    let shownAt = Date.now();
    let fastWrongs = 0;
    let wrongs = 0;
    const buttons = [];

    shuffle(choices).forEach(choice => {
        const isRight = !!(choice.correct || choice.good);
        const btn = h('button', { class: 'choice', type: 'button' }, h('span', { class: 'mark' }, '○'), h('span', {}, choice.t));
        btn.addEventListener('click', () => {
            const quick = Date.now() - shownAt < FAST_MS;
            if (isRight) {
                btn.classList.add('correct');
                btn.querySelector('.mark').textContent = '✅';
                buttons.forEach(b => { b.disabled = true; });
                feedbackSlot.replaceChildren(feedbackBox('good', wrongs === 0 ? '🎉 정답!' : '👍 찾았어요!', choice.fb));
                onSolved(wrongs === 0, feedbackSlot);
                return;
            }
            wrongs++;
            btn.classList.add('wrong');
            btn.querySelector('.mark').textContent = '✖';
            btn.disabled = true;
            fastWrongs = quick ? fastWrongs + 1 : 0;
            if (fastWrongs >= 2) {
                // 연달아 빠르게 틀리면 잠깐 멈추고 천천히 읽도록 안내
                fastWrongs = 0;
                buttons.forEach(b => { b.dataset.wasDisabled = b.disabled; b.disabled = true; });
                feedbackSlot.replaceChildren(feedbackBox('info', '⏳ 잠깐! 천천히 다시 읽어 볼까요?', choice.fb));
                setTimeout(() => {
                    buttons.forEach(b => { b.disabled = b.dataset.wasDisabled === 'true'; });
                    shownAt = Date.now();
                }, 3000);
            } else {
                feedbackSlot.replaceChildren(feedbackBox('bad', '🤔 다시 생각해 봐요', choice.fb));
                shownAt = Date.now();
            }
            wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
        });
        buttons.push(btn);
        list.append(btn);
    });

    wrap.append(questionHead(question), list, feedbackSlot);
    return wrap;
}

export function nextButton(label, onClick, primary = true) {
    const btn = h('button', { class: `btn ${primary ? 'btn-primary' : ''} btn-block`, type: 'button', style: 'margin-top:16px' }, label);
    btn.addEventListener('click', onClick);
    return btn;
}

// 이야기 카드·장면 그림: 그림 이름이면 SVG, 아니면 이모지
export function artBlock(artName, arts, className = 'story-art') {
    if (arts[artName]) return h('div', { class: className, html: arts[artName] });
    return h('div', { class: className, 'aria-hidden': 'true' }, artName || '');
}

export const plainText = plain;
