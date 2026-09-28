// 탐험 지도: 5학년 2학기 사회(역사) 세 단원을 시대 순서대로 10개 정거장으로 나눔
// quest 가 연결된 정거장만 열리고, 없는 정거장은 '준비 중'으로 보임
import q1 from './q1-stone-age.js';
import q2 from './q2-bronze-gojoseon.js';
import q3 from './q3-three-kingdoms-gaya.js';
import q4 from './q4-unified-silla-balhae.js';
import q5 from './q5-goryeo.js';
import q6 from './q6-joseon-confucian.js';
import q7 from './q7-late-joseon.js';
import q8 from './q8-opening-modern.js';
import q9 from './q9-colonial-independence.js';
import q10 from './q10-liberation-korean-war.js';

export const units = [
    {
        title: '유적과 유물로 살펴본 옛사람들의 생활',
        stations: [
            { id: 'q1', emoji: '🪨', name: '구석기·신석기 시대', desc: '돌을 깨뜨리고 갈아서 도구를 만들다', quest: q1 },
            { id: 'q2', emoji: '🐻', name: '청동기 시대와 고조선', desc: '지배자가 나타나고 첫 나라가 세워지다', quest: q2 },
            { id: 'q3', emoji: '⚔️', name: '삼국과 가야', desc: '고구려·백제·신라·가야 사람들의 생활', quest: q3 },
            { id: 'q4', emoji: '🏯', name: '통일 신라와 발해', desc: '삼국 통일과 남북국의 문화', quest: q4 },
            { id: 'q5', emoji: '🏺', name: '고려', desc: '벽란도, 고려청자, 금속 활자', quest: q5 },
        ],
    },
    {
        title: '달라지는 시대, 변화하는 생활 모습',
        stations: [
            { id: 'q6', emoji: '📜', name: '조선의 유교 문화', desc: '유교가 바꾼 생각과 생활', quest: q6 },
            { id: 'q7', emoji: '🎨', name: '조선 후기의 변화', desc: '장터, 실학, 서민 문화', quest: q7 },
            { id: 'q8', emoji: '🚋', name: '개항과 근대 문물', desc: '전차, 전등, 신문이 들어오다', quest: q8 },
        ],
    },
    {
        title: '식민 통치와 저항, 전쟁이 바꾼 사회와 생활',
        stations: [
            { id: 'q9', emoji: '🕯️', name: '일제 강점기와 독립운동', desc: '빼앗긴 나라를 되찾으려는 노력', quest: q9 },
            { id: 'q10', emoji: '🕊️', name: '광복과 6·25 전쟁', desc: '광복, 전쟁, 그리고 달라진 생활', quest: q10 },
        ],
    },
];

export const stations = units.flatMap(u => u.stations);

// 이어하기 코드의 칸 순서 (절대 순서를 바꾸지 말 것 — 바꾸면 예전 코드가 엉뚱하게 풀림)
export const questOrder = stations.map(s => s.id);

export const avatars = ['🦊', '🐯', '🐻', '🐰', '🐼', '🐸', '🐱', '🐶', '🐧', '🦉'];
