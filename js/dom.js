// 작은 DOM 도우미: 문자열 innerHTML 대신 요소를 직접 만들어 학생 입력이 HTML로 해석되지 않게 함
export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'style') el.style.cssText = value;
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (key === 'html') el.innerHTML = value; // 앱이 만든 믿을 수 있는 문자열(그림 SVG 등)에만 사용
        else el.setAttribute(key, value === true ? '' : value);
    }
    append(el, children);
    return el;
}

function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

// "**굵게**" 표시를 <b>로 바꿔 핵심어를 강조 (나머지는 글자 그대로)
export function rich(text) {
    const frag = document.createDocumentFragment();
    String(text).split(/(\*\*[^*]+\*\*)/g).forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) frag.append(h('b', {}, part.slice(2, -2)));
        else if (part) frag.append(document.createTextNode(part));
    });
    return frag;
}

export const plain = text => String(text).replace(/\*\*/g, '');

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function toast(message) {
    const el = h('div', { class: 'toast', role: 'status' }, message);
    document.body.append(el);
    setTimeout(() => el.remove(), 2200);
}

const openModals = [];
let dialogNumber = 0;

export function modal(...children) {
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, ...children);
    const opener = document.activeElement;
    const title = box.querySelector('h2, h3');
    if (title) {
        if (!title.id) title.id = `history-dialog-${++dialogNumber}`;
        box.setAttribute('aria-labelledby', title.id);
    } else box.setAttribute('aria-label', '안내');
    box.tabIndex = -1;
    const background = [...document.body.children].map(el => ({
        el, hidden: el.getAttribute('aria-hidden'), inert: el.inert,
    }));
    background.forEach(({ el }) => {
        el.setAttribute('aria-hidden', 'true');
        if ('inert' in el) el.inert = true;
    });
    const focusables = () => [...box.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
        .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const focusFirst = () => (focusables()[0] || box).focus({ preventScroll: true });
    let closed = false;
    const isTop = () => openModals[openModals.length - 1]?.box === box;
    const onKey = e => {
        if (!isTop()) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') {
            const items = focusables();
            const first = items[0], last = items[items.length - 1];
            if (!items.length) { e.preventDefault(); box.focus(); }
            else if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
                e.preventDefault(); first.focus();
            }
        }
    };
    // inert가 없는 지원 브라우저에서도 팝업 밖으로 초점이 이동하지 않게 함.
    const onFocus = e => { if (isTop() && !box.contains(e.target)) focusFirst(); };
    const close = () => {
        if (closed) return;
        closed = true;
        const entry = openModals.findIndex(item => item.box === box);
        if (entry !== -1) [...openModals.slice(entry + 1)].reverse().forEach(item => item.close());
        if (entry !== -1) openModals.splice(entry, 1);
        back.remove();
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('focusin', onFocus);
        background.forEach(({ el, hidden, inert }) => {
            if (hidden === null) el.removeAttribute('aria-hidden');
            else el.setAttribute('aria-hidden', hidden);
            if ('inert' in el) el.inert = inert;
        });
        // 창을 연 버튼이 아직 화면에 있으면 키보드 초점을 되돌려 줌
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
    back.addEventListener('click', e => { if (isTop() && e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    back.append(box);
    document.body.append(back);
    openModals.push({ box, close });
    // 키보드·스크린 리더 사용자가 바로 창 안에서 시작하도록 첫 버튼에 초점
    focusFirst();
    return close;
}

// 다른 탭에서 기록이 바뀌면 이전 기록을 조작하는 팝업을 모두 닫음.
modal.closeAll = () => [...openModals].reverse().forEach(({ close }) => close());

export function scrollTop() { window.scrollTo(0, 0); }
