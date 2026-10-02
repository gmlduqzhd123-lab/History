// ② 이야기 카드: 짧은 글 읽기 → "다 읽었어요" → 확인 문제
import { h, rich, scrollTop } from '../dom.js';
import { art } from '../art.js';
import { speakButton, stopSpeaking } from '../tts.js';
import { retryChoice, nextButton, artBlock, focusActivity } from './common.js';

const MIN_READ_MS = 2500; // 읽지 않고 바로 넘기지 않도록 잠깐 기다림

export function renderReading(root, stage, ctx) {
    let index = 0;

    function showCard() {
        stopSpeaking();
        const card = stage.cards[index];
        const last = index === stage.cards.length - 1;
        const fullText = [card.title, ...card.text].join(' ');

        const checkSlot = h('div');
        const readBtn = h('button', { class: 'btn btn-good btn-block', type: 'button', disabled: true, style: 'margin-top:14px' }, '✔ 다 읽었어요');
        setTimeout(() => { readBtn.disabled = false; }, MIN_READ_MS);
        readBtn.addEventListener('click', () => {
            readBtn.classList.add('hidden');
            checkSlot.append(h('div', { class: 'card card-accent', style: 'margin-top:16px' },
                h('div', { class: 'small muted', style: 'margin-bottom:4px' }, '✅ 확인 문제'),
                retryChoice({
                    question: card.check.q,
                    choices: card.check.choices,
                    onSolved: () => {
                        checkSlot.append(nextButton(last ? `${stage.title} 완료! 다음 단계로 ▶` : '다음 카드 ▶', () => {
                            if (last) ctx.done();
                            else { index++; showCard(); }
                        }));
                    },
                }),
            ));
            checkSlot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        root.replaceChildren(
            h('div', { class: 'card' },
                h('div', { class: 'row', style: 'margin-bottom:6px' },
                    h('span', { class: 'counter' }, `카드 ${index + 1} / ${stage.cards.length}`),
                    h('span', { class: 'spacer' }),
                    speakButton(fullText, '읽어 주기')),
                artBlock(card.art, art),
                h('h2', { class: 'center', style: 'margin-bottom:12px' }, card.title),
                h('div', { class: 'story-text' }, ...card.text.map(p => h('p', {}, rich(p)))),
                readBtn,
                checkSlot,
            ),
        );
        scrollTop();
        // 읽어 주기 버튼이 제목보다 앞에 있으므로 카드의 시작부터 이어 가요.
        focusActivity(root, true);
    }

    showCard();
}

// 개념 도전에서 틀렸을 때 다시 볼 수 있는 요점 (확인 문제 없이 글만)
export function readingReview(stage) {
    return h('div', {},
        ...stage.cards.map(card => h('div', { class: 'card', style: 'margin-top:12px' },
            h('div', { class: 'row' }, h('h3', { style: 'flex:1' }, card.title), speakButton([card.title, ...card.text].join(' '))),
            h('div', { class: 'story-text' }, ...card.text.map(p => h('p', {}, rich(p)))),
        )),
    );
}
