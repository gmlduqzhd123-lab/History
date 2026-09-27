// ① 유물 탐정: 조각조각 가려진 유물을 단서로 추리 → 쓰임 → 시대 → 알게 된 점
import { h, shuffle, scrollTop } from '../dom.js';
import { art } from '../art.js';
import { retryChoice, feedbackBox, nextButton } from './common.js';
import { speakButton } from '../tts.js';

export function renderDetective(root, stage, ctx) {
    let index = 0;

    function showArtifact() {
        const item = stage.artifacts[index];
        let cluesShown = 1;
        // 처음엔 9칸 중 3칸만 보이고, 단서를 볼 때마다 더 드러남
        const order = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        let opened = 3;

        const tiles = h('div', { class: 'tiles', 'aria-hidden': 'true' },
            ...order.map(() => h('div', { class: 'tile' }, '?')));
        const tileEls = [...tiles.children];
        const openTiles = n => order.slice(0, n).forEach(i => tileEls[i].classList.add('off'));
        openTiles(opened);

        const frame = h('div', { class: 'artifact-frame', html: art[item.art] || '' });
        frame.append(tiles);

        const clueList = h('ul', { class: 'clues' });
        const addClue = i => clueList.append(h('li', {}, item.clues[i]));
        addClue(0);

        const moreBtn = h('button', { class: 'btn btn-small', type: 'button' });
        const updateMoreBtn = () => {
            const left = item.clues.length - cluesShown;
            moreBtn.textContent = left > 0 ? `🔎 단서 더 보기 (${left}개 남음)` : '🔎 단서를 모두 보았어요';
            moreBtn.disabled = left <= 0;
        };
        updateMoreBtn();
        moreBtn.addEventListener('click', () => {
            if (cluesShown >= item.clues.length) return;
            addClue(cluesShown++);
            opened = Math.min(9, opened + 2);
            openTiles(opened);
            updateMoreBtn();
        });

        const titleEl = h('h2', {}, '이 유물은 무엇일까?');
        const flow = h('div');

        const useQ = retryChoice({
            question: item.useQ.q,
            choices: item.useQ.choices,
            onSolved: () => {
                openTiles(9);
                setTimeout(() => tiles.remove(), 600);
                moreBtn.classList.add('hidden');
                titleEl.textContent = `이 유물은 「${item.name}」!`;
                const eraQ = retryChoice({
                    question: item.eraQ.q,
                    choices: item.eraQ.choices,
                    onSolved: () => {
                        const last = index === stage.artifacts.length - 1;
                        flow.append(
                            feedbackBox('gold', `📌 알게 된 점`, item.fact),
                            nextButton(last ? '유물 탐정 완료! 다음 단계로 ▶' : '다음 유물 조사하기 ▶', () => {
                                if (last) ctx.done();
                                else { index++; showArtifact(); }
                            }),
                        );
                    },
                });
                flow.append(h('hr', { style: 'border:none;border-top:2px dashed var(--line);margin:18px 0' }), eraQ);
            },
        });
        flow.append(useQ);

        root.replaceChildren(
            h('div', { class: 'card' },
                h('div', { class: 'row', style: 'margin-bottom:10px' },
                    titleEl, h('span', { class: 'spacer' }),
                    h('span', { class: 'counter' }, `유물 ${index + 1} / ${stage.artifacts.length}`)),
                frame,
                clueList,
                h('div', { class: 'row', style: 'margin-top:10px' }, moreBtn,
                    speakButton(() => item.clues.slice(0, cluesShown).join(' '), '단서 읽기')),
            ),
            h('div', { class: 'card' }, flow),
        );
        scrollTop();
    }

    showArtifact();
}
