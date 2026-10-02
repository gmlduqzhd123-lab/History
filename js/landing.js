// 소개 화면. 학습 기록과 화면 전환은 기존 앱이 관리한다.
import { h } from './dom.js';
import { art } from './art.js';
import { units, stations } from '../content/quests.js';
import { inquiries } from '../content/inquiries.js';

const arrow = () => h('span', { 'aria-hidden': 'true' }, '↗');
const eyebrow = text => h('p', { class: 'landing-eyebrow' }, text);
const button = (text, action, secondary = false) => h('button', {
    type: 'button', class: `landing-button${secondary ? ' landing-button-secondary' : ''}`, onclick: action,
}, text, arrow());

export function landingHeader(start, compact = false) {
    return h('header', { class: 'landing-header' },
        h('a', { class: 'landing-brand', href: '#landing-content' },
            h('img', { src: 'icons/icon.svg', width: '40', height: '40', alt: '' }),
            h('span', {}, '역사 탐험 퀘스트', h('small', {}, '엽쌤스쿨 · HISTORY QUEST'))),
        !compact ? h('nav', { 'aria-label': '메인 메뉴' },
            h('a', { href: '#learning' }, '앱 소개'),
            h('a', { href: '#video-guide' }, '사용법 영상'),
            h('a', { href: '#curriculum' }, '학습 여정'),
            h('a', { href: '#classroom' }, '선생님께')) : null,
        button(compact ? '소개 화면으로' : '탐험 시작', start, true));
}

function preview() {
    return h('div', { class: 'landing-preview', 'aria-label': '고려 정거장의 유물 탐정 활동 미리보기' },
        h('div', { class: 'landing-preview-top' },
            h('span', { class: 'landing-preview-live' }, h('i', { 'aria-hidden': 'true' }), '탐험 미리보기'),
            h('span', {}, '정거장 05 / 10')),
        h('div', { class: 'landing-artifact' },
            h('span', { class: 'landing-orbit landing-orbit-one', 'aria-hidden': 'true' }),
            h('span', { class: 'landing-orbit landing-orbit-two', 'aria-hidden': 'true' }),
            h('div', { class: 'landing-artifact-picture', html: art.celadonVase }),
            h('div', { class: 'landing-artifact-label' }, h('span', {}, '고려의 빛깔'), h('strong', {}, '상감 청자')),
            h('span', { class: 'landing-stamp', 'aria-hidden': 'true' }, '관찰', h('b', {}, '발견!'))),
        h('div', { class: 'landing-preview-question' },
            h('span', { class: 'landing-preview-step' }, '01 · 유물 탐정'),
            h('p', {}, '이 유물에는 어떤 이야기가 담겨 있을까요?'),
            h('div', { class: 'landing-preview-progress', 'aria-hidden': 'true' },
                ...Array.from({ length: 5 }, (_, i) => h('span', { class: i === 0 ? 'active' : '' }))),
            h('span', { class: 'landing-preview-caption' }, '살펴보고, 생각하고, 내 말로 기록해요.')),
        h('div', { class: 'landing-note' }, h('span', { 'aria-hidden': 'true' }, '✦'),
            h('div', {}, h('strong', {}, '발견이 배움이 되는 순간'), h('span', {}, '나만의 역사 노트에 차곡차곡'))));
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

export function renderLanding({ start, resume, hasSaved, code, help, qr, startArea, steps }) {
    const features = [
        ['01', '유물에서 시작하는 호기심', '단서를 따라 유물을 추리하고, 짧은 이야기로 그 시대 사람들의 삶을 만나요.', '⌕'],
        ['02', '내 속도로 완성하는 탐험', '힌트와 읽어 주기의 도움을 받아 도전해요. 정거장을 마칠 때마다 다음 여정이 열려요.', '↗'],
        ['03', '생각이 남는 역사 노트', '자료를 근거로 탐구하고 역사 일기를 써요. 나의 정리와 결과물을 모아 인쇄할 수 있어요.', '▤'],
    ];
    const unitDescriptions = [
        '돌도구에서 고려청자까지, 새로운 나라와 문화를 만나요.',
        '조선 사람들의 생활에서 근대 문물의 등장까지 살펴봐요.',
        '독립을 위한 노력과 광복, 전쟁 속 사람들의 삶을 배워요.',
    ];
    const faqs = [
        ['회원 가입이 필요한가요?', '회원 가입이나 로그인 없이 시작해요. 이름·번호·캐릭터를 고르면 나만의 탐험 기록이 만들어져요.'],
        ['어떤 기기에서 사용할 수 있나요?', '컴퓨터, 태블릿, 휴대전화에서 사용할 수 있어요. iOS 14 이상 또는 최신 크롬·웨일·삼성 인터넷·엣지로 열어 주세요.'],
        ['학습 기록은 어디에 저장되나요?', '이름과 작성한 글은 현재 기기에만 저장돼요. 다른 기기로 옮길 때 이어하기 코드는 진도만 옮기며, 작성한 글과 자료 탐구 기록은 옮기지 않아요. 중요한 글은 역사 노트를 인쇄하거나 PDF로 보관해 주세요.'],
        ['인터넷이 없어도 사용할 수 있나요?', '인터넷에 연결해 앱을 처음 열고 필요한 파일이 모두 저장되면 오프라인에서도 학습할 수 있어요. 홈 화면에 앱을 설치해 두면 다시 찾아오기 편해요.'],
    ];
    return [
        h('a', { class: 'landing-skip', href: '#landing-content' }, '본문으로 건너뛰기'),
        landingHeader(resume || start),
        h('main', { id: 'landing-content', tabindex: '-1' },
            h('section', { class: 'landing-hero hero', 'aria-labelledby': 'landing-title' },
                h('div', { class: 'landing-hero-copy' },
                    eyebrow('초등 5학년 2학기 사회 · 자기주도 역사 학습'),
                    h('h1', { id: 'landing-title' }, '역사를 만나고,', h('br'), h('span', {}, '내 이야기를', h('br'), '써 내려가요.')),
                    h('p', { class: 'landing-lead' }, '유물 속 단서를 찾고, 그 시대를 살아 보고,', h('br', { class: 'landing-desktop-break' }),
                        ' 내 생각을 기록하는 특별한 시간 여행.', h('br'), '교실에서도 집에서도, 나의 속도로 탐험해요.'),
                    h('div', { class: 'landing-hero-actions' }, button(resume ? '내 탐험 이어가기' : '탐험 시작하기', resume || start),
                        h('a', { class: 'landing-text-link', href: '#classroom' }, '선생님을 위한 안내', arrow())),
                    h('p', { class: 'landing-reassurance' }, h('span', { 'aria-hidden': 'true' }, '✓'), ' 회원 가입 없이 · PC와 태블릿, 휴대전화에서'),
                    h('div', { class: 'landing-resume-line' },
                        h('a', { href: '#video-guide' }, '사용법 영상 보기 →'),
                        hasSaved ? h('a', { href: '#start' }, '이 기기의 기록 찾기 →') : null,
                        h('button', { type: 'button', onclick: code }, '코드로 이어하기 →'))),
                preview()),
            h('dl', { class: 'landing-stats', 'aria-label': '학습 구성' },
                ...[[String(units.length).padStart(2, '0'), '시대별 단원'], [String(stations.length), '역사 정거장'],
                    [String(steps.length), '정거장별 학습 단계'], [String(inquiries.length).padStart(2, '0'), '자료 탐구·역사 일기']]
                    .map(([n, text]) => h('div', {}, h('dt', {}, text), h('dd', {}, n, h('span', {}, '개'))))),
            videoGuide(),
            h('section', { class: 'landing-section', id: 'learning', 'aria-labelledby': 'landing-learning-title' },
                h('div', { class: 'landing-section-heading' },
                    h('div', {}, eyebrow('배움의 방식'), h('h2', { id: 'landing-learning-title' }, '외우는 역사에서,', h('br'), '발견하는 역사로.')),
                    h('p', {}, '작은 호기심이 탐험의 시작이 됩니다.', h('br'), '한 번의 탐험이 나만의 배움으로 남도록.')),
                h('div', { class: 'landing-feature-grid' }, ...features.map(([n, title, description, icon]) =>
                    h('article', { class: 'landing-feature' }, h('div', { class: 'landing-feature-top' },
                        h('span', {}, n), h('span', { class: 'landing-feature-icon', 'aria-hidden': 'true' }, icon)),
                    h('h3', {}, title), h('p', {}, description)))),
                h('div', { class: 'landing-process' },
                    h('p', {}, h('strong', {}, '한 정거장, 다섯 번의 발견'), h('span', {}, '차근차근 따라가면 어느새 내 이야기가 돼요.')),
                    h('ol', {}, ...steps.map(([emoji, title], i) => h('li', {},
                        h('span', { 'aria-hidden': 'true' }, emoji), h('span', {}, title), h('small', {}, `0${i + 1}`)))))),
            h('section', { class: 'landing-section landing-curriculum', id: 'curriculum', 'aria-labelledby': 'landing-curriculum-title' },
                h('div', { class: 'landing-section-heading' }, h('div', {}, eyebrow('열 개의 정거장'),
                    h('h2', { id: 'landing-curriculum-title' }, '시간을 따라, 이야기 속으로.')),
                    h('p', {}, '선사 시대부터 6·25 전쟁까지', h('br'), '교과서의 핵심 내용을 시대 순서로 만나요.')),
                h('div', { class: 'landing-unit-grid' }, ...units.map((unit, i) =>
                    h('article', { class: `landing-unit landing-unit-${i + 1}` },
                        h('div', { class: 'landing-unit-top' }, h('span', {}, `여정 0${i + 1}`),
                            h('span', {}, `${unit.stations.length}개 정거장`)),
                        h('div', { class: 'landing-unit-art', html: art[['combPot', 'hunminBook', 'taegukgi'][i]], 'aria-hidden': 'true' }),
                        h('h3', {}, unit.title), h('p', {}, unitDescriptions[i]),
                        h('ul', {}, ...unit.stations.map(station => h('li', {}, station.name))))))),
            h('section', { class: 'landing-classroom', id: 'classroom', 'aria-labelledby': 'landing-classroom-title' },
                h('div', { class: 'landing-classroom-copy' }, eyebrow('선생님을 위한 교실 안내'),
                    h('h2', { id: 'landing-classroom-title' }, '준비는 가볍게,', h('br'), '배움은 깊이 있게.'),
                    h('p', {}, '주소 하나, QR 코드 하나로 함께 시작하세요.', h('br'), '학생은 스스로 탐험하고, 선생님은 질문과 생각에 집중해요.'),
                    button('교실 QR 코드 띄우기', qr),
                    h('button', { type: 'button', class: 'landing-classroom-guide', onclick: help }, '자세한 사용법 보기', arrow())),
                h('ol', { class: 'landing-teacher-steps' },
                    ...[['01', '공유하고 바로 시작', '앱 주소나 QR 코드를 공유하세요. 학생은 이름·번호·캐릭터를 고르면 준비 끝.'],
                        ['02', '우리 반에 맞는 학습', '정거장 하나는 약 20~25분. 먼저 마친 학생은 인물 도감·문화유산 지도·자료 탐구로 배움을 넓혀요.'],
                        ['03', '역사 노트로 배움 확인', '학생의 노트에서 진도와 작성한 글을 확인하고, 인쇄·PDF로 결과물을 모아요.']]
                        .map(([n, title, text]) => h('li', {}, h('span', {}, n), h('div', {}, h('h3', {}, title), h('p', {}, text)))))),
            h('section', { class: 'landing-section landing-faq', 'aria-labelledby': 'landing-faq-title' },
                h('div', {}, eyebrow('궁금한 점'), h('h2', { id: 'landing-faq-title' }, '시작 전에 살펴보세요.')),
                h('div', {}, ...faqs.map(([question, answer]) => h('details', {}, h('summary', {}, question), h('p', {}, answer))))),
            h('section', { class: 'landing-start', id: 'start', 'aria-labelledby': 'landing-start-title' },
                h('div', { class: 'landing-start-heading' }, eyebrow('나의 첫 역사 탐험'),
                    h('h2', { id: 'landing-start-title' }, '다음 발견의 주인공은 바로 나!'),
                    h('p', {}, '처음이라면 새 탐험가로, 이미 탐험했다면 내 기록으로 시작해요.')),
                startArea)),
        h('footer', { class: 'landing-footer' }, h('div', {}, h('strong', {}, '역사 탐험 퀘스트'),
            h('p', {}, '아이들의 호기심이 배움으로 이어지도록.')), h('div', {},
            h('a', { href: 'https://gmlduqzhd123-lab.github.io/YScode/' }, '엽쌤의 다른 앱 보기 ↗'),
            h('small', {}, '© 2026 엽쌤. All rights reserved.'))),
    ];
}
