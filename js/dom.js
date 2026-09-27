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

export function modal(...children) {
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, ...children);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    back.append(box);
    document.body.append(back);
    return close;
}

export function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }
