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
import { people } from '../content/people.js';
import { renderTimeline } from './extras/timeline.js';
import { updateReview, dueItems, waitingCount, renderReview } from './extras/review.js';
import { renderPeople, renderPerson, peopleCount, collectedCount } from './extras/people.js';
import { renderPlaces, placeCount, visitedCount } from './extras/places.js';
import { renderWriting, writingView, writingFor, discardWritingDrafts } from './extras/writing.js';
import { inquiries } from '../content/inquiries.js';
import { renderInquiry, inquiryView, discardInquiryDrafts } from './extras/inquiry.js';
import { renderLanding, landingHeader } from './landing.js';
import { prepareOffline, remountOfflineStatus } from './offline.js';

const renderers = {
    detective: renderDetective,
    reading: renderReading,
    adventure: renderAdventure,
    mastery: renderMastery,
    summary: renderSummary,
};

const MAX_NUMBER = 40;
const app = document.getElementById('app');
let data = loadData();
// 선생님용: 주소 끝에 ?open=all 을 붙이면 준비된 퀘스트를 순서와 관계없이 모두 열 수 있음
const openAll = new URLSearchParams(location.search).get('open') === 'all';

let ui = { screen: 'welcome' };
let saving = false;
let storageChanged = false;
let screenCleanup = null;
let screenBeforeNavigate = null;

// null·false 는 건너뛰고 붙임 (append는 null을 "null" 글자로 넣어 버림)
function mount(...nodes) { app.append(...nodes.filter(n => n !== null && n !== undefined && n !== false)); }

// 화면에 보일 이름: 이름이 있으면 이름, 없으면(예전 기록) 번호
function whoName(p) { return p.name || `${p.number}번`; }
function nameInput(value = '') {
    return h('input', { class: 'name-input', type: 'text', value, maxlength: String(MAX_NAME), placeholder: '예) 김하늘', autocomplete: 'off', 'aria-label': '이름' });
}

function profile() { return data.current != null ? data.profiles[data.current] : null; }

// 탐험가는 "번호 + 이름"으로 구분함: 여러 반이 태블릿을 함께 써서 같은 번호가 있어도 기록이 섞이지 않음
// (예전 기록은 번호만 열쇠로 쓰고 이름이 비어 있을 수 있어, 이름 없는 같은 번호 기록은 그 학생 것으로 이어 줌)
function findProfileKey(number, name) {
    const entries = Object.entries(data.profiles).filter(([, p]) => p.number === number);
    const exact = entries.filter(([, p]) => p.name === name);
    if (exact.length > 1) {
        toast('같은 번호와 이름의 기록이 여러 개 있어요. 시작 화면에서 내 기록을 고른 뒤 이름을 구별해 주세요.');
        return false;
    }
    if (exact.length === 1) return exact[0][0];
    // 이름 없는 예전 기록은 다른 반 같은 번호 학생 것일 수도 있으니 물어보고 이어 줌
    const legacy = entries.find(([, p]) => !p.name);
    if (legacy && confirm(`이 기기에 이름이 없는 ${number}번 기록(예전에 쓰던 기록)이 있어요.\n내 기록이 맞으면 [확인], 아니면 [취소]를 눌러 새로 시작해요.`)) return legacy[0];
    return null;
}
function newProfileKey(number, name) {
    let key = `${number}:${name}`;
    for (let i = 2; data.profiles[key]; i++) key = `${number}:${name}:${i}`;
    return key;
}
async function persist(requireStorage = false, failureMessage = '') {
    if (saving) return false;
    saving = true;
    app.setAttribute('aria-busy', 'true');
    const saved = await saveData(data);
    saving = false;
    app.removeAttribute('aria-busy');
    const refreshPending = storageChanged;
    storageChanged = false;
    if (saved === 'conflict') {
        if (refreshPending) refreshStorage(false);
        modal.closeAll?.();
        toast('다른 창에서 바뀐 최신 기록을 불러왔어요. 열린 앱 창을 하나만 사용해 주세요.');
        go({ screen: profile() ? 'map' : 'welcome' }, true);
        return false;
    }
    if (refreshPending && refreshStorage()) return false;
    if (!saved) toast(failureMessage || (requireStorage
        ? '⚠️ 이 기기에 저장하지 못했어요. 작성한 글을 복사해 두고 다시 저장해 주세요.'
        : '⚠️ 이 기기에 저장하지 못했어요. 이어하기 코드를 적어 두세요.'));
    // 저장 공간이 부족해도 이 창에서 학습과 이어하기 코드 사용은 계속할 수 있음
    return requireStorage ? !!saved : true;
}

// 저장이 끝나기 전에 같은 버튼·Enter를 여러 번 눌러 활동이나 탐험가가 바뀌지 않게 함
for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
    if (!saving) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);

function refreshStorage(notice = true) {
    const current = data.current;
    const active = profile();
    const next = loadData(data);
    next.current = current != null && next.profiles[current] ? current : null;
    const nextActive = next.current != null ? next.profiles[next.current] : null;
    const activeChanged = JSON.stringify(active) !== JSON.stringify(nextActive);
    if (active && !activeChanged) next.profiles[current] = active;
    data = next;
    // 다른 창에서 탐험가를 바꾸어도 이 창의 학생은 바뀌지 않음
    if (activeChanged) {
        modal.closeAll?.();
        if (notice) toast(profile() ? '다른 창에서 바뀐 최신 기록을 불러왔어요.' : '다른 창에서 이 탐험가의 기록을 지웠어요.');
        go({ screen: profile() ? 'map' : 'welcome' }, true);
    } else if (ui.screen === 'welcome') render();
    return activeChanged;
}

window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage || (event.key !== null && event.key !== 'history-quest:v1')) return;
    if (saving) { storageChanged = true; return; }
    refreshStorage();
});

function navigateAfterGuard(next, proceed) {
    if (screenBeforeNavigate) screenBeforeNavigate(next, proceed);
    else proceed();
}

function go(next, skipGuard = false) {
    if (!skipGuard && screenBeforeNavigate) {
        navigateAfterGuard(next, () => go(next, true));
        return;
    }
    stopSpeaking();
    const y = window.scrollY;
    ui = next;
    render({ focusHeading: !next.keepScroll, focusId: next.focusId });
    // keepScroll: 같은 화면 안에서 고르기만 바뀔 때(문화유산 지도의 곳 고르기)는 보던 자리를 지킴
    if (next.keepScroll) window.scrollTo(0, y);
    else scrollTop();
    // 시작하기·사용법 탭은 페이지 길이가 달라도 선택한 탭이 화면 안에 보이게 함.
    if (next.focusId) document.getElementById(next.focusId)?.scrollIntoView({ block: 'nearest' });
}

function render({ focusHeading = false, focusId = null } = {}) {
    // 같은 화면을 다시 그릴 때는 선택하던 버튼을 지키고, 새 화면에서는 제목부터 읽게 함.
    const active = app.contains(document.activeElement) ? document.activeElement : null;
    const previousFocus = active ? {
        id: active.id, tag: active.tagName, label: active.getAttribute('aria-label'), text: active.textContent,
    } : null;
    screenBeforeNavigate = null;
    screenCleanup?.();
    screenCleanup = null;
    clear(app);
    setCalm(false);
    if (!profile()) ui = ['welcome', 'register', 'code'].includes(ui.screen) ? ui : { screen: 'welcome' };
    app.classList.toggle('landing-page', ui.screen === 'welcome');
    document.body.classList.toggle('landing-home', ui.screen === 'welcome');
    ({ welcome: renderWelcome, register: renderRegister, code: renderCodeEntry, map: renderMap, quest: renderQuest, notes: renderNotes, timeline: renderTimelineScreen, review: () => renderReview(env, stations), people: () => renderPeople(env, stations), person: () => renderPerson(env, stations, ui.id), places: () => renderPlaces(env, stations, ui), writing: renderWritingScreen, inquiry: renderInquiryScreen }[ui.screen] || renderWelcome)();
    remountOfflineStatus();
    if (document.querySelector('[role="dialog"]')) return;
    const heading = () => app.querySelector('.stage-head h2') || app.querySelector('h1, h2, h3') || app;
    let target = focusId ? document.getElementById(focusId) : null;
    if (!target && focusHeading) target = heading();
    if (!target && previousFocus) {
        target = previousFocus.id ? document.getElementById(previousFocus.id) :
            [...app.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')].find(el =>
                el.tagName === previousFocus.tag && el.getAttribute('aria-label') === previousFocus.label && el.textContent === previousFocus.text);
        target ||= heading();
    }
    if (target) {
        if (!target.matches('button, input, select, textarea, a[href], [tabindex]')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
    }
}

// 더 탐험하기 활동이 쓰는 공통 도구
const env = {
    mount, topbar: (...a) => topbar(...a), go: next => go(next), profile, persist, toast,
    profileKey: () => data.current,
    stationDone: id => openAll || !!profile().quests[id]?.done,
    canInquire: activity => openAll || !!profile()?.quests[activity.questId]?.done,
    onDispose: cleanup => { screenCleanup = cleanup; },
    onBeforeNavigate: guard => { screenBeforeNavigate = guard; },
    unitTitle: u => units[u].title,
    author: () => { const p = profile(); return p.name ? `${p.number}번 ${p.name}` : `${p.number}번`; },
};

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
    const saved = Object.entries(data.profiles).sort(([, a], [, b]) => a.number - b.number || a.name.localeCompare(b.name, 'ko'));
    const tab = ui.tab === 'help' ? 'help' : 'start';
    const selectTab = id => {
        if (tab !== id) go({ screen: 'welcome', tab: id, focusId: `tab-${id}` });
        else document.getElementById(`tab-${id}`).focus();
    };
    const tabButton = (id, label) => h('button', {
        type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': 'welcome-panel',
        'aria-selected': String(tab === id), tabindex: tab === id ? '0' : '-1', class: tab === id ? 'on' : '',
        onclick: () => selectTab(id),
        onkeydown: event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            selectTab(event.key === 'Home' ? 'start' : event.key === 'End' ? 'help' : id === 'start' ? 'help' : 'start');
        },
    }, label);
    const startPanel = [
        saved.length ? explorerCard(saved) : null,
        h('div', { class: 'card stack' },
            h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => go({ screen: 'register' }) }, '🙋 새 탐험가로 시작하기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => go({ screen: 'code' }) }, '💾 이어하기 코드로 계속하기'),
            installButton('btn btn-block')),
    ];
    const controls = h('div', { class: 'landing-start-controls' },
        h('div', { class: 'tabs', role: 'tablist', 'aria-label': '시작 화면' }, tabButton('start', '🚀 시작하기'), tabButton('help', '📖 사용법')),
        h('div', { id: 'welcome-panel', role: 'tabpanel', 'aria-labelledby': `tab-${tab}` },
            ...(tab === 'help' ? helpPanel() : startPanel)));
    if (tab === 'help') {
        mount(landingHeader(() => go({ screen: 'welcome' }), true),
            h('main', { id: 'landing-content', class: 'landing-help-content', tabindex: '-1' },
                h('h1', {}, '역사 탐험 사용법'), controls));
    } else {
        mount(...renderLanding({
            start: () => go({ screen: 'register' }),
            resume: profile() ? () => go({ screen: 'map' }) : null,
            hasSaved: saved.length > 0,
            code: () => go({ screen: 'code' }),
            help: () => go({ screen: 'welcome', tab: 'help' }),
            qr: showQr, startArea: controls, steps: GUIDE_STEPS,
        }));
    }
}

// 이 기기의 탐험가 목록. 공용 태블릿처럼 여러 명이면 이름·번호로 찾는 칸을 보여 줌
function explorerCard(saved) {
    const list = h('div', { class: 'explorer-list' }, ...saved.map(([key, p]) => h('button', {
        type: 'button', 'data-find': `${p.name} ${p.number}번`,
        onclick: async () => { data.current = key; if (await persist()) go({ screen: 'map' }); },
    }, h('span', { class: 'av' }, p.avatar), whoName(p), p.name ? h('span', { class: 'small muted' }, `${p.number}번`) : null)));
    let search = null;
    if (saved.length > 8) {
        const empty = h('p', { class: 'small muted hidden', style: 'margin-top:8px' }, '찾는 탐험가가 없어요. 처음이라면 아래 🙋 새 탐험가로 시작하기를 눌러요.');
        search = h('div', {}, h('input', {
            class: 'name-input', type: 'search', placeholder: '🔎 내 이름이나 번호로 찾기', 'aria-label': '탐험가 찾기', autocomplete: 'off',
            oninput: e => {
                const q = e.target.value.replace(/\s+/g, '');
                let shown = 0;
                [...list.children].forEach(btn => {
                    const hit = !q || btn.dataset.find.replace(/\s+/g, '').includes(q);
                    btn.classList.toggle('hidden', !hit);
                    if (hit) shown++;
                });
                empty.classList.toggle('hidden', shown > 0);
            },
        }), empty);
    }
    return h('div', { class: 'card' },
        h('h2', { style: 'margin-bottom:12px' }, '이 기기의 탐험가'),
        search ? h('div', { style: 'margin-bottom:12px' }, search) : null,
        list);
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
            list(['**📰 역사 신문 · 편지** — 단원을 마치면 열려요. 신문 기사나 역사 인물에게 보내는 편지를 문장 틀로 써서 노트에 모으고 인쇄할 수 있어요.',
                '**🔁 복습 상자** — 개념 도전에서 헷갈린 개념은 다음 날 지도 위쪽에 나와요. 하루 지나 다시 풀면 오래 기억해요.',
                '**🗺️ 문화유산 지도** — 배운 유적이 있는 곳이 지도에 나타나요. 점을 눌러 다시 살펴보고, **🎯 지도에서 찾기** 문제도 풀어요.',
                '**🧑‍🤝‍🧑 인물 도감** — 정거장을 마치면 그 시대 인물이 "나는 누구일까요?" 단서를 들려줘요. 맞히면 인물 카드를 모아요.',
                '**⏳ 연표 잇기** — 단원의 정거장을 모두 마치면 열려요. 사건 카드를 일어난 순서대로 눌러 연표를 만들어요. 10개 정거장을 다 마치면 **큰 연표**도 열려요.'])),
        section('🔘 버튼 알아보기',
            list(['**🏠** — 시작 화면으로 가요.',
                '**🗺️ 지도** — 탐험 지도로 돌아가요.',
                '**오른쪽 위 내 이름** — 이름 바꾸기, 이어하기 코드, 다른 탐험가로 바꾸기',
                '**📲 앱 설치** — 홈 화면에 아이콘을 만들어 바로 열어요. 인터넷이 끊겨도 탐험할 수 있어요.'])),
        h('details', { class: 'card help-card teacher' },
            h('summary', {}, '👩‍🏫 선생님께'),
            h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin:4px 0 12px', onclick: showQr }, '📺 교실 화면에 QR 코드 띄우기'),
            list(['앱 주소를 QR 코드로 보여 주기만 하면 돼요. 회원 가입·로그인이 없고, 진행·채점·피드백은 앱이 해요.',
                '정거장 하나는 **20~25분**쯤 걸려요(10개 정거장). 빨리 끝낸 학생은 **🎒 더 탐험하기**와 단원 마무리 활동을 하면 돼요.',
                '기록은 **그 기기에만** 저장되고 어디로도 보내지 않아요. 학생의 **📒 나의 역사 노트** 맨 위에 진도 요약이 있어 확인하거나 인쇄·PDF로 받을 수 있어요.',
                '여러 반이 태블릿을 함께 써도 **이름과 번호**로 구분되어 기록이 섞이지 않아요. 학생은 시작 화면에서 자기 이름을 눌러 들어가요.',
                '아이패드·아이폰은 7일 넘게 안 열면 기록이 지워질 수 있어요. **📲 앱 설치**를 해 두고, 수업 끝에 **💾 이어하기 코드**를 공책에 적게 해 주세요.',
                '교과서 출판사와 관계없이 5학년 2학기 역사(선사 시대~6·25 전쟁)의 핵심 내용으로 만들었어요. 용어·연도는 쓰시는 교과서와 한 번 대조해 주세요.',
                '화면 위쪽에 **오프라인 준비 완료**가 표시되면 인터넷 없이 탐험할 수 있어요. 준비 중이거나 실패했다면 인터넷 연결을 유지하고 **다시 준비하기**를 눌러 주세요. **iOS 14 이상**이나 최신 **크롬·웨일·삼성 인터넷·엣지**에서 열려요.',
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
        type: 'button', class: i === 0 ? 'on' : '', 'aria-label': `캐릭터 ${a}`, 'aria-pressed': String(i === 0),
        onclick: e => {
            avatar = a;
            [...avGrid.children].forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
            e.currentTarget.classList.add('on');
            e.currentTarget.setAttribute('aria-pressed', 'true');
        },
    }, a)));
    const startBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true }, '🚀 탐험 시작!');
    startBtn.addEventListener('click', async () => {
        const name = cleanName(nameEl.value);
        if (!number || !name) return;
        const key = findProfileKey(number, name);
        if (key === false) return;
        const existing = key && data.profiles[key];
        if (existing && existing.name && !confirm(`${number}번 ${existing.name} 탐험가가 이미 이 기기에 있어요.\n그 기록으로 이어서 할까요? (취소를 누르면 이름이나 번호를 다시 고를 수 있어요)`)) return;
        if (existing) { existing.name = name; data.current = key; }
        else { data.current = newProfileKey(number, name); data.profiles[data.current] = newProfile(number, avatar, name); }
        if (!await persist()) return;
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
    const submit = async () => {
        const result = decodeProgress(input.value, questOrder, avatars);
        // 글자를 잘못 옮겨 적어 우연히 맞는 코드가 되어도 없는 번호(41번 이상)면 받지 않음
        if (!result || result.number > MAX_NUMBER) {
            msg.replaceChildren(h('div', { class: 'feedback bad' }, '코드가 맞지 않아요. 글자를 다시 확인해 주세요.'));
            return;
        }
        const name = cleanName(nameEl.value);
        // 번호만으로는 다른 반 학생을 구별할 수 없으므로, 이 기기에 한 명만 있어도 이름을 꼭 받음
        if (!name) {
            msg.replaceChildren(h('div', { class: 'feedback bad' }, '내 이름도 써 주세요.'));
            nameEl.focus();
            return;
        }
        let key = findProfileKey(result.number, name);
        if (key === false) return;
        const existing = key && data.profiles[key];
        if (!key) key = newProfileKey(result.number, name);
        const merged = existing || newProfile(result.number, result.avatar);
        merged.avatar = result.avatar;
        if (name) merged.name = name;
        // 코드에 담긴 진도가 더 앞서 있을 때만 덮어씀
        Object.entries(result.quests).forEach(([id, q]) => {
            const cur = merged.quests[id];
            if (!cur || (!cur.done && (q.done || q.stage > cur.stage))) {
                merged.quests[id] = { ...q, notes: cur?.notes || [], mastery: q.mastery ? { ...cur?.mastery, ...q.mastery } : cur?.mastery || null };
            } else if (q.mastery?.passed && !cur.mastery?.passed && cur.stage >= 4) {
                cur.mastery = { ...cur.mastery, passed: true };
            }
        });
        data.profiles[key] = merged;
        data.current = key;
        if (!await persist()) return;
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

// 교실 TV·전자칠판에 띄울 큰 QR 코드
function showQr() {
    const url = 'https://gmlduqzhd123-lab.github.io/History/';
    const close = modal(
        h('div', { class: 'center' },
            h('h2', {}, '📱 카메라로 찍어서 들어와요'),
            h('img', { class: 'qr-big', src: 'icons/qr.svg', alt: `역사 탐험 퀘스트 주소 QR 코드 (${url})` }),
            h('p', { class: 'qr-url' }, url.replace('https://', '')),
            h('p', { class: 'small muted' }, '들어온 뒤 🙋 새 탐험가로 시작하기 → 이름·번호·캐릭터를 골라요.')),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:12px', onclick: () => close() }, '닫기'),
    );
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
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => {
                close();
                const next = { screen: 'welcome' };
                navigateAfterGuard(next, async () => { data.current = null; if (await persist()) go(next, true); });
            } }, '🔄 다른 탐험가로 바꾸기'),
            h('button', { class: 'btn btn-block danger-link', type: 'button', onclick: () => { close(); deleteProfile(); } }, '🗑️ 이 기기에서 내 기록 지우기'),
            h('button', { class: 'btn btn-block', type: 'button', onclick: () => close() }, '닫기')),
    );
}

// 새 학년이 되어 공용 태블릿을 정리할 때 등. 실수로 지우지 않게 두 번 확인
async function deleteProfile() {
    const p = profile();
    const who = `${p.number}번 ${p.name || ''}`.trim();
    if (!confirm(`${who} 탐험가의 기록을 이 기기에서 지울까요?\n도장, 한 줄 정리, 인물 카드 등이 모두 사라지고 되돌릴 수 없어요.`)) return;
    if (!confirm(`정말 지울까요? 이어하기 코드를 적어 두었다면 진도는 코드로 되살릴 수 있어요.\n(코드: ${encodeProgress(p, questOrder, avatars)})`)) return;
    const key = data.current;
    const previousProfiles = data.profiles;
    delete data.profiles[key];
    data.current = null;
    if (!await persist(true, '⚠️ 기록을 지우지 못했어요. 기록은 그대로 남아 있어요. 다시 시도해 주세요.')) {
        // 저장소 오류 때만 되돌림. 다른 창에서 바뀐 최신 기록은 덮어쓰지 않음.
        if (data.profiles === previousProfiles) {
            data.profiles[key] = p;
            data.current = key;
        } else {
            // 기다리는 동안 다른 창이 저장했으면 최신 객체로 현재 학생과 화면을 다시 연결함.
            // 다른 창에서 지운 기록은 되살리지 않음.
            data.current = Object.prototype.hasOwnProperty.call(data.profiles, key) ? key : null;
            go({ screen: profile() ? 'map' : 'welcome' }, true);
        }
        return;
    }
    discardWritingDrafts(key, p);
    discardInquiryDrafts(key, p);
    toast('🗑️ 기록을 지웠어요.');
    go({ screen: 'welcome' }, true);
}

function showRename() {
    const key = data.current;
    const p = profile();
    const nameEl = nameInput(p.name);
    const feedback = h('p', { class: 'muted small', role: 'status', 'aria-live': 'polite', style: 'margin-top:8px' });
    const save = async () => {
        if (profile() !== p) return;
        const name = cleanName(nameEl.value);
        if (!name) return nameEl.focus();
        if (Object.entries(data.profiles).some(([key, other]) => key !== data.current && other.number === p.number && other.name === name)) {
            toast('이 번호에 같은 이름의 탐험가가 있어요. 구별할 수 있는 이름을 써 주세요.');
            return nameEl.focus();
        }
        const previousName = p.name;
        p.name = name;
        feedback.textContent = '';
        if (!await persist(true, '⚠️ 이름을 저장하지 못했어요. 이전 이름은 그대로 남아 있어요. 다시 시도해 주세요.')) {
            // 저장 실패 때만 되돌림. 다른 창의 최신 기록은 덮어쓰지 않음.
            if (data.profiles[key] === p) {
                p.name = previousName;
                feedback.textContent = '이름을 저장하지 못했어요. 이전 이름은 그대로 남아 있어요. 다시 시도해 주세요.';
                nameEl.focus();
            }
            return;
        }
        close();
        render();
    };
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) save(); });
    const close = modal(
        h('h2', { style: 'margin-bottom:12px' }, '✏️ 이름 바꾸기'),
        nameEl,
        feedback,
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
        h('p', { class: 'small muted', style: 'margin-top:10px' }, '※ 이름과 쓴 글·자료 탐구 기록은 코드에 담기지 않고 이 기기에만 남아요.'),
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
        reviewCard(),
        ...units.map((unit, u) => h('section', { class: 'unit' },
            h('h2', { class: 'unit-title' }, `📚 ${unit.title}`),
            h('div', { class: 'path' }, ...unit.stations.map(station => stationButton(station))),
            unitExtras(u)),
        ),
        moreCard(),
    );
}

// 마무리 활동은 단원 완료 후, 자료 탐구는 관련 정거장 완료 후 열림
function unitExtras(u) {
    const tl = timelines.find(t => t.unit === u);
    const wr = writingFor(tl.key); // 단원 열쇠 (u1, u2, u3) 가 연표와 같음
    const investigations = inquiries.filter(activity => activity.unit === u);
    return h('div', { class: 'unit-extras' },
        extraButton('⏳', '연표 잇기', unitDone(u), !!extrasOf(profile()).timeline[tl.key]?.done,
            () => go({ screen: 'timeline', key: tl.key }), '이 단원의 정거장을 모두 마치면 열려요.'),
        wr ? extraButton('📰', '역사 신문 · 편지', unitDone(u), !!extrasOf(profile()).writings[wr.key],
            () => go({ screen: 'writing', key: wr.key }), '이 단원의 정거장을 모두 마치면 열려요.') : null,
        investigations.length ? extraButton('🔎', '자료 탐구 · 역사 일기', true,
            investigations.every(activity => !!extrasOf(profile()).inquiries[activity.id]),
            () => go({ screen: 'inquiry', unit: u }), '관련 정거장을 마친 뒤 자료를 읽고 내 생각을 기록해요.') : null);
}

function renderInquiryScreen() {
    if (!Number.isInteger(ui.unit) || !inquiries.some(activity => activity.unit === ui.unit)) return go({ screen: 'map' });
    renderInquiry({ ...env, persist: () => persist(true) }, ui.unit, ui.id);
}

function renderWritingScreen() {
    const set = writingFor(ui.key);
    if (!set || !unitDone(set.unit)) return go({ screen: 'map' });
    renderWriting(env, ui.key, ui.opt);
}

// 오늘 다시 풀 개념이 있으면 지도 위쪽에 복습 상자를 보여 줌
function reviewCard() {
    const due = dueItems(profile(), stations).length;
    if (!due) return null;
    return h('div', { class: 'card review-card' },
        h('h2', {}, '🔁 오늘의 복습 상자'),
        h('p', { style: 'margin:6px 0 12px' }, `지난번 개념 도전에서 헷갈린 개념 ${due}개가 기다려요. 먼저 ${Math.min(due, 3)}문제만 풀어 볼까요?`),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go({ screen: 'review' }) }, '복습 시작하기 ▶'));
}

// 지도 맨 아래 "더 탐험하기"
function moreCard() {
    const big = timelines.find(t => t.key === 'all');
    return h('section', { class: 'unit' },
        h('h2', { class: 'unit-title' }, '🎒 더 탐험하기'),
        h('div', { class: 'unit-extras' },
            reviewButton(),
            extraButton('🗺️', `문화유산 지도 (${visitedCount(profile())}/${placeCount()})`, openAll || stations.some(s => profile().quests[s.id]?.done),
                false, () => go({ screen: 'places' }), '정거장을 마치면 배운 유적이 지도에 나타나요.'),
            extraButton('🧑‍🤝‍🧑', `인물 도감 (${collectedCount(profile())}/${peopleCount()})`, openAll || stations.some(s => profile().quests[s.id]?.done),
                collectedCount(profile()) === peopleCount(), () => go({ screen: 'people' }), '정거장을 마치면 그 시대 인물을 만날 수 있어요.'),
            extraButton('⏳', '10개 정거장 큰 연표', allDone(), !!extrasOf(profile()).timeline[big.key]?.done,
                () => go({ screen: 'timeline', key: big.key }), '10개 정거장을 모두 마치면 열려요.')));
}

function reviewButton() {
    const due = dueItems(profile(), stations).length;
    const waiting = waitingCount(profile());
    return extraButton('🔁', due ? `복습 상자 (${due})` : '복습 상자', due > 0, false, () => go({ screen: 'review' }),
        waiting ? `오늘 헷갈린 개념 ${waiting}개는 내일 복습 상자에 들어가요.` : '개념 도전에서 헷갈린 개념은 다음 날 여기에서 다시 풀어요.');
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

    let completing = false;
    const ctx = {
        record: ui.replay ? { ...rec, notes: [...rec.notes] } : rec, // 복습 중에는 기록을 바꾸지 않음
        readingStage: quest.stages.find(s => s.type === 'reading'),
        reviewUpdate: (wrong, right) => {
            if (profile()?.quests[quest.id] !== rec) return false;
            updateReview(profile(), quest.id, wrong, right);
            return persist();
        },
        save: () => {
            if (profile()?.quests[quest.id] !== rec) return false;
            return ui.replay ? true : persist();
        },
        done: async () => {
            if (completing || profile()?.quests[quest.id] !== rec) return;
            completing = true;
            if (ui.replay) {
                const next = stageIndex + 1;
                return go(next < quest.stages.length ? { ...ui, stageIndex: next } : { screen: 'quest', questId: quest.id, replay: false });
            }
            rec.stage = stageIndex + 1;
            if (rec.stage >= quest.stages.length) { rec.done = true; rec.doneAt = Date.now(); }
            if (!await persist()) return;
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
            h('p', { class: 'small', style: 'margin:-4px 0 12px' }, '아직 시간이 있다면 ⏳ 큰 연표와 🎒 더 탐험하기(인물 도감, 문화유산 지도)에 도전해 보세요.'),
            h('div', { class: 'row', style: 'justify-content:center' },
                h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go({ screen: 'notes' }) }, '📒 나의 역사 노트 보기'),
                h('button', { class: 'btn', type: 'button', onclick: () => go({ screen: 'timeline', key: 'all' }) }, '⏳ 큰 연표 잇기'))) : null,
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
            progressSummary(p),
            h('button', { class: 'btn btn-small no-print', type: 'button', onclick: () => window.print() }, '🖨️ 인쇄하기 / PDF로 저장')),
        ...['u1', 'u2', 'u3'].filter(k => extrasOf(p).writings[k]).map(k => h('div', { class: 'card' },
            h('h2', { style: 'margin-bottom:10px' }, `✍️ 나의 역사 글 — ${units[writingFor(k).unit].title}`),
            writingView(extrasOf(p).writings[k], env.author()))),
        ...inquiries.filter(activity => extrasOf(p).inquiries[activity.id]).map(activity => h('div', { class: 'card' },
            inquiryView(extrasOf(p).inquiries[activity.id], activity))),
        collectedCount(p) ? h('div', { class: 'card' },
            h('h2', { style: 'margin-bottom:10px' }, `🧑‍🤝‍🧑 내가 만난 인물 (${collectedCount(p)} / ${peopleCount()})`),
            h('p', {}, people.filter(x => extrasOf(p).people[x.id]).map(x => `${x.emoji} ${x.name}`).join(' · '))) : null,
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

// 노트 맨 위 진도 요약 (선생님이 한눈에 확인하거나 인쇄해서 받을 수 있게)
function progressSummary(p) {
    const ex = extrasOf(p);
    const stamps = stations.filter(s => p.quests[s.id]?.done).length;
    const passed = stations.filter(s => p.quests[s.id]?.mastery?.passed).length;
    const rows = [
        ['🏅', '정거장 도장', `${stamps} / ${stations.length}`],
        ['🏆', '개념 도전 통과', `${passed} / ${stations.length}`],
        ['⏳', '연표 잇기', `${timelines.filter(t => ex.timeline[t.key]?.done).length} / ${timelines.length}`],
        ['📰', '역사 신문 · 편지', `${Object.keys(ex.writings).length} / 3`],
        ['🔎', '자료 탐구 · 역사 일기', `${inquiries.filter(activity => ex.inquiries[activity.id]).length} / ${inquiries.length}`],
        ['🧑‍🤝‍🧑', '인물 카드', `${collectedCount(p)} / ${peopleCount()}`],
        ['🗺️', '문화유산 지도', `${visitedCount(p)} / ${placeCount()}`],
    ];
    return h('div', { class: 'progress-summary' }, ...rows.map(([e, label, value]) =>
        h('div', { class: 'ps-item' }, h('span', { class: 'ps-emoji', 'aria-hidden': 'true' }, e), h('span', { class: 'ps-label' }, label), h('b', {}, value))));
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
    } else if (/Whale/i.test(ua)) {
        steps = ['**웨일** 주소창 오른쪽의 **설치 아이콘(⊕)** 을 눌러요.', '아이콘이 없으면 오른쪽 위 **⋯ 메뉴**에서 **앱 설치** 또는 **홈 화면에 추가**를 찾아요.', '설치한 뒤에는 웨일북 앱 목록이나 바탕 화면에서 바로 열 수 있어요.'];
    } else if (/Android/i.test(ua)) {
        steps = ['**Chrome** 또는 **삼성 인터넷**으로 열어요.', '오른쪽 위(또는 아래) **⋮ / ≡ 메뉴**를 눌러요.', '**앱 설치** 또는 **홈 화면에 추가**를 눌러요.'];
    } else {
        steps = ['**Chrome**, **웨일**, **Edge** 가운데 하나로 열어요.', '주소창 오른쪽의 **설치 아이콘**을 누르거나, **⋮ 메뉴 → 앱 설치**를 눌러요.', 'Edge는 **⋯ 메뉴 → 앱 → 이 사이트를 앱으로 설치**예요.'];
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

// 모든 필수 파일을 저장한 서비스 워커가 활성화되었을 때만 준비 완료를 안내한다.
prepareOffline(toast);
