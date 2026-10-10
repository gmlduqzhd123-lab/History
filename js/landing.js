// 소개 화면. 학습 기록과 화면 전환은 기존 앱이 관리한다.
import { h } from './dom.js';
import { art } from './art.js';
import { units, stations } from '../content/quests.js';

const arrow = () => h('span', { 'aria-hidden': 'true' }, '↗');
const eyebrow = text => h('p', { class: 'landing-eyebrow' }, text);
const button = (text, action, secondary = false) => h('button', {
    type: 'button', class: `landing-button${secondary ? ' landing-button-secondary' : ''}`, onclick: action,
}, text, arrow());

export function landingHeader(start, compact = false, { install = null, qr = null } = {}) {
    return h('header', { class: 'landing-header' },
        h('a', { class: 'landing-brand', href: '#landing-content' },
            h('img', { src: 'icons/icon.svg', width: '36', height: '36', alt: '' }),
            h('span', {}, '역사 탐험 퀘스트', h('small', {}, 'HISTORY QUEST'))),
        !compact ? h('nav', { 'aria-label': '메인 메뉴' },
            h('a', { href: '#learning' }, '배움 방법'),
            h('a', { href: '#curriculum' }, '10개 정거장'),
            h('a', { href: '#video-guide' }, '사용법 영상'),
            h('a', { href: '#classroom' }, '선생님께')) : null,
        !compact && (install || qr) ? h('div', { class: 'landing-header-actions' },
            install ? h('button', { type: 'button', class: 'landing-chip landing-chip-primary', onclick: install }, '📲 앱 설치') : null,
            qr ? h('button', { type: 'button', class: 'landing-chip', 'aria-label': 'QR 코드로 접속', onclick: qr }, '📱 QR') : null) : null,
        compact ? button('소개 화면으로', start, true) : null);
}

function videoGuide() {
    const guideSteps = [
        ['나만의 탐험가 만들기', '이름·번호·캐릭터를 고르고 탐험을 시작해요.'],
        ['열린 정거장 탐험하기', '유물 탐정·이야기 카드·생활 체험·개념 도전·한 줄 정리의 다섯 단계를 따라가요.'],
        ['자료 탐구와 역사 일기', '자료에서 찾은 근거와 그 시대 사람의 생각을 내 말로 기록해요.'],
        ['역사 노트로 모아 보기', '진도와 작성한 글을 확인하고, 인쇄하거나 PDF로 보관해요.'],
        ['내 기록으로 이어가기', '같은 기기에서 내 탐험가를 선택해요. 다른 기기의 이어하기 코드는 진도만 옮겨요.'],
    ];
    const errorMessage = h('p', { class: 'landing-video-error', role: 'status', 'aria-live': 'polite' });
    const fallback = h('div', { class: 'landing-video-fallback', hidden: true });
    const showError = () => {
        errorMessage.textContent = '영상을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 재생하거나, 영상 파일을 직접 열어 주세요.';
        fallback.hidden = false;
    };
    const cover = h('button', {
        type: 'button', class: 'landing-video-cover',
        'aria-label': '45초 사용법 영상 재생하기', 'aria-describedby': 'landing-video-note',
    },
    h('img', { src: 'media/history-quest-guide-poster.jpg', width: '1280', height: '720', alt: '' }),
    h('span', { class: 'landing-video-cover-action' },
        h('span', { class: 'landing-video-cover-icon', 'aria-hidden': 'true' }, '▶'),
        h('span', {}, '45초 사용법 영상 보기')));
    let started = false;
    const video = h('video', {
        controls: true, playsinline: true, preload: 'none',
        poster: 'media/history-quest-guide-poster.jpg', width: '1280', height: '720', tabindex: '-1',
        'aria-label': '역사 탐험 퀘스트 사용법 영상', 'aria-describedby': 'landing-video-note', 'aria-hidden': 'true',
        onerror: showError,
        onplay: () => {
            cover.hidden = true;
            video.tabIndex = 0;
            video.removeAttribute('aria-hidden');
            if (!started) video.focus({ preventScroll: true });
            started = true;
        },
        onloadeddata: () => { errorMessage.textContent = ''; fallback.hidden = true; },
    },
    h('source', { src: 'media/history-quest-guide.mp4', type: 'video/mp4', onerror: showError }),
    h('track', {
        kind: 'captions', src: 'media/history-quest-guide.ko.vtt', srclang: 'ko', label: '한국어', default: true,
    }),
    '영상이 재생되지 않으면 아래 글 안내를 따라 시작해 주세요.');
    const play = () => video.play().then(() => video.focus({ preventScroll: true })).catch(showError);
    cover.addEventListener('click', play);
    fallback.append(
        h('button', { type: 'button', onclick: () => { video.load(); play(); } }, '다시 재생하기'),
        h('a', { href: 'media/history-quest-guide.mp4', target: '_blank', rel: 'noopener' }, '영상 파일 열기', arrow()));
    return h('section', { class: 'landing-section landing-video-guide', id: 'video-guide', 'aria-labelledby': 'landing-video-title' },
        h('div', { class: 'landing-section-heading' },
            h('div', {}, eyebrow('처음이라면, 영상으로 한눈에'),
                h('h2', { id: 'landing-video-title' }, '역사 탐험,', h('br'), '이렇게 시작해요.')),
            h('p', {}, '45초 사용법 영상으로', h('br'), '시작부터 기록 확인까지 살펴보세요.')),
        h('div', { class: 'landing-video-layout' },
            h('figure', { class: 'landing-video-player' },
                h('div', { class: 'landing-video-frame' }, video, cover),
                h('figcaption', { id: 'landing-video-note' }, '경쾌한 배경음악과 효과음이 함께해요. 음소거해도 화면 안내와 한국어 자막으로 따라갈 수 있어요.',
                    h('span', {}, '처음 영상을 볼 때는 인터넷 연결이 필요해요.')),
                errorMessage, fallback),
            h('div', { class: 'landing-video-summary' },
                h('h3', { id: 'landing-video-steps-title' }, '영상 속 다섯 걸음'),
                h('ol', { 'aria-labelledby': 'landing-video-steps-title' },
                    ...guideSteps.map(([title, description], i) => h('li', {},
                        h('span', { 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
                        h('div', {}, h('strong', {}, title), h('p', {}, description))))))));
}

export function renderLanding({ resume, hasSaved, code, help, qr, install, startArea, steps }) {
    const unitArt = ['combPot', 'hunminBook', 'taegukgi'];
    const faqs = [
        ['회원 가입이 필요한가요?', '필요 없어요. 이름·번호·캐릭터를 고르면 바로 시작해요.'],
        ['학습 기록은 어디에 저장되나요?', '이 기기에만 저장돼요. 이어하기 코드는 진도만 옮기니, 쓴 글은 역사 노트를 인쇄하거나 PDF로 보관해 주세요.'],
        ['인터넷이 없어도 되나요?', '인터넷으로 한 번 열어 두면 그다음부터는 인터넷 없이도 탐험할 수 있어요.'],
        ['어떤 기기에서 되나요?', '컴퓨터·태블릿·휴대전화 모두 돼요. iOS 14 이상 또는 최신 크롬·웨일·삼성 인터넷·엣지로 열어 주세요.'],
    ];
    return [
        h('a', { class: 'landing-skip', href: '#landing-content' }, '본문으로 건너뛰기'),
        landingHeader(resume, false, { install, qr }),
        h('main', { id: 'landing-content', tabindex: '-1' },
            // 첫 화면: 왼쪽은 무엇인지 한 줄로, 오른쪽은 바로 시작하는 곳
            h('section', { class: 'landing-hero hero', 'aria-labelledby': 'landing-title' },
                h('div', { class: 'landing-hero-copy' },
                    eyebrow('초등 5학년 2학기 사회 · 역사'),
                    h('h1', { id: 'landing-title', tabindex: '-1' }, '유물로 떠나는', h('br'), h('span', {}, '시간 여행')),
                    h('p', { class: 'landing-lead' }, '선사 시대부터 6·25 전쟁까지,', h('br'), '10개 정거장을 내 속도로 탐험해요.'),
                    resume ? h('div', { class: 'landing-hero-actions' }, button('내 탐험 이어가기', resume)) : null),
                h('div', { class: 'landing-start', id: 'start' }, startArea),
                // 휴대폰에서는 시작 카드 다음에 오도록 따로 둠 (넓은 화면에서는 제목 아래)
                h('div', { class: 'landing-hero-meta' },
                    h('ul', { class: 'landing-facts', 'aria-label': '이용 안내' },
                        h('li', {}, '회원 가입 없이'), h('li', {}, '정거장마다 20분'), h('li', {}, '인터넷 없이도')),
                    h('div', { class: 'landing-resume-line' },
                        h('a', { href: '#video-guide' }, '사용법 영상 보기 →'),
                        hasSaved ? h('a', { href: '#start' }, '이 기기의 기록 찾기 →') : null,
                        h('button', { type: 'button', onclick: code }, '코드로 이어하기 →'))),
                ),
            h('section', { class: 'landing-section', id: 'learning', 'aria-labelledby': 'landing-learning-title' },
                h('div', { class: 'landing-section-heading' },
                    h('div', {}, eyebrow('배움 방법'),
                    h('h2', { id: 'landing-learning-title' }, '한 정거장, 다섯 걸음'))),
                h('ol', { class: 'landing-steps' }, ...steps.map(([emoji, title, description], i) => h('li', {},
                    h('span', { class: 'landing-step-no', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
                    h('span', { class: 'landing-step-emoji', 'aria-hidden': 'true' }, emoji),
                    h('strong', {}, title), h('p', {}, description))))),
            h('section', { class: 'landing-section', id: 'curriculum', 'aria-labelledby': 'landing-curriculum-title' },
                h('div', { class: 'landing-section-heading' },
                    h('div', {}, eyebrow(`${units.length}개 단원 · ${stations.length}개 정거장`),
                    h('h2', { id: 'landing-curriculum-title' }, '시대를 따라 걷는 길'))),
                h('div', { class: 'landing-unit-grid' }, ...units.map((unit, i) => h('article', { class: 'landing-unit' },
                    h('div', { class: 'landing-unit-art', html: art[unitArt[i]], 'aria-hidden': 'true' }),
                    h('div', {},
                        h('span', { class: 'landing-unit-no' }, `여정 ${i + 1} · ${unit.stations.length}개 정거장`),
                        h('h3', {}, unit.title),
                        h('p', {}, unit.stations.map(station => station.name).join(' · '))))))),
            videoGuide(),
            h('section', { class: 'landing-classroom', id: 'classroom', 'aria-labelledby': 'landing-classroom-title' },
                h('div', { class: 'landing-classroom-copy' },
                    eyebrow('선생님께'),
                    h('h2', { id: 'landing-classroom-title' }, 'QR 하나로 수업 준비 끝'),
                    h('p', {}, '학생은 스스로 탐험하고, 진도와 글은 역사 노트에서 확인해요.'),
                    h('div', { class: 'landing-classroom-actions' },
                        button('교실 QR 코드 띄우기', qr),
                        h('button', { type: 'button', class: 'landing-classroom-guide', onclick: help }, '자세한 사용법 보기', arrow()))),
                h('div', { class: 'landing-faq', role: 'group', 'aria-label': '자주 묻는 질문' },
                    ...faqs.map(([question, answer]) => h('details', {}, h('summary', {}, question), h('p', {}, answer)))))),
        h('footer', { class: 'landing-footer' },
            h('span', {}, '© 2026 엽쌤. All rights reserved.'),
            h('a', { href: 'https://gmlduqzhd123-lab.github.io/YScode/' }, '엽쌤의 다른 앱 보기 ↗')),
    ];
}
