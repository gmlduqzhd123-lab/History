// 역사 탐험 퀘스트 — 화면 전환과 학습 기록 관리
import { h, rich, clear, modal, toast, scrollTop } from './dom.js';
import { loadData, saveData, newProfile, questRecord, cleanName, MAX_NAME, extrasOf } from './storage.js';
import { encodeProgress, decodeProgress } from './code.js';
import { stopSpeaking } from './tts.js';
import { fillPicture, creditLine } from './picture.js';
import { setCalm, tone } from './tone.js';
import { units, stations, questOrder, avatars } from '../content/quests.js';
import { renderDetective } from './activities/detective.js';
import { renderReading } from './activities/reading.js';
import { renderAdventure } from './activities/adventure.js';
import { renderMastery } from './activities/mastery.js';
import { renderSummary } from './activities/summary.js';
import { timelines } from '../content/timeline.js';
import { renderTimeline } from './extras/timeline.js';

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

// 화면에 보일 이름: 이름이 있으면 이름, 없으면(예전 기록) 번호
function whoName(p) { return p.name || `${p.number}번`; }
function nameInput(value = '') {
    return h('input', { class: 'name-input', type: 'text', value, maxlength: String(MAX_NAME), placeholder: '예) 김하늘', autocomplete: 'off', 'aria-label': '이름' });
}

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
    if (!profile()) ui = ['welcome', 'register', 'code'].includes(ui.screen) ? ui : { screen: 'welcome' };
    ({ welcome: renderWelcome, register: renderRegister, code: renderCodeEntry, map: renderMap, quest: renderQuest, notes: renderNotes, timeline: renderTimelineScreen }[ui.screen] || renderWelcome)();
}

// 더 탐험하기 활동이 쓰는 공통 도구
const env = { mount, topbar: (...a) => topbar(...a), go: next => go(next), profile, persist };

// ---------- 퀘스트 상태 ----------
function stationState(station, index) {
    if (!station.quest) return 'soon';
    const rec = profile().quests[station.id];
    if (rec?.done) return 'done';
    if (openAll || index === 0) return 'open';
    const prev = stations[index - 1];
    return profile().quests[prev.id]?.done ? 'open' : 'locked';
}

// 단원의 정거장을 모두 마쳤는지 (선생님용 ?open=all 이면 늘 열림)
function unitDone(unitIndex) {
    return openAll || units[unitIndex].stations.every(s => profile().quests[s.id]?.done);
}
function allDone() {
    return openAll || stations.every(s => profile().quests[s.id]?.done);
}

// ---------- 시작 화면 ----------
function renderWelcome() {
    const saved = Object.values(data.profiles).sort((a, b) => a.number - b.number);
    const tab = ui.tab === 'help' ? 'help' : 'start';
    const tabButton = (id, label) => h('button', {
        type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': 'welcome-panel',
        'aria-selected': String(tab === id), class: tab === id ? 'on' : '',
        onclick: () => { if (tab !== id) go({ screen: 'welcome', tab: id }); },
    }, label);
    const startPanel = [
        saved.length ? h('div', { class: 'card' },
            h('h2', { style: 'margin-bottom:12px' }, '이 기기의 탐험가'),
            h('div', { class: 'explorer-list' }, ...saved.map(p => h('button', {
                type: 'button',
                onclick: () => { data.current = p.number; persist(); go({ screen: 'map' }); },
            }, h('span', { class: 'av' }, p.avatar), whoName(p), p.name ? h('span', { class: 'small muted' }, `${p.number}번`) : null)))) : null,
        h('div', { class: 'card stack' },
            h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => go({ screen: 'register' }) }, '🙋 새 탐험가로 시작하기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'code' }) }, '💾 이어하기 코드로 계속하기'),
            installButton('btn btn-block')),
    ];
    mount(
        h('div', { class: 'hero' },
            h('div', { class: 'logo', 'aria-hidden': 'true' }, '🧭'),
            h('h1', {}, '역사 탐험 퀘스트'),
            h('p', { class: 'muted' }, '5학년 2학기 사회 · 유물과 이야기로 떠나는 시간 여행')),
        h('div', { class: 'tabs', role: 'tablist', 'aria-label': '시작 화면' },
            tabButton('start', '🚀 시작하기'),
            tabButton('help', '📖 사용법')),
        h('div', { id: 'welcome-panel', role: 'tabpanel', 'aria-labelledby': `tab-${tab}` },
            ...(tab === 'help' ? helpPanel() : startPanel)),
        h('p', { class: 'site-foot' },
            '© 2026 엽쌤. All rights reserved. · ',
            h('a', { href: 'https://gmlduqzhd123-lab.github.io/YScode/' }, '엽쌤의 다른 앱 보기 →')),
    );
}

// 정거장 하나의 다섯 단계 (사용법 탭과 "탐험 방법" 창에서 함께 씀)
const GUIDE_STEPS = [
    ['🔍', '유물 탐정', '가려진 유물을 단서로 추리해요.'],
    ['📖', '이야기 카드', '짧은 글을 읽고 확인 문제를 풀어요.'],
    ['🎲', '생활 체험', '그 시대 아이가 되어 선택해요.'],
    ['🏆', '개념 도전', '4문제 이상 맞히면 도장!'],
    ['📝', '한 줄 정리', '배운 것을 내 말로 정리해요.'],
];

// ---------- 시작 화면 "사용법" 탭 ----------
function helpPanel() {
    const section = (title, ...body) => h('div', { class: 'card help-card' }, h('h2', {}, title), ...body);
    const list = items => h('ol', { class: 'help-list' }, ...items.map(t => h('li', {}, rich(t))));
    return [
        section('🙋 처음 시작할 때',
            list(['**🚀 시작하기** 탭에서 **새 탐험가로 시작하기**를 눌러요.',
                '**내 이름**을 쓰고, 우리 반 **번호**와 **캐릭터**를 골라요.',
                '**🚀 탐험 시작!** 을 누르면 탐험 지도가 나와요.'])),
        section('🗺️ 탐험 지도',
            h('p', {}, rich('구석기 시대부터 6·25 전쟁까지 **정거장 10개**가 있어요. 정거장을 끝내고 **도장**을 받으면 다음 정거장이 열려요. 하던 곳은 **▶ 이어서**로 다시 시작해요.'))),
        section('🧭 정거장 하나는 다섯 단계',
            ...GUIDE_STEPS.map(([e, t, d]) => h('div', { class: 'note-line' }, h('b', {}, `${e} ${t}`), ` — ${d}`))),
        section('💡 막힐 때는',
            list(['**🔎 단서 더 보기** — 유물 그림이 더 드러나요.',
                '**🙋 힌트** — 도움말이 나오고 틀린 보기 하나가 지워져요.',
                '**🔊 읽어 주기** — 글을 소리 내어 읽어 줘요.',
                '**🧺 낱말 상자** — 한 줄 정리가 어려우면 낱말을 골라 넣어요.'])),
        section('💾 수업이 끝나면',
            list(['정거장을 마치면 나오는 **💾 이어하기 코드**를 **공책에 적어** 둬요.',
                '다른 기기나 다음 시간에는 **이어하기 코드로 계속하기**에 코드와 이름을 넣으면 이어서 할 수 있어요.',
                '**📒 나의 역사 노트**에는 모은 유물과 내가 쓴 한 줄 정리가 쌓여요. 인쇄도 할 수 있어요.'])),
        section('🎒 더 탐험하기',
            list(['**⏳ 연표 잇기** — 단원의 정거장을 모두 마치면 열려요. 사건 카드를 일어난 순서대로 눌러 연표를 만들어요. 10개 정거장을 다 마치면 **큰 연표**도 열려요.'])),
        section('🔘 버튼 알아보기',
            list(['**🏠** — 시작 화면으로 가요.',
                '**🗺️ 지도** — 탐험 지도로 돌아가요.',
                '**오른쪽 위 내 이름** — 이름 바꾸기, 이어하기 코드, 다른 탐험가로 바꾸기',
                '**📲 앱 설치** — 홈 화면에 아이콘을 만들어 바로 열어요. 인터넷이 끊겨도 탐험할 수 있어요.'])),
        h('details', { class: 'card help-card teacher' },
            h('summary', {}, '👩‍🏫 선생님께'),
            list(['앱 주소를 QR 코드로 보여 주기만 하면 돼요. 진행·채점·피드백은 앱이 해요.',
                '기록은 **그 기기에만** 저장되고 어디로도 보내지 않아요.',
                '공용 태블릿은 학생마다 시작 화면에서 **자기 이름**을 눌러 들어가면 기록이 섞이지 않아요.',
                '아이패드·아이폰은 7일 넘게 안 열면 기록이 지워질 수 있어요. **📲 앱 설치**를 해 두고, 수업 끝에 **이어하기 코드**를 적게 해 주세요.',
                '결석한 학생 등을 위해 모든 정거장을 한꺼번에 열려면 주소 끝에 **?open=all** 을 붙여요.'])),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:16px', onclick: () => go({ screen: 'welcome', tab: 'start' }) }, '🚀 이제 시작하러 가기'),
    ];
}

function renderRegister() {
    let number = null;
    let avatar = avatars[0];
    const nameEl = nameInput();
    const updateStart = () => { startBtn.disabled = !number || !cleanName(nameEl.value); };
    nameEl.addEventListener('input', () => updateStart());
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) nameEl.blur(); });
    const numGrid = h('div', { class: 'num-grid' });
    for (let n = 1; n <= MAX_NUMBER; n++) {
        numGrid.append(h('button', {
            type: 'button', 'aria-pressed': 'false',
            onclick: e => {
                number = n;
                [...numGrid.children].forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
                e.currentTarget.classList.add('on');
                e.currentTarget.setAttribute('aria-pressed', 'true');
                updateStart();
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
        const name = cleanName(nameEl.value);
        if (!number || !name) return;
        const existing = data.profiles[number];
        if (existing && !confirm(`${number}번${existing.name ? `(${existing.name})` : ''} 탐험가가 이미 이 기기에 있어요.\n그 기록으로 이어서 할까요? (취소를 누르면 번호를 다시 고를 수 있어요)`)) return;
        if (existing) existing.name = name;
        else data.profiles[number] = newProfile(number, avatar, name);
        data.current = number;
        persist();
        go({ screen: 'map' });
        if (!existing) showGuide();
    });
    mount(
        topbar('🙋 새 탐험가', () => go({ screen: 'welcome' })),
        h('div', { class: 'card' }, h('h2', { style: 'margin-bottom:10px' }, '1. 내 이름을 써요'), nameEl,
            h('p', { class: 'muted small', style: 'margin-top:6px' }, '이름은 이 기기에만 저장되고 다른 곳으로 보내지 않아요.')),
        h('div', { class: 'card' }, h('h2', { style: 'margin-bottom:6px' }, '2. 내 번호를 골라요'),
            h('p', { class: 'muted small' }, '우리 반 번호예요. 이어하기 코드에 쓰여요.'), numGrid),
        h('div', { class: 'card' }, h('h2', { style: 'margin-bottom:12px' }, '3. 탐험가 캐릭터를 골라요'), avGrid),
        h('div', { style: 'margin-top:16px' }, startBtn),
    );
}

function renderCodeEntry() {
    const input = h('input', { class: 'code-input', type: 'text', placeholder: 'XXXXX-XXXXX', maxlength: '14', autocomplete: 'off', 'aria-label': '이어하기 코드' });
    const nameEl = nameInput();
    const msg = h('div');
    const submit = () => {
        const result = decodeProgress(input.value, questOrder, avatars);
        // 글자를 잘못 옮겨 적어 우연히 맞는 코드가 되어도 없는 번호(41번 이상)면 받지 않음
        if (!result || result.number > MAX_NUMBER) {
            msg.replaceChildren(h('div', { class: 'feedback bad' }, '코드가 맞지 않아요. 글자를 다시 확인해 주세요.'));
            return;
        }
        const existing = data.profiles[result.number];
        const name = cleanName(nameEl.value);
        // 코드에는 이름이 없으므로, 이 기기에 이름이 없는 번호라면 이름을 꼭 써야 함
        if (!name && !existing?.name) {
            msg.replaceChildren(h('div', { class: 'feedback bad' }, '내 이름도 써 주세요.'));
            nameEl.focus();
            return;
        }
        const merged = existing || newProfile(result.number, result.avatar);
        merged.avatar = result.avatar;
        if (name) merged.name = name;
        // 코드에 담긴 진도가 더 앞서 있을 때만 덮어씀
        Object.entries(result.quests).forEach(([id, q]) => {
            const cur = merged.quests[id];
            if (!cur || (!cur.done && (q.done || q.stage > cur.stage))) merged.quests[id] = { ...q, notes: cur?.notes || [] };
        });
        data.profiles[result.number] = merged;
        data.current = result.number;
        persist();
        toast(`${result.avatar} ${whoName(merged)} 탐험가, 다시 만나서 반가워요!`);
        go({ screen: 'map' });
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    mount(
        topbar('💾 이어하기', () => go({ screen: 'welcome' })),
        h('div', { class: 'card stack' },
            h('p', {}, '다른 기기에서 받은 ', h('b', {}, '이어하기 코드'), '를 입력하세요.'),
            input,
            h('p', { class: 'small', style: 'margin-top:6px' }, '내 이름 ', h('span', { class: 'muted' }, '(코드에는 이름이 담기지 않아서 다시 써요)')),
            nameEl,
            h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: submit }, '계속하기'),
            msg),
    );
    input.focus();
}

// ---------- 공통 상단 막대 ----------
// 탐험가가 있는 화면(지도·퀘스트·노트)에는 🏠 버튼으로 시작 화면에 갈 수 있음
function topbar(title, onBack, backLabel = '← 뒤로') {
    const p = profile();
    return h('div', { class: 'topbar' },
        p ? h('button', { class: 'btn btn-small home-btn', type: 'button', onclick: () => go({ screen: 'welcome' }), 'aria-label': '홈으로', title: '홈으로' }, '🏠') : null,
        onBack ? h('button', { class: 'btn btn-small', type: 'button', onclick: onBack }, backLabel) : null,
        h('div', { class: 'title' }, title),
        p ? h('button', { class: 'chip', type: 'button', onclick: showMenu, 'aria-label': '탐험가 메뉴' }, p.avatar, h('span', { class: 'chip-name' }, whoName(p))) : null,
    );
}

function showMenu() {
    const p = profile();
    const close = modal(
        h('h2', { style: 'margin-bottom:12px' }, `${p.avatar} ${p.name ? `${p.name} (${p.number}번)` : `${p.number}번`} 탐험가`),
        h('div', { class: 'stack' },
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); showRename(); } }, '✏️ 이름 바꾸기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); showCode(); } }, '💾 이어하기 코드 보기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); go({ screen: 'notes' }); } }, '📒 나의 역사 노트'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); showGuide(); } }, '❓ 탐험 방법'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); data.current = null; persist(); go({ screen: 'welcome' }); } }, '🔄 다른 탐험가로 바꾸기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => close() }, '닫기')),
    );
}

function showRename() {
    const p = profile();
    const nameEl = nameInput(p.name);
    const save = () => {
        const name = cleanName(nameEl.value);
        if (!name) return nameEl.focus();
        p.name = name;
        persist();
        close();
        render();
    };
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) save(); });
    const close = modal(
        h('h2', { style: 'margin-bottom:12px' }, '✏️ 이름 바꾸기'),
        nameEl,
        h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:12px', onclick: save }, '저장하기'),
        h('button', { class: 'btn btn-block', type: 'button', style: 'margin-top:8px', onclick: () => close() }, '닫기'),
    );
    nameEl.focus();
}

function showCode() {
    const code = encodeProgress(profile(), questOrder, avatars);
    const close = modal(
        h('h2', {}, '💾 이어하기 코드'),
        h('p', { class: 'muted small', style: 'margin-top:6px' }, '다른 기기나 다음 시간에 이 코드를 입력하면 지금까지의 진도를 이어서 할 수 있어요. 공책에 적어 두세요!'),
        h('div', { class: 'code-box' }, code),
        h('p', { class: 'small muted', style: 'margin-top:10px' }, '※ 이름과 한 줄 정리 글은 코드에 담기지 않고 이 기기에만 남아요.'),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => close() }, '다 적었어요'),
    );
}

function showGuide() {
    const steps = GUIDE_STEPS;
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
            h('h2', {}, `안녕, ${whoName(p)} 탐험가! ${p.avatar}`),
            h('p', { style: 'margin:6px 0 12px' }, doneCount ? `지금까지 도장 ${doneCount}개를 모았어요. 다음 정거장으로 떠나 볼까요?` : '첫 번째 정거장부터 시간 여행을 떠나 볼까요?'),
            h('div', { class: 'row' },
                h('button', { class: 'btn btn-small', type: 'button', onclick: () => go({ screen: 'notes' }) }, '📒 나의 역사 노트'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: showCode }, '💾 이어하기 코드'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: showGuide }, '❓ 탐험 방법'),
                installButton('btn btn-small'))),
        ...units.map((unit, u) => h('section', { class: 'unit' },
            h('h2', { class: 'unit-title' }, `📚 ${unit.title}`),
            h('div', { class: 'path' }, ...unit.stations.map(station => stationButton(station))),
            unitExtras(u)),
        ),
        moreCard(),
    );
}

// 단원 마무리 활동: 단원의 정거장을 모두 마치면 열림
function unitExtras(u) {
    const tl = timelines.find(t => t.unit === u);
    return h('div', { class: 'unit-extras' },
        extraButton('⏳', '연표 잇기', unitDone(u), !!extrasOf(profile()).timeline[tl.key]?.done,
            () => go({ screen: 'timeline', key: tl.key }), '이 단원의 정거장을 모두 마치면 열려요.'));
}

// 지도 맨 아래 "더 탐험하기"
function moreCard() {
    const big = timelines.find(t => t.key === 'all');
    return h('section', { class: 'unit' },
        h('h2', { class: 'unit-title' }, '🎒 더 탐험하기'),
        h('div', { class: 'unit-extras' },
            extraButton('⏳', '10개 정거장 큰 연표', allDone(), !!extrasOf(profile()).timeline[big.key]?.done,
                () => go({ screen: 'timeline', key: big.key }), '10개 정거장을 모두 마치면 열려요.')));
}

function extraButton(emoji, label, open, done, onClick, lockedMsg) {
    const state = done ? 'done' : open ? 'open' : 'locked';
    return h('button', {
        class: `extra-btn ${state}`, type: 'button', 'aria-disabled': String(!open),
        onclick: () => (open ? onClick() : toast(`🔒 ${lockedMsg}`)),
    }, h('span', { class: 'emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'lbl' }, label),
    h('span', { class: 'st' }, done ? '✅' : open ? '▶' : '🔒'));
}

function renderTimelineScreen() {
    const tl = timelines.find(t => t.key === ui.key);
    const open = tl && (tl.unit == null ? allDone() : unitDone(tl.unit));
    if (!open) return go({ screen: 'map' });
    renderTimeline(env, tl, { calm: tl.unit === 2 });
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
    if (!rec.done && rec.stage >= quest.stages.length) { rec.done = true; persist(); }
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
            h('button', { class: 'btn btn-block', type: 'button', onclick: showCode }, '💾 이어하기 코드 보기 (공책에 적어 두기)'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'quest', questId: quest.id, replay: true, stageIndex: 0 }) }, '🔁 처음부터 다시 복습하기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'map' }) }, '🗺️ 지도로 돌아가기')),
    );
}

function questArtifacts(quest) {
    return quest.stages.filter(s => s.type === 'detective').flatMap(s => s.artifacts);
}

function dexGrid(items, known) {
    return h('div', { class: 'dex' }, ...items.map(item => (known
        ? h('div', { class: 'dex-item' }, fillPicture(h('div', { class: 'art' }), item.art, item.name), h('div', { class: 'nm' }, item.name), h('div', { class: 'small muted' }, rich(item.fact)), creditLine(item.art))
        : h('div', { class: 'dex-item unknown' }, h('div', { class: 'art' }, '?'), h('div', { class: 'nm muted' }, '???')))));
}

// ---------- 나의 역사 노트 ----------
function renderNotes() {
    const p = profile();
    const ready = stations.filter(s => s.quest);
    mount(
        topbar('📒 나의 역사 노트', () => go({ screen: 'map' }), '🗺️ 지도'),
        h('div', { class: 'card card-accent' },
            h('h2', {}, `${p.avatar} ${p.name ? `${p.number}번 ${p.name}` : `${p.number}번 탐험가`}의 역사 노트`),
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

// ---------- 앱 설치 (홈 화면에 추가) ----------
let installPrompt = null;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
});
window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast('📲 앱이 설치되었어요! 홈 화면에서 바로 열 수 있어요.');
});

// 이미 앱으로 열었으면 버튼을 보이지 않음
function installButton(cls) {
    if (isStandalone()) return null;
    return h('button', { class: cls, type: 'button', onclick: installApp }, '📲 앱 설치');
}

async function installApp() {
    if (installPrompt) {
        const promptEvent = installPrompt;
        installPrompt = null; // 한 번만 쓸 수 있음
        promptEvent.prompt();
        try {
            const { outcome } = await promptEvent.userChoice;
            if (outcome !== 'accepted') toast('나중에 다시 설치할 수 있어요.');
        } catch { /* 무시 */ }
        return;
    }
    showInstallGuide();
}

function showInstallGuide() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let steps;
    if (/KAKAOTALK/i.test(ua)) {
        steps = ['카카오톡 화면의 **⋮ 메뉴**(오른쪽 아래 또는 위)를 눌러요. (카카오톡 안에서는 설치가 안 돼요)', '**다른 브라우저로 열기**(아이폰은 **Safari로 열기**)를 골라요.', '새로 열린 화면에서 다시 **📲 앱 설치**를 눌러요.'];
    } else if (ios) {
        steps = ['**Safari**로 이 페이지를 열어요. (다른 앱에서는 설치가 안 돼요)', '아래쪽 **공유 버튼 ⬆︎**을 눌러요.', '**홈 화면에 추가** → 오른쪽 위 **추가**를 눌러요.'];
    } else if (/Android/i.test(ua)) {
        steps = ['**Chrome** 또는 **삼성 인터넷**으로 열어요.', '오른쪽 위(또는 아래) **⋮ / ≡ 메뉴**를 눌러요.', '**앱 설치** 또는 **홈 화면에 추가**를 눌러요.'];
    } else {
        steps = ['**Chrome**이나 **Edge**로 열어요.', '주소창 오른쪽의 **설치 아이콘**을 누르거나, **⋮ 메뉴 → 앱 설치**를 눌러요.', 'Edge는 **⋯ 메뉴 → 앱 → 이 사이트를 앱으로 설치**예요.'];
    }
    const close = modal(
        h('h2', {}, '📲 앱으로 설치하기'),
        h('p', { class: 'muted small', style: 'margin:6px 0 10px' }, '설치하면 홈 화면 아이콘으로 바로 열리고, 인터넷이 없어도 탐험할 수 있어요.'),
        ...steps.map((t, i) => h('div', { class: 'note-line' }, h('b', {}, `${i + 1}. `), rich(t))),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:14px', onclick: () => close() }, '알겠어요!'),
    );
}

// ---------- 시작 ----------
// 이 기기에 탐험가가 한 명뿐이면 바로 지도로, 여러 명이면(공용 태블릿) 시작 화면에서 자기 번호를 고름
if (profile() && Object.keys(data.profiles).length === 1) ui = { screen: 'map' };
render();

// 브라우저가 공간이 모자랄 때나 오래 안 쓴 사이트를 정리할 때 기록을 지우지 않도록 요청
// (사파리는 7일 넘게 안 연 사이트의 기록을 지울 수 있음 → 홈 화면에 설치하면 안전)
if (navigator.storage?.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});

// 한 번 열면 인터넷이 끊겨도 쓸 수 있도록 서비스 워커 등록
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이도 동작 */ });
}
