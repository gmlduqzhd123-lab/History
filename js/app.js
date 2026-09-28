// 역사 탐험 퀘스트 — 화면 전환과 학습 기록 관리
import { h, rich, clear, modal, toast, scrollTop } from './dom.js';
import { loadData, saveData, newProfile, questRecord } from './storage.js';
import { encodeProgress, decodeProgress } from './code.js';
import { stopSpeaking } from './tts.js';
import { art } from './art.js';
import { setCalm, tone } from './tone.js';
import { units, stations, questOrder, avatars } from '../content/quests.js';
import { renderDetective } from './activities/detective.js';
import { renderReading } from './activities/reading.js';
import { renderAdventure } from './activities/adventure.js';
import { renderMastery } from './activities/mastery.js';
import { renderSummary } from './activities/summary.js';

const renderers = {
    detective: renderDetective,
    reading: renderReading,
    adventure: renderAdventure,
    mastery: renderMastery,
    summary: renderSummary,
};

const MAX_NUMBER = 40;
const app = document.getElementById('app');
const data = loadData();
// 선생님용: 주소 끝에 ?open=all 을 붙이면 준비된 퀘스트를 순서와 관계없이 모두 열 수 있음
const openAll = new URLSearchParams(location.search).get('open') === 'all';

let ui = { screen: 'welcome' };

// null·false 는 건너뛰고 붙임 (append는 null을 "null" 글자로 넣어 버림)
function mount(...nodes) { app.append(...nodes.filter(n => n !== null && n !== undefined && n !== false)); }

function profile() { return data.current != null ? data.profiles[data.current] : null; }
function persist() { if (!saveData(data)) toast('⚠️ 이 기기에 저장하지 못했어요. 이어하기 코드를 적어 두세요.'); }

function go(next) {
    stopSpeaking();
    ui = next;
    render();
    scrollTop();
}

function render() {
    clear(app);
    setCalm(false);
    if (!profile()) ui = ui.screen === 'register' || ui.screen === 'code' ? ui : { screen: 'welcome' };
    ({ welcome: renderWelcome, register: renderRegister, code: renderCodeEntry, map: renderMap, quest: renderQuest, notes: renderNotes }[ui.screen] || renderWelcome)();
}

// ---------- 퀘스트 상태 ----------
function stationState(station, index) {
    if (!station.quest) return 'soon';
    const rec = profile().quests[station.id];
    if (rec?.done) return 'done';
    if (openAll || index === 0) return 'open';
    const prev = stations[index - 1];
    return profile().quests[prev.id]?.done ? 'open' : 'locked';
}

// ---------- 시작 화면 ----------
function renderWelcome() {
    const saved = Object.values(data.profiles).sort((a, b) => a.number - b.number);
    mount(
        h('div', { class: 'hero' },
            h('div', { class: 'logo', 'aria-hidden': 'true' }, '🧭'),
            h('h1', {}, '역사 탐험 퀘스트'),
            h('p', { class: 'muted' }, '5학년 2학기 사회 · 유물과 이야기로 떠나는 시간 여행')),
        saved.length ? h('div', { class: 'card' },
            h('h2', { style: 'margin-bottom:12px' }, '이 기기의 탐험가'),
            h('div', { class: 'explorer-list' }, ...saved.map(p => h('button', {
                type: 'button',
                onclick: () => { data.current = p.number; persist(); go({ screen: 'map' }); },
            }, h('span', { class: 'av' }, p.avatar), `${p.number}번`)))) : null,
        h('div', { class: 'card stack' },
            h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => go({ screen: 'register' }) }, '🙋 새 탐험가로 시작하기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'code' }) }, '💾 이어하기 코드로 계속하기')),
    );
}

function renderRegister() {
    let number = null;
    let avatar = avatars[0];
    const numGrid = h('div', { class: 'num-grid' });
    for (let n = 1; n <= MAX_NUMBER; n++) {
        numGrid.append(h('button', {
            type: 'button', 'aria-pressed': 'false',
            onclick: e => {
                number = n;
                [...numGrid.children].forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
                e.currentTarget.classList.add('on');
                e.currentTarget.setAttribute('aria-pressed', 'true');
                startBtn.disabled = false;
            },
        }, n));
    }
    const avGrid = h('div', { class: 'avatar-grid' }, ...avatars.map((a, i) => h('button', {
        type: 'button', class: i === 0 ? 'on' : '', 'aria-label': `캐릭터 ${a}`,
        onclick: e => {
            avatar = a;
            [...avGrid.children].forEach(b => b.classList.remove('on'));
            e.currentTarget.classList.add('on');
        },
    }, a)));
    const startBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true }, '🚀 탐험 시작!');
    startBtn.addEventListener('click', () => {
        if (!number) return;
        const existing = data.profiles[number];
        if (existing && !confirm(`${number}번 탐험가가 이미 이 기기에 있어요.\n그 기록으로 이어서 할까요? (취소를 누르면 번호를 다시 고를 수 있어요)`)) return;
        if (!existing) data.profiles[number] = newProfile(number, avatar);
        data.current = number;
        persist();
        go({ screen: 'map' });
        if (!existing) showGuide();
    });
    mount(
        topbar('🙋 새 탐험가', () => go({ screen: 'welcome' })),
        h('div', { class: 'card' }, h('h2', { style: 'margin-bottom:6px' }, '1. 내 번호를 골라요'),
            h('p', { class: 'muted small' }, '이름 대신 우리 반 번호를 써요.'), numGrid),
        h('div', { class: 'card' }, h('h2', { style: 'margin-bottom:12px' }, '2. 탐험가 캐릭터를 골라요'), avGrid),
        h('div', { style: 'margin-top:16px' }, startBtn),
    );
}

function renderCodeEntry() {
    const input = h('input', { class: 'code-input', type: 'text', placeholder: 'XXXXX-XXXXX', maxlength: '14', autocomplete: 'off', 'aria-label': '이어하기 코드' });
    const msg = h('div');
    const submit = () => {
        const result = decodeProgress(input.value, questOrder, avatars);
        if (!result) {
            msg.replaceChildren(h('div', { class: 'feedback bad' }, '코드가 맞지 않아요. 글자를 다시 확인해 주세요.'));
            return;
        }
        const existing = data.profiles[result.number];
        const merged = existing || newProfile(result.number, result.avatar);
        merged.avatar = result.avatar;
        // 코드에 담긴 진도가 더 앞서 있을 때만 덮어씀
        Object.entries(result.quests).forEach(([id, q]) => {
            const cur = merged.quests[id];
            if (!cur || (!cur.done && (q.done || q.stage > cur.stage))) merged.quests[id] = { ...q, notes: cur?.notes || [] };
        });
        data.profiles[result.number] = merged;
        data.current = result.number;
        persist();
        toast(`${result.avatar} ${result.number}번 탐험가, 다시 만나서 반가워요!`);
        go({ screen: 'map' });
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    mount(
        topbar('💾 이어하기', () => go({ screen: 'welcome' })),
        h('div', { class: 'card stack' },
            h('p', {}, '다른 기기에서 받은 ', h('b', {}, '이어하기 코드'), '를 입력하세요.'),
            input,
            h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: submit }, '계속하기'),
            msg),
    );
    input.focus();
}

// ---------- 공통 상단 막대 ----------
function topbar(title, onBack, backLabel = '← 뒤로') {
    const p = profile();
    return h('div', { class: 'topbar' },
        onBack ? h('button', { class: 'btn btn-small', type: 'button', onclick: onBack }, backLabel) : null,
        h('div', { class: 'title' }, title),
        p ? h('button', { class: 'chip', type: 'button', onclick: showMenu, 'aria-label': '탐험가 메뉴' }, p.avatar, ` ${p.number}번`) : null,
    );
}

function showMenu() {
    const p = profile();
    const close = modal(
        h('h2', { style: 'margin-bottom:12px' }, `${p.avatar} ${p.number}번 탐험가`),
        h('div', { class: 'stack' },
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); showCode(); } }, '💾 이어하기 코드 보기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); go({ screen: 'notes' }); } }, '📒 나의 역사 노트'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); showGuide(); } }, '❓ 탐험 방법'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); data.current = null; persist(); go({ screen: 'welcome' }); } }, '🔄 다른 탐험가로 바꾸기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => close() }, '닫기')),
    );
}

function showCode() {
    const code = encodeProgress(profile(), questOrder, avatars);
    const close = modal(
        h('h2', {}, '💾 이어하기 코드'),
        h('p', { class: 'muted small', style: 'margin-top:6px' }, '다른 기기나 다음 시간에 이 코드를 입력하면 지금까지의 진도를 이어서 할 수 있어요. 공책에 적어 두세요!'),
        h('div', { class: 'code-box' }, code),
        h('p', { class: 'small muted', style: 'margin-top:10px' }, '※ 한 줄 정리 글은 코드에 담기지 않고 이 기기에만 남아요.'),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => close() }, '다 적었어요'),
    );
}

function showGuide() {
    const steps = [
        ['🔍', '유물 탐정', '가려진 유물을 단서로 추리해요.'],
        ['📖', '이야기 카드', '짧은 글을 읽고 확인 문제를 풀어요.'],
        ['🎲', '생활 체험', '그 시대 아이가 되어 선택해요.'],
        ['🏆', '개념 도전', '4문제 이상 맞히면 도장!'],
        ['📝', '한 줄 정리', '배운 것을 내 말로 정리해요.'],
    ];
    const close = modal(
        h('h2', {}, '🧭 이렇게 탐험해요'),
        h('p', { class: 'muted small', style: 'margin:6px 0 10px' }, '정거장 하나는 다섯 단계로 되어 있어요. 내 속도에 맞춰 차근차근!'),
        ...steps.map(([e, t, d]) => h('div', { class: 'note-line' }, h('b', {}, `${e} ${t}`), ` — ${d}`)),
        h('div', { class: 'feedback info' },
            h('div', {}, '🙋 막히면 ', h('b', {}, '단서·힌트 버튼'), '을 눌러요.'),
            h('div', {}, '🔊 글이 길면 ', h('b', {}, '읽어 주기'), '를 눌러요.'),
            h('div', {}, '💾 수업이 끝나면 ', h('b', {}, '이어하기 코드'), '를 적어 둬요.')),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:14px', onclick: () => close() }, '알겠어요!'),
    );
}

// ---------- 탐험 지도 ----------
function renderMap() {
    const p = profile();
    const doneCount = stations.filter(s => p.quests[s.id]?.done).length;
    mount(
        topbar('🧭 역사 탐험 퀘스트'),
        h('div', { class: 'card card-accent' },
            h('h2', {}, `안녕, ${p.number}번 탐험가! ${p.avatar}`),
            h('p', { style: 'margin:6px 0 12px' }, doneCount ? `지금까지 도장 ${doneCount}개를 모았어요. 다음 정거장으로 떠나 볼까요?` : '첫 번째 정거장부터 시간 여행을 떠나 볼까요?'),
            h('div', { class: 'row' },
                h('button', { class: 'btn btn-small', type: 'button', onclick: () => go({ screen: 'notes' }) }, '📒 나의 역사 노트'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: showCode }, '💾 이어하기 코드'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: showGuide }, '❓ 탐험 방법'))),
        ...units.map(unit => h('section', { class: 'unit' },
            h('h2', { class: 'unit-title' }, `📚 ${unit.title}`),
            h('div', { class: 'path' }, ...unit.stations.map(station => stationButton(station)))),
        ),
    );
}

function stationButton(station) {
    const index = stations.indexOf(station);
    const state = stationState(station, index);
    const rec = profile().quests[station.id];
    const total = station.quest?.stages.length || 5;
    const label = { done: '🏅 완료', open: rec?.stage ? '▶ 이어서' : '▶ 출발', locked: '🔒', soon: '준비 중' }[state];
    const btn = h('button', { class: `station ${state}`, type: 'button', 'aria-disabled': state === 'locked' || state === 'soon' ? 'true' : 'false' },
        h('span', { class: 'emoji', 'aria-hidden': 'true' }, station.emoji),
        h('span', { style: 'flex:1; min-width:0' },
            h('span', { class: 'name', style: 'display:block' }, station.name),
            h('span', { class: 'desc', style: 'display:block' }, station.desc),
            state === 'open' && rec?.stage ? h('span', { class: 'bar', style: 'display:block' }, h('i', { style: `width:${(rec.stage / total) * 100}%` })) : null),
        h('span', { class: 'state' }, label));
    btn.addEventListener('click', () => {
        if (state === 'soon') return toast('🛠️ 이 정거장은 아직 준비 중이에요.');
        if (state === 'locked') return toast('🔒 앞 정거장에서 도장을 받으면 열려요!');
        go({ screen: 'quest', questId: station.id, replay: false });
    });
    return btn;
}

// ---------- 퀘스트 ----------
function renderQuest() {
    const station = stations.find(s => s.id === ui.questId);
    const quest = station?.quest;
    if (!quest) return go({ screen: 'map' });
    const rec = questRecord(profile(), quest.id);
    setCalm(quest.calm);
    const stageIndex = ui.replay ? ui.stageIndex ?? 0 : Math.min(rec.stage, quest.stages.length);

    const stepsBar = h('div', { class: 'steps', 'aria-label': '퀘스트 단계' }, ...quest.stages.map((s, i) => h('span', {
        class: `step ${i < stageIndex || (rec.done && !ui.replay) ? 'done' : i === stageIndex ? 'now' : ''}`,
    }, h('span', { 'aria-hidden': 'true' }, i < stageIndex ? '✔' : s.emoji), h('span', { class: 'step-name' }, s.title))));

    mount(topbar(`${quest.emoji} ${quest.title}`, () => go({ screen: 'map' }), '🗺️ 지도'), stepsBar);

    if (rec.done && !ui.replay) return renderQuestComplete(quest, rec);

    const stage = quest.stages[stageIndex];
    const content = h('div');
    mount(
        h('div', { class: 'stage-head' },
            h('span', { class: 'emoji', 'aria-hidden': 'true' }, stage.emoji),
            h('div', {}, h('h2', {}, stage.title), h('div', { class: 'stage-goal' }, stage.goal))),
        ui.replay ? h('div', { class: 'feedback info', style: 'margin:0 0 12px' }, '🔁 복습 중이에요. 도장과 기록은 그대로 남아 있어요.') : null,
        content,
    );

    const ctx = {
        record: ui.replay ? { ...rec, notes: [...rec.notes] } : rec, // 복습 중에는 기록을 바꾸지 않음
        readingStage: quest.stages.find(s => s.type === 'reading'),
        save: () => { if (!ui.replay) persist(); },
        done: () => {
            if (ui.replay) {
                const next = stageIndex + 1;
                return go(next < quest.stages.length ? { ...ui, stageIndex: next } : { screen: 'quest', questId: quest.id, replay: false });
            }
            rec.stage = stageIndex + 1;
            if (rec.stage >= quest.stages.length) { rec.done = true; rec.doneAt = Date.now(); }
            persist();
            go({ screen: 'quest', questId: quest.id, replay: false, justFinished: rec.done });
        },
    };
    renderers[stage.type](content, stage, ctx);
}

function renderQuestComplete(quest, rec) {
    const index = stations.findIndex(s => s.id === quest.id);
    const next = stations.slice(index + 1).find(s => s.quest);
    const found = questArtifacts(quest);
    const readyStations = stations.filter(s => s.quest);
    const allDone = readyStations.length === stations.length && readyStations.every(s => profile().quests[s.id]?.done);
    mount(
        allDone ? h('div', { class: 'card card-accent center' },
            h('h2', {}, '🎓 모든 정거장의 배움을 마쳤어요'),
            h('p', { style: 'margin:8px 0 12px' }, `선사 시대부터 6·25 전쟁까지, ${stations.length}개 정거장을 모두 지나왔어요. 나의 역사 노트에서 지금까지 배운 것을 돌아보세요.`),
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go({ screen: 'notes' }) }, '📒 나의 역사 노트 보기')) : null,
        h('div', { class: 'card center' },
            h('div', { class: 'stamp' }, h('span', { class: 'big' }, quest.emoji), tone('questStamp')),
            h('h2', {}, ui.justFinished ? tone('questDone') : tone('questDoneAgain')),
            h('p', { class: 'muted', style: 'margin-top:6px' }, `탐험 질문: ${quest.question}`)),
        rec.notes?.length ? h('div', { class: 'card' },
            h('h3', {}, '📝 나의 한 줄 정리'),
            ...rec.notes.map(n => h('div', { class: 'note-line' }, n))) : null,
        h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:10px' }, tone('dexTitle')), dexGrid(found, true)),
        h('div', { class: 'stack', style: 'margin-top:16px' },
            next && stationState(next, stations.indexOf(next)) === 'open'
                ? h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => go({ screen: 'quest', questId: next.id, replay: false }) }, `다음 정거장: ${next.emoji} ${next.name} ▶`)
                : null,
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'quest', questId: quest.id, replay: true, stageIndex: 0 }) }, '🔁 처음부터 다시 복습하기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'map' }) }, '🗺️ 지도로 돌아가기')),
    );
}

function questArtifacts(quest) {
    return quest.stages.filter(s => s.type === 'detective').flatMap(s => s.artifacts);
}

function dexGrid(items, known) {
    return h('div', { class: 'dex' }, ...items.map(item => (known
        ? h('div', { class: 'dex-item' }, h('div', { class: 'art', html: art[item.art] || '' }), h('div', { class: 'nm' }, item.name), h('div', { class: 'small muted' }, rich(item.fact)))
        : h('div', { class: 'dex-item unknown' }, h('div', { class: 'art' }, '?'), h('div', { class: 'nm muted' }, '???')))));
}

// ---------- 나의 역사 노트 ----------
function renderNotes() {
    const p = profile();
    const ready = stations.filter(s => s.quest);
    mount(
        topbar('📒 나의 역사 노트', () => go({ screen: 'map' }), '🗺️ 지도'),
        h('div', { class: 'card card-accent' },
            h('h2', {}, `${p.avatar} ${p.number}번 탐험가의 역사 노트`),
            h('p', { class: 'small muted', style: 'margin:6px 0 10px' }, '모은 유물과 내가 쓴 정리가 여기에 쌓여요.'),
            h('button', { class: 'btn btn-small no-print', type: 'button', onclick: () => window.print() }, '🖨️ 인쇄하기 / PDF로 저장')),
        ...ready.map(station => {
            const rec = p.quests[station.id];
            const detectiveDone = rec && (rec.done || rec.stage >= 1);
            return h('div', { class: 'card' },
                h('h2', { style: 'margin-bottom:10px' }, `${station.emoji} ${station.name} ${rec?.done ? '🏅' : ''}`),
                dexGrid(questArtifacts(station.quest), detectiveDone),
                rec?.notes?.length
                    ? h('div', { style: 'margin-top:10px' }, ...rec.notes.map(n => h('div', { class: 'note-line' }, n)))
                    : h('p', { class: 'small muted', style: 'margin-top:10px' }, '아직 한 줄 정리를 쓰지 않았어요.'));
        }),
    );
}

// ---------- 시작 ----------
if (profile()) ui = { screen: 'map' };
render();

// 한 번 열면 인터넷이 끊겨도 쓸 수 있도록 서비스 워커 등록
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이도 동작 */ });
}
