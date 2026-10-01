// 🧑‍🤝‍🧑 인물 도감: 정거장을 마치면 그 시대 인물이 "나는 누구일까요?" 단서를 들려주고, 맞히면 인물 카드를 모음
import { h, scrollTop, modal } from '../dom.js';
import { retryChoice, nextButton, feedbackBox } from '../activities/common.js';
import { speakButton } from '../tts.js';
import { setCalm } from '../tone.js';
import { extrasOf } from '../storage.js';
import { people } from '../../content/people.js';

export const peopleCount = () => people.length;
export const collectedCount = profile => people.filter(p => extrasOf(profile).people[p.id]).length;

// env: { mount, topbar, go, profile, persist, toast, stationDone(stationId) → 그 정거장을 마쳤는지 }
function stateOf(env, person) {
    if (extrasOf(env.profile()).people[person.id]) return 'collected';
    return env.stationDone(person.station) ? 'open' : 'locked';
}

export function renderPeople(env, stations) {
    const got = collectedCount(env.profile());
    const grid = h('div', { class: 'people-grid' }, ...people.map(person => {
        const state = stateOf(env, person);
        const station = stations.find(s => s.id === person.station);
        const btn = h('button', { class: `person-card ${state}`, type: 'button' },
            h('span', { class: 'pc-emoji', 'aria-hidden': 'true' }, state === 'collected' ? person.emoji : state === 'open' ? '❓' : '🔒'),
            h('span', { class: 'pc-name' }, state === 'collected' ? person.name : state === 'open' ? '누구일까요?' : '???'),
            h('span', { class: 'pc-station' }, `${station.emoji} ${station.name}`));
        btn.addEventListener('click', () => {
            if (state === 'collected') return showCard(person, station);
            if (state === 'open') return env.go({ screen: 'person', id: person.id });
            env.toast(`🔒 「${station.name}」 정거장을 마치면 만날 수 있어요.`);
        });
        return btn;
    }));
    env.mount(
        env.topbar('🧑‍🤝‍🧑 인물 도감', () => env.go({ screen: 'map' }), '🗺️ 지도'),
        h('div', { class: 'card card-accent' },
            h('h2', {}, `인물 카드 ${got} / ${people.length}`),
            h('p', { class: 'small muted', style: 'margin-top:6px' }, '정거장을 마치면 그 시대 인물이 나타나요. ❓ 카드를 눌러 단서를 듣고 누구인지 맞혀 보세요.')),
        h('div', { class: 'card' }, grid),
    );
    scrollTop();
}

function showCard(person, station) {
    const close = modal(
        h('div', { class: 'center' },
            h('div', { style: 'font-size:56px' }, person.emoji),
            h('h2', {}, person.name),
            h('p', { class: 'small muted' }, `${station.emoji} ${station.name}`)),
        ...person.clues.map(c => h('div', { class: 'note-line' }, `“${c}”`)),
        feedbackBox('gold', '📌 더 알아보기', person.fact),
        nextButton('닫기', () => close()),
    );
}

export function renderPerson(env, stations, id) {
    const person = people.find(p => p.id === id);
    if (!person || stateOf(env, person) === 'locked') return env.go({ screen: 'people' });
    const station = stations.find(s => s.id === person.station);
    setCalm(station.quest?.calm);
    let shown = 1;
    const bubble = h('div', { class: 'speech' });
    const showClues = () => bubble.replaceChildren(...person.clues.slice(0, shown).map(c => h('p', {}, c)));
    showClues();
    const moreBtn = h('button', { class: 'btn btn-small', type: 'button' });
    const updateMore = () => {
        const left = person.clues.length - shown;
        moreBtn.textContent = left ? `💬 다음 단서 듣기 (${left}개 남음)` : '💬 단서를 모두 들었어요';
        moreBtn.disabled = !left;
    };
    updateMore();
    moreBtn.addEventListener('click', () => { if (shown < person.clues.length) { shown++; showClues(); updateMore(); } });

    const portrait = h('div', { class: 'person-portrait', 'aria-hidden': 'true' }, '❓');
    const title = h('h2', { class: 'center' }, '나는 누구일까요?');
    const after = h('div');
    const quiz = retryChoice({
        question: '단서를 듣고 이 인물이 누구인지 골라 보세요.',
        choices: person.choices.map((name, i) => ({
            t: name, correct: i === 0,
            fb: i === 0 ? person.fact : '단서와 맞지 않아요. 단서를 한 번 더 읽어 보세요.',
        })),
        onSolved: () => {
            const firstTime = !extrasOf(env.profile()).people[person.id];
            extrasOf(env.profile()).people[person.id] = true;
            env.persist();
            portrait.textContent = person.emoji;
            portrait.classList.add('revealed');
            title.textContent = `나는 ${person.name}${hasBatchim(person.name.slice(-1)) ? '이에요' : '예요'}`;
            shown = person.clues.length; showClues(); updateMore(); moreBtn.classList.add('hidden');
            const next = people.find(p => stateOf(env, p) === 'open');
            // h() 로 감싸 null 을 건너뜀 (append 는 null 을 "null" 글자로 넣어 버림)
            after.append(h('div', {},
                firstTime ? h('p', { class: 'center', style: 'margin-top:12px' }, `${station.quest?.calm ? '인물 카드에 담았어요.' : '🧑‍🤝‍🧑 인물 카드를 모았어요!'} (${collectedCount(env.profile())} / ${people.length})`) : null,
                next ? nextButton(`다음 인물 만나기 ▶`, () => env.go({ screen: 'person', id: next.id })) : null,
                !next && collectedCount(env.profile()) === people.length ? h('p', { class: 'center', style: 'margin-top:8px' }, '20명의 인물을 모두 만나 인물 도감을 완성했어요.') : null,
                nextButton('🧑‍🤝‍🧑 인물 도감으로', () => env.go({ screen: 'people' }), !next)));
        },
    });
    env.mount(
        env.topbar('🧑‍🤝‍🧑 나는 누구일까요?', () => env.go({ screen: 'people' }), '← 도감'),
        h('div', { class: 'card' },
            h('p', { class: 'small muted center' }, `${station.emoji} ${station.name}에서 온 인물`),
            portrait, title, bubble,
            h('div', { class: 'row', style: 'margin-top:10px; justify-content:center' }, moreBtn,
                speakButton(() => person.clues.slice(0, shown).join(' '), '단서 읽기'))),
        h('div', { class: 'card' }, quiz, after),
    );
    scrollTop();
}

// 받침이 있는 글자인지 (이에요/예요 고르기)
function hasBatchim(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
}
