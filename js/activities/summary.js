// ⑤ 나의 한 줄 정리: 문장 틀의 빈칸을 채우면 핵심어가 들어갔는지 바로 알려 줌
import { h, scrollTop, toast } from '../dom.js';
import { filterProfanity } from '../filter.js';
import { feedbackBox, nextButton } from './common.js';
import { tone } from '../tone.js';

// 띄어쓰기를 무시하고, 가운뎃점(·)을 ㆍ . ‧ • ・ 로 입력해도 같은 것으로 봄 (예: 3ㆍ1 운동)
const normalize = s => s.replace(/\s+/g, '').replace(/[ㆍ.‧•・･]/g, '·');

export function renderSummary(root, stage, ctx) {
    let checks = 0;
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

    function evaluate(spec, value) {
        const v = value.trim();
        if (spec.free) return v.length >= 2;
        const nv = normalize(v);
        return spec.keywords.some(k => nv.includes(normalize(k)));
    }

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

    function save() {
        ctx.record.notes = stage.frames.map(f => filterProfanity(assembled(f)));
        ctx.save();
        ctx.done();
    }

    checkBtn.addEventListener('click', () => {
        checks++;
        let allOk = true;
        blanks.forEach(({ spec, input, hintEl }) => {
            const ok = evaluate(spec, input.value);
            input.classList.toggle('ok', ok);
            hintEl.classList.toggle('ok', ok);
            if (ok) hintEl.textContent = spec.free ? '✅ 좋아요' : '✅ 핵심어가 들어갔어요';
            else hintEl.textContent = spec.free ? '✍️ 두 글자 이상 써 주세요' : `💡 ${spec.hint}`;
            if (!ok) allOk = false;
        });

        resultSlot.replaceChildren();
        if (allOk) {
            checkBtn.classList.add('hidden');
            resultSlot.append(
                feedbackBox('good', tone('summaryDone'), '나의 역사 노트에 저장할게요.'),
                h('div', { class: 'card', style: 'margin-top:12px' }, ...stage.frames.map(f => h('div', { class: 'note-line' }, assembled(f)))),
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
