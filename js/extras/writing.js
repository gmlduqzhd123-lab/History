// 📰 역사 신문 · 편지: 단원을 마치면 주제 하나를 골라 문장 틀로 쓰고, 신문·편지 모양으로 보여 줌
// 쓰기 화면은 한 줄 정리(핵심어 확인, 낱말 상자, 예시 답, 비속어 거르기)를 그대로 씀
import { h, modal, scrollTop } from '../dom.js';
import { nextButton } from '../activities/common.js';
import { renderSummary } from '../activities/summary.js';
import { setCalm } from '../tone.js';
import { extrasOf } from '../storage.js';
import { writings } from '../../content/writings.js';

export const writingFor = key => writings.find(w => w.key === key);

// 노트에 저장한 글과 초안을 구별하고, 학생·활동마다 이 창에서 쓰던 내용을 기억해요.
const drafts = new Map();
let pendingDraftSaves = 0;
window.addEventListener('beforeunload', event => {
    if (!pendingDraftSaves && ![...drafts.values()].some(items => items.size)) return;
    event.preventDefault();
    event.returnValue = '';
});

function ownerKey(profileKey, profile) {
    return JSON.stringify([profileKey ?? `${profile.number}:${profile.name || ''}`, profile.createdAt ?? null]);
}

// 기기 기록을 실제로 지운 뒤에만 해당 탐험가의 초안과 닫기 경고도 정리해요.
export function discardWritingDrafts(profileKey, profile) {
    drafts.delete(ownerKey(profileKey, profile));
}

function draftStore(env, profile) {
    const key = ownerKey(env.profileKey?.(), profile);
    if (!drafts.has(key)) drafts.set(key, new Map());
    return drafts.get(key);
}

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

// env: 기존 활동 도구 + profileKey(), onDispose(cleanup), onBeforeNavigate(guard)
export function renderWriting(env, key, optionId) {
    const set = writingFor(key);
    if (!set) return env.go({ screen: 'map' });
    const owner = env.profile();
    if (!owner) return env.go({ screen: 'welcome' });
    setCalm(set.unit === 2);
    const store = extrasOf(owner).writings;
    const ownerDrafts = draftStore(env, owner);
    const draftKey = id => `${key}:${id}`;
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
            }, h('span', { class: 'wo-icon', 'aria-hidden': 'true' }, opt.icon), h('span', { class: 'wo-kind small' }, opt.kind === 'news' ? '신문 기사' : '편지'), h('span', { class: 'wo-title' }, opt.title),
                ownerDrafts.has(draftKey(opt.id)) ? h('span', { class: 'small muted' }, '✍️ 쓰던 내용이 있어요') : null)))),
        );
        scrollTop();
        return;
    }

    const opt = set.options.find(o => o.id === optionId);
    if (!opt) return env.go({ screen: 'writing', key });
    const content = h('div');
    const feedback = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    let dirty = false;
    let saving = false;
    let disposed = false;
    let closeLeave;
    const listRoute = { screen: 'writing', key };

    function remember() {
        const values = [...content.querySelectorAll('.blank')].map(input => input.value);
        dirty = values.some(value => value.length);
        if (dirty) ownerDrafts.set(draftKey(opt.id), values);
        else ownerDrafts.delete(draftKey(opt.id));
        feedback.textContent = '';
    }

    function leave(route, proceed = () => env.go(route)) {
        if (saving || disposed) return;
        if (!dirty) return proceed();
        closeLeave = modal(
            h('h2', {}, '아직 글을 저장하지 않았어요'),
            h('p', {}, '활동을 나갈까요? 이 창에서 다시 들어오면 쓰던 내용을 이어 쓸 수 있어요. 창을 닫기 전에는 글을 저장해 주세요.'),
            h('div', { class: 'inquiry-confirm-actions' },
                h('button', { type: 'button', class: 'btn btn-primary', onclick: () => closeLeave() }, '계속 쓰기'),
                h('button', { type: 'button', class: 'btn', onclick: () => { closeLeave(); proceed(); } }, '활동 나가기')),
        );
    }

    env.onBeforeNavigate?.((route, proceed) => leave(route, proceed));

    const blockSaving = event => {
        if (!saving) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    env.onDispose?.(() => {
        disposed = true;
        closeLeave?.();
        document.removeEventListener('click', blockSaving, true);
        document.removeEventListener('keydown', blockSaving, true);
    });
    document.addEventListener('click', blockSaving, true);
    document.addEventListener('keydown', blockSaving, true);
    env.mount(
        env.topbar(`${opt.icon} ${opt.kind === 'news' ? '역사 신문' : '편지'} 쓰기`, () => env.onBeforeNavigate ? env.go(listRoute) : leave(listRoute), '← 고르기'),
        h('div', { class: 'card card-accent' },
            h('div', { class: 'small muted' }, opt.kind === 'news' ? '📰 신문 기사 제목' : '✉️ 받는 사람'),
            h('h2', { style: 'margin-top:4px' }, opt.kind === 'news' ? opt.title : `${opt.to}께`)),
        content,
        feedback,
    );
    const temp = { notes: [] };
    renderSummary(content, { frames: opt.frames }, {
        record: temp,
        save: () => {},
        done: async () => {
            if (saving || disposed || env.profile() !== owner) return;
            remember();
            const previous = store[key];
            const saved = { id: opt.id, kind: opt.kind, title: opt.title, to: opt.to, lines: [...temp.notes], at: Date.now() };
            store[key] = saved;
            saving = true;
            content.setAttribute('aria-busy', 'true');
            const controls = [...content.querySelectorAll('input, button')];
            controls.forEach(control => { control.disabled = true; });
            let succeeded = false;
            pendingDraftSaves++;
            try { succeeded = await env.persist(true) === true; }
            catch (error) { succeeded = false; }
            finally { pendingDraftSaves--; }
            saving = false;
            content.removeAttribute('aria-busy');
            if (!succeeded) {
                if (env.profile() === owner && store[key] === saved) {
                    if (previous) store[key] = previous;
                    else delete store[key];
                }
                controls.forEach(control => { control.disabled = false; });
                if (!disposed) feedback.textContent = '글을 저장하지 못했어요. 쓴 내용은 이 화면에 남아 있어요. 다시 저장해 주세요.';
                return;
            }
            if (disposed || env.profile() !== owner) return;
            dirty = false;
            ownerDrafts.delete(draftKey(opt.id));
            showResult();
        },
    });
    const remembered = ownerDrafts.get(draftKey(opt.id));
    [...content.querySelectorAll('.blank')].forEach((input, index) => {
        input.value = typeof remembered?.[index] === 'string' ? remembered[index] : '';
        input.addEventListener('input', remember);
    });
    remember();

    function showResult() {
        feedback.textContent = '';
        content.replaceChildren(
            h('div', { class: 'card' }, writingView(store[key], env.author())),
            h('div', { class: 'card stack no-print' },
                h('p', { class: 'center' }, '나의 역사 노트에도 저장했어요.'),
                h('button', { class: 'btn btn-block no-print', type: 'button', onclick: () => window.print() }, '🖨️ 인쇄하기 / PDF로 저장'),
                nextButton('📒 나의 역사 노트 보기', () => env.go({ screen: 'notes' }), false),
                nextButton('🗺️ 지도로 돌아가기', back)),
        );
        scrollTop();
    }
}
