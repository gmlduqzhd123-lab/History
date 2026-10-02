// 자료의 근거를 고르고 생각을 쓰는 탐구·역사 일기. 자유 응답은 자동으로 정오 채점하지 않음
import { h, modal, scrollTop } from '../dom.js';
import { extrasOf } from '../storage.js';
import { setCalm } from '../tone.js';
import { filterProfanity } from '../filter.js';
import { inquiries } from '../../content/inquiries.js';

// 정식 기록과 별도로 이 창에서 쓰던 내용을 탐험가·활동별로 기억
const drafts = new Map();
let pendingDraftSaves = 0;
// 홈·노트·학생 변경 뒤에도 초안이 남아 있으면 창을 닫기 전에 알려 줌.
// 화면별 정리와 분리해 저장하지 않은 글의 경고가 사라지지 않게 함.
window.addEventListener('beforeunload', event => {
    if (!pendingDraftSaves && ![...drafts.values()].some(items => items.size)) return;
    event.preventDefault();
    event.returnValue = '';
});
const textOf = value => typeof value === 'string' ? value : '';
const evidenceOf = saved => Array.isArray(saved?.evidence) ? saved.evidence : [];
const kindLabel = activity => activity.kind === 'diary' ? '역사 일기' : '역사 자료 탐구';
const profileDraftKey = (profileKey, profile) => JSON.stringify([
    profileKey ?? `${profile.number}:${profile.name || ''}`, profile.createdAt ?? null,
]);

function draftStore(env, profile) {
    // 저장 충돌로 profile 객체가 교체되어도 같은 탐험가의 초안은 유지해요.
    // 같은 번호의 다른 학생과 새로 만든 기록은 서로 섞이지 않아요.
    const key = profileDraftKey(env.profileKey?.(), profile);
    if (!drafts.has(key)) drafts.set(key, new Map());
    return drafts.get(key);
}

// 기록 삭제가 기기에 반영된 뒤에만 호출해, 실패한 삭제의 초안은 계속 보호해요.
export function discardInquiryDrafts(profileKey, profile) {
    drafts.delete(profileDraftKey(profileKey, profile));
}

function stateOf(saved, activity) {
    return {
        role: activity.roles?.some(role => role.id === saved?.role) ? saved.role : '',
        evidence: activity.sources.filter(source => evidenceOf(saved).includes(source.id)).map(source => source.id),
        answers: Object.fromEntries(activity.prompts.map(prompt => [prompt.id, textOf(saved?.answers?.[prompt.id])])),
        checks: activity.checks.map((_, index) => saved?.checks?.[index] === true),
    };
}

function canOpen(env, activity) {
    return typeof env.canInquire === 'function' && env.canInquire(activity);
}

// 노트와 인쇄에서도 같은 자료 제목·역할·학생의 응답을 보여 줌
export function inquiryView(saved, activity, author = '') {
    const role = activity.roles?.find(item => item.id === saved.role);
    const date = new Date(saved.at);
    const evidence = activity.sources.filter(source => evidenceOf(saved).includes(source.id));
    return h('article', { class: 'inquiry-result' },
        h('p', { class: 'inquiry-kind' }, kindLabel(activity)),
        h('h3', { class: 'inquiry-title' }, activity.title),
        author ? h('p', { class: 'inquiry-result-meta' }, `작성자: ${author}`) : null,
        h('p', { class: 'inquiry-result-meta' },
            Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR'),
            role ? ` · ${role.label}` : ''),
        null, // 교과서 쪽수(pageRef)는 출판사마다 달라 학생 화면에 보이지 않음
        h('h4', { class: 'inquiry-result-label' }, '내가 고른 근거 자료'),
        h('ul', { class: 'inquiry-result-evidence' }, ...evidence.map(source => h('li', {}, source.title))),
        ...activity.prompts.map(prompt => h('section', { class: 'inquiry-result-answer' },
            h('h4', { class: 'inquiry-result-label' }, prompt.label),
            h('p', { class: 'inquiry-result-text' }, filterProfanity(textOf(saved.answers?.[prompt.id]))))),
        h('p', { class: 'inquiry-hint' }, '자료의 근거와 내 생각을 구별하고, 글을 다시 읽어 스스로 점검한 기록이에요.'));
}

// env: 기존 활동 도구 + profileKey(), canInquire(activity), onDispose(cleanup)
export function renderInquiry(env, unit, activityId) {
    setCalm(unit === 2);
    const owner = env.profile();
    if (!owner) return env.go({ screen: 'welcome' });
    // 개별 인쇄에서도 이름과 번호를 남기고, 저장 중 학생이 바뀌어도 작성자가 섞이지 않아요.
    const author = owner.name ? `${owner.number}번 ${owner.name}` : `${owner.number}번`;
    const extra = extrasOf(owner);
    if (!extra.inquiries || typeof extra.inquiries !== 'object') extra.inquiries = {};
    const store = extra.inquiries;
    const ownerDrafts = draftStore(env, owner);
    const activities = inquiries.filter(activity => activity.unit === unit);
    const backToMap = () => env.go({ screen: 'map' });

    if (!activityId) {
        env.mount(
            env.topbar('🔎 자료 탐구 · 역사 일기', backToMap, '🗺️ 지도'),
            h('div', { class: 'card inquiry-intro' },
                h('h2', {}, env.unitTitle ? env.unitTitle(unit) : '자료로 생각하는 역사'),
                h('p', {}, '자료에서 근거를 찾고, 그때 사람들의 생활을 생각해 봐요. 하고 싶은 활동을 골라요.'),
                h('p', { class: 'inquiry-hint' }, '관련 정거장을 마치면 활동을 할 수 있어요. 쓴 글은 나의 역사 노트에 남아요.')),
            h('div', { class: 'inquiry-options' }, ...activities.map(activity => {
                const open = canOpen(env, activity);
                return h('button', {
                    type: 'button', class: 'card inquiry-option', disabled: !open,
                    onclick: () => { if (canOpen(env, activity)) env.go({ screen: 'inquiry', unit, id: activity.id }); },
                }, h('span', { class: 'inquiry-kind' }, kindLabel(activity)),
                h('span', { class: 'inquiry-title' }, activity.title),
                null,
                !open ? h('span', { class: 'inquiry-lock' }, '🔒 관련 정거장을 먼저 마쳐 주세요.') : null,
                store[activity.id] ? h('span', { class: 'inquiry-saved-badge' }, '📒 저장한 기록이 있어요') : null,
                ownerDrafts.has(activity.id) ? h('span', { class: 'inquiry-hint' }, '✍️ 쓰던 내용이 있어요') : null);
            })),
        );
        scrollTop();
        return;
    }

    const activity = activities.find(item => item.id === activityId);
    if (!activity) return env.go({ screen: 'inquiry', unit });
    if (!canOpen(env, activity)) {
        env.mount(env.topbar('🔎 자료 탐구 · 역사 일기', () => env.go({ screen: 'inquiry', unit }), '← 활동 고르기'),
            h('div', { class: 'card inquiry-intro' }, h('h2', {}, activity.title),
                h('p', { class: 'inquiry-lock' }, '🔒 관련 정거장을 먼저 마치면 이 활동을 할 수 있어요.')));
        return;
    }

    const initial = stateOf(store[activity.id], activity);
    const remembered = ownerDrafts.get(activity.id);
    const editing = remembered || initial;
    let dirty = JSON.stringify(editing) !== JSON.stringify(initial);
    let saving = false;
    let disposed = false;
    let closeLeave;
    const inputs = new Map();
    const evidenceInputs = new Map();
    const checkInputs = [];
    const roleInputs = new Map();
    const container = h('div', { class: 'inquiry-editor' });
    const form = h('form', { class: 'inquiry-form', novalidate: true });
    const feedback = h('p', { class: 'inquiry-feedback', role: 'status', 'aria-live': 'polite' });
    const roleContext = h('p', { class: 'inquiry-role-context', 'aria-live': 'polite' });
    const listRoute = { screen: 'inquiry', unit };

    function collect() {
        return {
            role: [...roleInputs].find(([, input]) => input.checked)?.[0] || '',
            evidence: [...evidenceInputs].filter(([, input]) => input.checked).map(([id]) => id),
            answers: Object.fromEntries([...inputs].map(([id, input]) => [id, input.value])),
            checks: checkInputs.map(input => input.checked),
        };
    }

    function remember() {
        const state = collect();
        dirty = JSON.stringify(state) !== JSON.stringify(initial);
        if (dirty) ownerDrafts.set(activity.id, state);
        else ownerDrafts.delete(activity.id);
        feedback.textContent = '';
        const selected = activity.roles?.find(role => role.id === state.role);
        roleContext.textContent = selected?.context || '';
    }

    function leave(route) {
        if (saving || disposed) return;
        if (!dirty) return env.go(route);
        closeLeave = modal(
            h('h2', {}, '아직 탐구 기록을 저장하지 않았어요'),
            h('p', {}, '활동을 나갈까요? 이 창에서 다시 들어오면 쓰던 내용을 이어 쓸 수 있어요. 창을 닫기 전에는 기록을 저장해 주세요.'),
            h('div', { class: 'inquiry-confirm-actions' },
                h('button', { type: 'button', class: 'btn btn-primary', onclick: () => closeLeave() }, '계속 쓰기'),
                h('button', { type: 'button', class: 'btn', onclick: () => { closeLeave(); env.go(route); } }, '활동 나가기')),
        );
    }

    const blockSaving = event => {
        if (!saving) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    function cleanup() {
        disposed = true;
        closeLeave?.();
        document.removeEventListener('click', blockSaving, true);
        document.removeEventListener('keydown', blockSaving, true);
    }
    env.onDispose?.(cleanup);
    document.addEventListener('click', blockSaving, true);
    document.addEventListener('keydown', blockSaving, true);

    if (activity.kind === 'diary') {
        form.append(h('div', { class: 'card' }, h('h3', { class: 'inquiry-section-title' }, '1. 그때 사람이 되어 생각해요'),
            h('p', { class: 'inquiry-fact-guide' }, '자료에서 확인한 사실과 내가 상상한 감정·말을 구별해요. 모든 사람이 같은 생활을 했다고 생각하지 않아요.'),
            h('fieldset', { class: 'inquiry-role-list' }, h('legend', {}, '어떤 사람의 입장에서 쓸까요?'),
                ...(activity.roles || []).map(role => {
                    const input = h('input', { type: 'radio', name: `inquiry-role-${activity.id}`, value: role.id, 'aria-label': role.label });
                    input.checked = editing.role === role.id;
                    roleInputs.set(role.id, input);
                    input.addEventListener('change', remember);
                    return h('label', { class: 'inquiry-role' }, input, h('span', {}, role.label));
                })), roleContext));
    }

    form.append(h('div', { class: 'card' },
        h('h3', { class: 'inquiry-section-title' }, activity.kind === 'diary' ? '2. 자료를 읽고 근거를 골라요' : '1. 자료를 읽고 근거를 골라요'),
        h('p', { class: 'inquiry-hint' }, `내 생각을 뒷받침할 자료를 ${activity.minEvidence}개 이상 골라요.`),
        h('div', { class: 'inquiry-sources' }, ...activity.sources.map(source => {
            const input = h('input', { type: 'checkbox', 'aria-label': `${source.title}을 근거로 선택` });
            input.checked = editing.evidence.includes(source.id);
            evidenceInputs.set(source.id, input);
            const card = h('article', { class: `inquiry-source${input.checked ? ' selected' : ''}` },
                h('h4', { class: 'inquiry-source-head' }, source.title),
                source.image ? h('img', { class: 'inquiry-source-image', src: source.image, alt: source.alt || source.title, loading: 'lazy' }) : null,
                h('p', { class: 'inquiry-source-body' }, source.text),
                source.caption ? h('p', { class: 'inquiry-source-caption' }, source.caption) : null,
                source.credit ? h('p', { class: 'inquiry-source-credit' }, '자료 출처: ', source.creditUrl
                    ? h('a', { href: source.creditUrl, target: '_blank', rel: 'noopener noreferrer' }, source.credit) : source.credit) : null,
                h('label', { class: 'inquiry-source-choice' }, input, h('span', {}, '이 자료를 근거로 선택')));
            input.addEventListener('change', () => { card.classList.toggle('selected', input.checked); remember(); });
            return card;
        }))));

    form.append(h('div', { class: 'card' },
        h('h3', { class: 'inquiry-section-title' }, activity.kind === 'diary' ? '3. 사실과 상상을 나누어 글을 써요' : '2. 자료를 바탕으로 내 생각을 써요'),
        h('p', { class: 'inquiry-hint' }, '답을 자동으로 채점하지 않아요. 고른 자료에서 어떤 근거를 찾았는지 드러나게 써 봐요.'),
        ...activity.prompts.map(prompt => {
            const id = `inquiry-${activity.id}-${prompt.id}`;
            const hintId = `${id}-hint`;
            const input = h('textarea', {
                id, class: 'inquiry-textarea', rows: prompt.id === 'diary' ? '8' : '4', maxlength: '2000',
                'aria-label': prompt.label, 'aria-describedby': hintId,
            });
            input.value = textOf(editing.answers[prompt.id]);
            inputs.set(prompt.id, input);
            input.addEventListener('input', remember);
            return h('div', { class: 'inquiry-prompt' },
                h('label', { class: 'inquiry-prompt-label', for: id }, prompt.label),
                h('p', { class: 'inquiry-hint', id: hintId }, prompt.hint || '자료의 근거와 내 생각을 구별하여 써 주세요.'), input);
        })));

    form.append(h('div', { class: 'card' },
        h('fieldset', { class: 'inquiry-checks' },
            h('legend', { class: 'inquiry-section-title' }, activity.kind === 'diary' ? '4. 내가 쓴 글을 다시 읽고 점검해요' : '3. 내 설명을 다시 읽고 점검해요'),
            ...activity.checks.map((check, index) => {
                const input = h('input', { type: 'checkbox', 'aria-label': check });
                input.checked = editing.checks[index];
                checkInputs.push(input);
                input.addEventListener('change', remember);
                return h('label', { class: 'inquiry-check' }, input, h('span', {}, check));
            }))),
        h('div', { class: 'card inquiry-actions' }, feedback,
            h('p', { class: 'inquiry-hint' }, '기록을 저장하면 이 기기의 나의 역사 노트에서 다시 보거나 고쳐 쓸 수 있어요.'),
            h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, '💾 탐구 기록 저장하기'),
            h('button', { type: 'button', class: 'btn btn-block', onclick: () => leave(listRoute) }, '← 활동 고르기')));

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || disposed || env.profile() !== owner) return;
        const state = collect();
        const missing = [...inputs.values()].find(input => !input.value.trim());
        if (activity.kind === 'diary' && !state.role) {
            feedback.textContent = '어떤 사람의 입장에서 쓸지 먼저 골라 주세요.';
            roleInputs.values().next().value?.focus();
            return;
        }
        if (state.evidence.length < activity.minEvidence) {
            feedback.textContent = `근거가 되는 자료를 ${activity.minEvidence}개 이상 골라 주세요.`;
            evidenceInputs.values().next().value?.focus();
            return;
        }
        if (missing) {
            feedback.textContent = '모든 질문에 내 생각을 써 주세요. 빈칸은 남겨 두지 않아요.';
            missing.focus();
            return;
        }
        if (state.checks.some(checked => !checked)) {
            feedback.textContent = '글을 다시 읽고 점검한 항목을 모두 확인해 주세요.';
            checkInputs.find(input => !input.checked)?.focus();
            return;
        }
        if (!canOpen(env, activity)) return;
        remember();
        const saved = {
            id: activity.id, at: Date.now(), evidence: state.evidence,
            answers: Object.fromEntries(Object.entries(state.answers).map(([id, answer]) => [id, filterProfanity(answer.trim()).slice(0, 2000)])),
            checks: state.checks,
        };
        if (state.role) saved.role = state.role;
        const previous = store[activity.id];
        store[activity.id] = saved;
        saving = true;
        form.setAttribute('aria-busy', 'true');
        const controls = [...form.querySelectorAll('input, textarea, button')];
        controls.forEach(control => { control.disabled = true; });
        let succeeded = false;
        pendingDraftSaves++;
        try { succeeded = await env.persist(true) === true; }
        catch (error) { succeeded = false; }
        finally { pendingDraftSaves--; }
        saving = false;
        form.removeAttribute('aria-busy');
        if (!succeeded) {
            if (env.profile() === owner && store[activity.id] === saved) {
                if (previous) store[activity.id] = previous;
                else delete store[activity.id];
            }
            controls.forEach(control => { control.disabled = false; });
            if (!disposed) feedback.textContent = '기록을 저장하지 못했어요. 쓴 내용은 이 화면에 남아 있어요. 다시 저장해 주세요.';
            return;
        }
        if (disposed || env.profile() !== owner) return;
        dirty = false;
        ownerDrafts.delete(activity.id);
        container.replaceChildren(
            h('div', { class: 'card' }, inquiryView(saved, activity, author)),
            h('div', { class: 'card inquiry-actions stack no-print' },
                h('p', {}, '📒 나의 역사 노트에 탐구 기록을 저장했어요.'),
                h('button', { type: 'button', class: 'btn btn-block', onclick: () => env.go({ screen: 'inquiry', unit, id: activity.id }) }, '✏️ 다시 쓰기'),
                h('button', { type: 'button', class: 'btn btn-block', onclick: () => env.go({ screen: 'notes' }) }, '📒 나의 역사 노트 보기'),
                h('button', { type: 'button', class: 'btn btn-block', onclick: () => window.print() }, '🖨️ 인쇄하기 / PDF로 저장'),
                h('button', { type: 'button', class: 'btn btn-block', onclick: () => env.go(listRoute) }, '← 활동 고르기')));
        scrollTop();
    });

    remember();
    container.append(
        h('div', { class: 'card inquiry-intro' },
            h('p', { class: 'inquiry-kind' }, kindLabel(activity)), h('h2', {}, activity.title),
            null, // 교과서 쪽수(pageRef)는 출판사마다 달라 학생 화면에 보이지 않음
            h('p', {}, activity.intro)), form);
    env.mount(env.topbar('🔎 자료 탐구 · 역사 일기', () => leave(listRoute), '← 활동 고르기'), container);
    scrollTop();
}
