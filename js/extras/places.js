// 🗺️ 문화유산 지도: 배운 유적이 있는 곳을 지도에서 눌러 보고, "지도에서 찾기" 문제를 풂
import { h, shuffle, scrollTop } from '../dom.js';
import { feedbackBox, nextButton, focusActivity } from '../activities/common.js';
import { extrasOf } from '../storage.js';
import { places, outline, jeju, dmzLine } from '../../content/places.js';

const QUIZ_COUNT = 5;
const PIN_HIT_RADIUS = 22;
const proj = ([lat, lon]) => [Math.round((lon - 124) * 80), Math.round((43.1 - lat) * 100)];

// env: { mount, topbar, go, profile, persist, toast, stationDone(id) }
const openItems = (env, place) => place.items.filter(it => env.stationDone(it.station));
const isOpen = (env, place) => openItems(env, place).length > 0;

export const placeCount = () => places.length;
export const visitedCount = profile => places.filter(p => extrasOf(profile).places.visited?.[p.id]).length;

// 지도 그림 (핀은 data-place 로 찾아 누를 수 있게 함)
function mapSvg(env, visited, selected) {
    const d = 'M' + outline.map(pt => proj(pt).join(',')).join(' L') + ' Z';
    const [jx, jy] = proj(jeju);
    const dmz = dmzLine.map(pt => proj(pt).join(',')).join(' ');
    const pins = places.map(place => {
        const [x, y] = proj(place.at);
        const state = !isOpen(env, place) ? 'locked' : place.id === selected ? 'selected' : visited[place.id] ? 'visited' : 'open';
        return `<g class="pin ${state}" data-place="${place.id}" transform="translate(${x} ${y})" tabindex="-1">`
            + '<circle class="dot" r="11"/>'
            + `<title>${place.name}</title></g>`;
    }).join('');
    return `<svg viewBox="0 0 560 1010" role="img" aria-label="문화유산 지도">
        <path d="${d}" class="land"/><ellipse cx="${jx}" cy="${jy}" rx="30" ry="17" class="land"/>
        <polyline points="${dmz}" class="dmz"/>${pins}</svg>`;
}

function mapBlock(env, visited, selected, onPick) {
    const box = h('div', { class: 'heritage-map', html: mapSvg(env, visited, selected) });
    const svg = box.querySelector('svg');
    svg.addEventListener('click', event => {
        const visiblePin = event.target.closest('[data-place]');
        if (visiblePin) return onPick(places.find(place => place.id === visiblePin.dataset.place));
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        // 가까운 점의 보이지 않는 클릭 영역이 겹쳐도, 실제로 누른 곳과 가장 가까운 핀을 고름.
        let nearest = null;
        let distance = PIN_HIT_RADIUS;
        places.forEach(place => {
            const [x, y] = proj(place.at);
            const next = Math.hypot(local.x - x, local.y - y);
            if (next <= distance) { nearest = place; distance = next; }
        });
        if (nearest) onPick(nearest);
    });
    return box;
}

function placeList(env, visited, selected, onPick) {
    return h('div', { class: 'place-list' }, ...places.map(place => {
        const open = isOpen(env, place);
        return h('button', {
            type: 'button', class: `place-chip ${!open ? 'locked' : place.id === selected ? 'selected' : visited[place.id] ? 'visited' : ''}`,
            onclick: () => onPick(place),
        }, open ? place.name : `🔒 ${place.name}`);
    }));
}

export function renderPlaces(env, stations, { selected = null, mode = 'explore' } = {}) {
    const store = extrasOf(env.profile()).places;
    if (!store.visited) store.visited = {};
    if (mode === 'quiz') return renderQuiz(env, stations);

    const pick = async place => {
        if (!isOpen(env, place)) {
            const first = stations.find(s => s.id === place.items[0].station);
            return env.toast(`🔒 「${first.name}」 정거장을 마치면 알 수 있어요.`);
        }
        store.visited[place.id] = true;
        if (await env.persist() === false) return;
        env.go({ screen: 'places', selected: place.id, keepScroll: true });
    };
    const place = places.find(p => p.id === selected);
    const panel = place ? h('div', { class: 'card place-panel' },
        h('h2', {}, `📍 ${place.name}`),
        ...place.items.map(it => {
            const st = stations.find(s => s.id === it.station);
            return env.stationDone(it.station)
                ? h('div', { class: 'note-line' }, h('b', {}, it.title), h('div', { class: 'small muted' }, `${st.emoji} ${st.name}`), h('div', {}, it.text))
                : h('div', { class: 'note-line locked-line' }, `🔒 「${st.name}」 정거장을 마치면 알 수 있어요.`);
        })) : h('div', { class: 'card place-panel' }, h('p', { class: 'muted' }, '👆 지도의 점이나 아래 이름을 눌러 보세요.'));

    // 휴대폰에서는 고른 곳의 설명이 지도 아래에 있으므로 그쪽으로 스크롤
    if (place) requestAnimationFrame(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    const openCount = places.filter(p => isOpen(env, p)).length;
    const quizReady = openCount >= 3;
    env.mount(
        env.topbar('🗺️ 문화유산 지도', () => env.go({ screen: 'map' }), '🗺️ 지도'),
        h('div', { class: 'card card-accent' },
            h('h2', {}, `가 본 곳 ${visitedCount(env.profile())} / ${places.length}`),
            h('p', { class: 'small muted', style: 'margin:6px 0 10px' }, '정거장에서 배운 유적이 있는 곳이 지도에 나타나요. 점을 눌러 무엇을 배웠는지 다시 살펴보세요.'),
            h('button', {
                class: 'btn btn-primary btn-small', type: 'button',
                onclick: () => (quizReady ? env.go({ screen: 'places', mode: 'quiz' }) : env.toast('🔒 지도에 세 곳 이상 나타나면 열려요. 정거장을 더 마쳐 보세요.')),
            }, `🎯 지도에서 찾기${store.quizBest != null ? ` (최고 ${store.quizBest}/${store.quizTotal || QUIZ_COUNT})` : ''}`)),
        h('div', { class: 'map-layout' },
            h('div', { class: 'card map-card' }, mapBlock(env, store.visited, selected, pick), legend()),
            h('div', { class: 'map-side' }, panel, h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:8px' }, '곳 이름으로 찾기'), placeList(env, store.visited, selected, pick)))),
    );
}

function legend() {
    return h('div', { class: 'map-legend small' },
        h('span', {}, h('i', { class: 'lg open' }), '배운 곳'),
        h('span', {}, h('i', { class: 'lg visited' }), '가 본 곳'),
        h('span', {}, h('i', { class: 'lg locked' }), '아직 못 배운 곳'),
        h('span', {}, h('i', { class: 'lg dmz' }), '휴전선'));
}

function renderQuiz(env, stations) {
    const store = extrasOf(env.profile()).places;
    // 열린 곳마다 한 문제씩, 서로 다른 곳에서 QUIZ_COUNT 개
    const pool = shuffle(places.filter(p => isOpen(env, p)).map(p => ({ place: p, item: shuffle(openItems(env, p))[0] })));
    const questions = pool.slice(0, QUIZ_COUNT);
    let index = 0;
    let score = 0;
    let wrongThis = 0;
    const content = h('div');
    env.mount(env.topbar('🎯 지도에서 찾기', () => env.go({ screen: 'places' }), '← 지도'), content);

    function show() {
        const q = questions[index];
        wrongThis = 0;
        let solved = false;
        const fb = h('div', { 'aria-live': 'polite' });
        const after = h('div');
        const pick = place => {
            if (solved) return;
            if (!isOpen(env, place)) return env.toast('🔒 아직 배우지 않은 곳이에요.');
            if (place.id === q.place.id) {
                solved = true;
                if (wrongThis === 0) score++;
                fb.replaceChildren(feedbackBox('good', `✅ 맞아요, ${q.place.name}${ieyo(q.place.name)}`, q.item.text));
                const last = index === questions.length - 1;
                after.append(nextButton(last ? '결과 보기 ▶' : '다음 문제 ▶', () => { if (last) finish(); else { index++; show(); } }));
                mapWrap.replaceChildren(mapBlock(env, {}, q.place.id, () => {}));
                return;
            }
            wrongThis++;
            fb.replaceChildren(feedbackBox('bad', `🤔 그곳은 ${place.name}${ieyo(place.name)}`, wrongThis >= 2 ? `힌트: ${hintFor(q.place)}` : '다시 찾아봐요.'));
        };
        const mapWrap = h('div', {}, mapBlock(env, {}, null, pick));
        content.replaceChildren(
            h('div', { class: 'card quiz-q' },
                h('div', { class: 'row' }, h('span', { class: 'counter' }, `문제 ${index + 1} / ${questions.length}`)),
                h('h2', { style: 'margin-top:6px' }, `📍 ${q.item.ask}은(는) 어디일까요?`.replace(/([가-힣」])은\(는\)/, (m, ch) => `${ch}${ch === '」' || hasBatchim(ch) ? '은' : '는'}`)),
                h('p', { class: 'small muted' }, '지도의 점이나 아래 이름을 눌러 보세요.'),
                fb, after),
            h('div', { class: 'map-layout' },
                h('div', { class: 'card map-card' }, mapWrap),
                h('div', { class: 'map-side' }, h('div', { class: 'card' }, placeList(env, {}, null, pick)))),
        );
        scrollTop();
        focusActivity(content);
    }

    async function finish() {
        // 열린 곳이 적으면 문제 수도 적으므로, 맞힌 비율이 가장 높았던 기록을 문제 수와 함께 남김
        const total = questions.length;
        if (store.quizBest == null || score / total > store.quizBest / (store.quizTotal || QUIZ_COUNT)) {
            store.quizBest = score;
            store.quizTotal = total;
        }
        if (await env.persist() === false) return;
        content.replaceChildren(h('div', { class: 'card center' },
            h('div', { class: 'stamp' }, h('span', { class: 'big' }, '🎯'), '지도 탐험가'),
            h('p', {}, `${questions.length}문제 가운데 ${score}문제를 한 번에 찾았어요.`),
            nextButton('🔁 다시 풀기', () => env.go({ screen: 'places', mode: 'quiz' }), false),
            nextButton('🗺️ 문화유산 지도로', () => env.go({ screen: 'places' }))));
        scrollTop();
        focusActivity(content);
    }

    show();
}

// 두 번 틀리면 방향을 알려 줌
function hintFor(place) {
    const [lat, lon] = place.at;
    const ns = lat >= 38.3 ? '북쪽' : lat <= 35.6 ? '남쪽' : '가운데';
    const ew = lon >= 128.3 ? '동쪽' : lon <= 126.8 ? '서쪽' : '';
    return `우리나라 ${ns}${ew ? `, ${ew}` : ''}에 있어요.`;
}

const ieyo = name => (hasBatchim(name.slice(-1)) ? '이에요' : '예요');

function hasBatchim(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
}
