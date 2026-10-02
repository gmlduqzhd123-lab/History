// ⑤ 나의 한 줄 정리: 문장 틀의 빈칸을 채우면 핵심어가 들어갔는지 바로 알려 줌
import { h, scrollTop, toast } from '../dom.js';
import { filterProfanity } from '../filter.js';
import { feedbackBox, nextButton } from './common.js';
import { tone } from '../tone.js';

// 띄어쓰기를 무시하고, 가운뎃점(·)을 ㆍ . ‧ • ・ 로 입력해도 같은 것으로 봄 (예: 3ㆍ1 운동)
const normalize = s => s.replace(/\s+/g, '').replace(/[ㆍ.‧•・･]/g, '·');

// 짧은 명사는 다른 단어의 일부(당근, 식당, 철학)가 아니라 그 말 자체를 확인해요.
// 조사 뒤에는 띄어쓰기를 하지 않아도 인정하고, 긴 핵심어·어간은 기존처럼 확인해요.
function hasKeyword(value, keyword, wholeKeywords = []) {
    if (!wholeKeywords.includes(keyword)) return normalize(value).includes(normalize(keyword));
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const last = keyword.charCodeAt(keyword.length - 1);
    const finalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
    const particles = finalConsonant ? '으로|과|은|이|을' : '로|와|는|가|를';
    const endings = `${particles}|에서|에게|부터|까지|처럼|보다|하고|랑|의|에|도|만`;
    return new RegExp(`(^|[^가-힣A-Za-z0-9])${escaped}(?=$|[^가-힣A-Za-z0-9]|${endings})`, 'u').test(value);
}

// keywords는 대체 가능한 표현(any), keywordMode: 'all'은 모두 필요한 사실,
// keywordGroups는 각 사실의 대체 표현 묶음이에요(모든 묶음에서 하나씩 필요).
export function evaluateSummary(spec, value) {
    const v = value.trim();
    if (spec.free) return v.length >= 2;
    const matches = keyword => hasKeyword(v, keyword, spec.wholeKeywords);
    if (spec.keywordGroups) return spec.keywordGroups.every(group => group.some(matches));
    return spec.keywordMode === 'all' ? spec.keywords.every(matches) : spec.keywords.some(matches);
}

export function renderSummary(root, stage, ctx) {
    let checks = 0;
    let saving = false;
    const blanks = []; // { spec, input, hintEl }
    let lastFocused = null;

    const sentences = stage.frames.map(frame => {
        const p = h('p', { class: 'frame-sentence' });
        frame.parts.forEach(part => {
            if (typeof part === 'string') { p.append(part); return; }
            const input = h('input', {
                class: 'blank', type: 'text', maxlength: '60', autocomplete: 'off',
                'aria-label': part.free ? '내 생각 쓰기' : '빈칸 채우기',
                placeholder: part.free ? '내 생각' : '빈칸',
            });
            const hintEl = h('span', { class: 'blank-hint', 'aria-live': 'polite' });
            input.addEventListener('input', () => { input.classList.remove('ok'); hintEl.textContent = ''; hintEl.classList.remove('ok'); });
            input.addEventListener('focus', () => { lastFocused = input; });
            blanks.push({ spec: part, input, hintEl });
            p.append(h('span', { style: 'display:inline-block;max-width:100%' }, input, hintEl));
        });
        return p;
    });

    const bankSlot = h('div');
    const resultSlot = h('div');
    const checkBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:16px' }, '✔ 확인하기');

    function assembled(frame) {
        return frame.parts.map(part => {
            if (typeof part === 'string') return part;
            return blanks.find(b => b.spec === part).input.value.trim();
        }).join('').replace(/\s+/g, ' ').trim();
    }

    function insertWord(word) {
        const target = lastFocused && !blanks.find(b => b.input === lastFocused)?.spec.free
            ? lastFocused
            : blanks.find(b => !b.spec.free && !b.input.classList.contains('ok'))?.input;
        if (!target) return;
        target.value = word;
        target.dispatchEvent(new Event('input'));
        target.focus();
    }

    async function save() {
        if (saving) return;
        saving = true;
        const buttons = [...resultSlot.querySelectorAll('button')];
        buttons.forEach(button => { button.disabled = true; });
        try {
            ctx.record.notes = stage.frames.map(f => filterProfanity(assembled(f)));
            if (await ctx.save() === false) return;
            await ctx.done();
        } finally {
            saving = false;
            buttons.forEach(button => { if (button.isConnected) button.disabled = false; });
        }
    }

    checkBtn.addEventListener('click', () => {
        checks++;
        let allOk = true;
        blanks.forEach(({ spec, input, hintEl }) => {
            const ok = evaluateSummary(spec, input.value);
            input.classList.toggle('ok', ok);
            hintEl.classList.toggle('ok', ok);
            if (ok) hintEl.textContent = spec.free ? '✅ 좋아요' : '✅ 핵심어가 들어갔어요';
            else hintEl.textContent = spec.free ? '✍️ 두 글자 이상 써 주세요' : `💡 ${spec.hint}`;
            if (!ok) allOk = false;
        });

        resultSlot.replaceChildren();
        if (allOk) {
            checkBtn.classList.add('hidden');
            // 확인이 끝난 뒤 빈칸을 지우거나 바꿔 저장하지 않도록 잠금
            blanks.forEach(({ input }) => { input.readOnly = true; });
            bankSlot.replaceChildren();
            resultSlot.append(
                feedbackBox('good', tone('summaryDone'), '나의 역사 노트에 저장할게요.'),
                h('div', { class: 'card', style: 'margin-top:12px' }, ...stage.frames.map(f => h('div', { class: 'note-line' }, filterProfanity(assembled(f))))),
                nextButton('💾 저장하고 퀘스트 마치기', save),
            );
            return;
        }

        // 한 번 틀리면 낱말 상자, 두 번 틀리면 예시 답과 "이대로 저장" 제공
        const bankWords = stage.frames.flatMap(f => f.wordBank || []);
        if (checks >= 1 && bankWords.length && !bankSlot.firstChild) {
            bankSlot.append(h('div', { class: 'card card-accent', style: 'margin-top:12px' },
                h('div', { class: 'small', style: 'margin-bottom:6px' }, '🧺 낱말 상자 — 빈칸을 누른 뒤 낱말을 누르면 들어가요'),
                h('div', { class: 'word-bank' }, ...bankWords.map(w => h('button', { type: 'button', onclick: () => insertWord(w) }, w)))));
        }
        if (checks >= 2) {
            const examples = stage.frames.filter(f => f.example);
            resultSlot.append(h('div', {},
                examples.length ? feedbackBox('info', '👀 이렇게 써 볼 수도 있어요', h('div', {}, ...examples.map(f => h('p', {}, f.example)))) : null,
                nextButton('내가 쓴 대로 저장하기', () => {
                    if (blanks.some(b => !b.input.value.trim())) toast('✍️ 빈칸을 모두 채워 주세요');
                    else save();
                }, false),
            ));
        }
    });

    root.replaceChildren(h('div', { class: 'card' },
        h('p', { class: 'muted small' }, '빈칸에 알맞은 말을 써서 문장을 완성해 보세요.'),
        ...sentences,
        bankSlot,
        checkBtn,
        resultSlot,
    ));
    scrollTop();
}
