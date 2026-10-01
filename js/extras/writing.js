// 📰 역사 신문 · 편지: 단원을 마치면 주제 하나를 골라 문장 틀로 쓰고, 신문·편지 모양으로 보여 줌
// 쓰기 화면은 한 줄 정리(핵심어 확인, 낱말 상자, 예시 답, 비속어 거르기)를 그대로 씀
import { h, scrollTop } from '../dom.js';
import { nextButton } from '../activities/common.js';
import { renderSummary } from '../activities/summary.js';
import { setCalm } from '../tone.js';
import { extrasOf } from '../storage.js';
import { writings } from '../../content/writings.js';

export const writingFor = key => writings.find(w => w.key === key);

// 저장된 글을 신문 또는 편지 모양으로 (노트에서도 씀)
export function writingView(saved, author) {
    const date = new Date(saved.at).toLocaleDateString('ko-KR');
    if (saved.kind === 'news') {
        return h('article', { class: 'newspaper' },
            h('div', { class: 'np-mast' }, h('span', {}, '역사 탐험 신문'), h('span', { class: 'small' }, date)),
            h('h2', { class: 'np-head' }, saved.title),
            h('div', { class: 'np-by small' }, `${author} 기자`),
            ...saved.lines.map(line => h('p', {}, line)));
    }
    return h('article', { class: 'letter' },
        h('p', { class: 'lt-to' }, `${saved.to}께`),
        ...saved.lines.map(line => h('p', {}, line)),
        h('p', { class: 'lt-from' }, `${date}`, h('br'), `${author} 올림`));
}

// env: { mount, topbar, go, profile, persist, unitTitle(unit), author() }
export function renderWriting(env, key, optionId) {
    const set = writingFor(key);
    if (!set) return env.go({ screen: 'map' });
    setCalm(set.unit === 2);
    const store = extrasOf(env.profile()).writings;
    const back = () => env.go({ screen: 'map' });

    if (!optionId) {
        const saved = store[key];
        env.mount(
            env.topbar('📰 역사 신문 · 편지', back, '🗺️ 지도'),
            h('div', { class: 'card card-accent' },
                h('h2', {}, env.unitTitle(set.unit)),
                h('p', { class: 'small muted', style: 'margin-top:6px' }, '이 단원에서 배운 것으로 신문 기사나 편지를 써 봐요. 하나를 고르세요.')),
            saved ? h('div', { class: 'card' },
                h('h3', { style: 'margin-bottom:10px' }, '📒 내가 쓴 글'),
                writingView(saved, env.author()),
                h('p', { class: 'small muted', style: 'margin-top:8px' }, '아래에서 다시 고르면 새로 쓴 글로 바뀌어요.')) : null,
            h('div', { class: 'card' }, h('div', { class: 'writing-options' }, ...set.options.map(opt => h('button', {
                type: 'button', class: `writing-opt wo-${opt.kind}`, onclick: () => env.go({ screen: 'writing', key, opt: opt.id }),
            }, h('span', { class: 'wo-icon', 'aria-hidden': 'true' }, opt.icon), h('span', { class: 'wo-kind small' }, opt.kind === 'news' ? '신문 기사' : '편지'), h('span', { class: 'wo-title' }, opt.title))))),
        );
        scrollTop();
        return;
    }

    const opt = set.options.find(o => o.id === optionId);
    if (!opt) return env.go({ screen: 'writing', key });
    const content = h('div');
    env.mount(
        env.topbar(`${opt.icon} ${opt.kind === 'news' ? '역사 신문' : '편지'} 쓰기`, () => env.go({ screen: 'writing', key }), '← 고르기'),
        h('div', { class: 'card card-accent' },
            h('div', { class: 'small muted' }, opt.kind === 'news' ? '📰 신문 기사 제목' : '✉️ 받는 사람'),
            h('h2', { style: 'margin-top:4px' }, opt.kind === 'news' ? opt.title : `${opt.to}께`)),
        content,
    );
    const temp = { notes: [] };
    renderSummary(content, { frames: opt.frames }, {
        record: temp,
        save: () => {},
        done: () => {
            store[key] = { id: opt.id, kind: opt.kind, title: opt.title, to: opt.to, lines: temp.notes, at: Date.now() };
            env.persist();
            showResult();
        },
    });

    function showResult() {
        content.replaceChildren(
            h('div', { class: 'card' }, writingView(store[key], env.author())),
            h('div', { class: 'card stack' },
                h('p', { class: 'center' }, '나의 역사 노트에도 저장했어요.'),
                h('button', { class: 'btn btn-block no-print', type: 'button', onclick: () => window.print() }, '🖨️ 인쇄하기 / PDF로 저장'),
                nextButton('📒 나의 역사 노트 보기', () => env.go({ screen: 'notes' }), false),
                nextButton('🗺️ 지도로 돌아가기', back)),
        );
        scrollTop();
    }
}
