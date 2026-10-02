// ③ 생활 체험: 그 시대 아이가 되어 선택하며 하루를 보내는 이야기
import { h, rich, scrollTop } from '../dom.js';
import { art } from '../art.js';
import { speakButton, stopSpeaking } from '../tts.js';
import { retryChoice, nextButton, artBlock, focusActivity } from './common.js';

export function renderAdventure(root, stage, ctx) {
    const learned = [];

    function showIntro() {
        stopSpeaking();
        root.replaceChildren(h('div', { class: 'card center' },
            artBlock(stage.intro.art, art),
            h('p', { class: 'scene' }, rich(stage.intro.text)),
            h('div', { class: 'row', style: 'justify-content:center' }, speakButton(stage.intro.text)),
            nextButton('이야기 시작하기 ▶', () => showStep(0)),
        ));
        scrollTop();
        focusActivity(root);
    }

    function showStep(i) {
        stopSpeaking();
        const step = stage.steps[i];
        const last = i === stage.steps.length - 1;
        const after = h('div');
        root.replaceChildren(h('div', { class: 'card' },
            h('div', { class: 'row', style: 'margin-bottom:6px' },
                h('span', { class: 'counter' }, `장면 ${i + 1} / ${stage.steps.length}`),
                h('span', { class: 'spacer' }),
                speakButton(step.text, '장면 읽기')),
            artBlock(step.art, art, 'scene-art'),
            h('p', { class: 'scene' }, rich(step.text)),
            retryChoice({
                question: '어떻게 할까?',
                choices: step.choices,
                onSolved: () => {
                    learned.push(step.learned);
                    after.append(nextButton(last ? '이야기 마무리 ▶' : '다음 장면 ▶', () => (last ? showEnding() : showStep(i + 1))));
                },
            }),
            after,
        ));
        scrollTop();
        focusActivity(root);
    }

    function showEnding() {
        stopSpeaking();
        root.replaceChildren(h('div', { class: 'card' },
            h('h2', { class: 'center' }, '📌 이야기로 알게 된 것'),
            h('ul', { class: 'learned' }, ...learned.map(t => h('li', {}, t))),
            h('p', { class: 'scene', style: 'margin-top:14px' }, rich(stage.ending)),
            nextButton(`${stage.title} 완료! 다음 단계로 ▶`, () => ctx.done()),
        ));
        scrollTop();
        focusActivity(root);
    }

    showIntro();
}
