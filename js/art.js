// 유물·유적 그림 (이해를 돕기 위해 직접 그린 그림 — 실제 사진은 README의 방법으로 바꿀 수 있음)
const svg = (body, label) =>
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${body}</svg>`;

const ground = `<ellipse cx="100" cy="176" rx="72" ry="10" fill="#e6d5b8"/>`;

export const art = {
    // 주먹도끼: 한쪽이 뾰족한 아몬드 모양, 돌을 떼어 낸 자국
    handaxe: svg(`
        <defs><linearGradient id="ha" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#b7a58f"/><stop offset="1" stop-color="#7d6a55"/></linearGradient></defs>
        ${ground}
        <path d="M100 18 C124 40 150 92 146 130 C142 162 120 174 100 174 C80 174 58 162 54 130 C50 92 76 40 100 18 Z" fill="url(#ha)" stroke="#5b4a3a" stroke-width="3"/>
        <path d="M100 18 L92 60 L70 78 M92 60 L112 70 L128 58 M112 70 L108 108 L80 116 M108 108 L136 118 M80 116 L66 146 M108 108 L100 150 L124 156 M100 150 L78 162" fill="none" stroke="#5b4a3a" stroke-width="2" opacity="0.6"/>
        <path d="M86 40 L78 70 L92 60 Z M118 84 L134 100 L114 96 Z M70 124 L84 140 L68 150 Z" fill="#fff" opacity="0.18"/>
    `, '주먹도끼'),

    // 빗살무늬 토기: 밑이 뾰족한 토기와 빗살 무늬
    combPot: svg(`
        <defs><linearGradient id="cp" x1="0" x2="1"><stop offset="0" stop-color="#a86b45"/><stop offset="0.5" stop-color="#c98a5e"/><stop offset="1" stop-color="#94593a"/></linearGradient></defs>
        <path d="M30 176 Q100 150 170 176" fill="none" stroke="#d9c29c" stroke-width="10" stroke-linecap="round"/>
        <path d="M52 30 L148 30 L144 70 C140 110 118 150 100 180 C82 150 60 110 56 70 Z" fill="url(#cp)" stroke="#6b3f24" stroke-width="3"/>
        <ellipse cx="100" cy="30" rx="48" ry="8" fill="#7a4a2c" stroke="#6b3f24" stroke-width="3"/>
        <g stroke="#5a321b" stroke-width="2" opacity="0.8">
            ${[44, 62, 80, 98, 116, 134].map((y, row) => {
                const half = [46, 45, 42, 36, 28, 18][row];
                let lines = '';
                for (let x = 100 - half + 4; x < 100 + half - 4; x += 8) {
                    lines += row % 2 === 0
                        ? `<line x1="${x}" y1="${y}" x2="${x + 6}" y2="${y + 12}"/>`
                        : `<line x1="${x + 6}" y1="${y}" x2="${x}" y2="${y + 12}"/>`;
                }
                return lines;
            }).join('')}
        </g>
    `, '빗살무늬 토기'),

    // 갈돌과 갈판: 넓적한 돌판 위에 길쭉한 돌, 곡식 알갱이
    grinder: svg(`
        ${ground}
        <path d="M22 150 C30 118 170 118 178 150 C180 166 20 166 22 150 Z" fill="#9c8b77" stroke="#5b4a3a" stroke-width="3"/>
        <path d="M40 140 C70 128 130 128 160 140" fill="none" stroke="#bfae98" stroke-width="6" stroke-linecap="round"/>
        <rect x="46" y="104" width="108" height="30" rx="15" fill="#b3a28c" stroke="#5b4a3a" stroke-width="3"/>
        <path d="M58 112 L140 112" stroke="#d6c7b2" stroke-width="4" stroke-linecap="round"/>
        <g fill="#e8c35a" stroke="#b58b22" stroke-width="1">
            <circle cx="36" cy="146" r="4"/><circle cx="44" cy="150" r="3.5"/><circle cx="160" cy="147" r="4"/><circle cx="168" cy="151" r="3.5"/><circle cx="152" cy="153" r="3"/>
        </g>
        <path d="M84 96 l-8 -10 M100 94 l0 -12 M116 96 l8 -10" stroke="#7b6a5f" stroke-width="3" stroke-linecap="round"/>
    `, '갈돌과 갈판'),

    // 움집: 땅을 파고 기둥을 세운 뒤 풀로 덮은 집
    hut: svg(`
        <rect x="0" y="150" width="200" height="50" fill="#d9c29c"/>
        <ellipse cx="100" cy="156" rx="84" ry="12" fill="#bfa27a"/>
        <path d="M100 26 L176 152 L24 152 Z" fill="#c9a35f" stroke="#7a5a2a" stroke-width="3"/>
        <g stroke="#9b7a3f" stroke-width="2" opacity="0.8">
            <line x1="100" y1="30" x2="44" y2="150"/><line x1="100" y1="30" x2="72" y2="150"/><line x1="100" y1="30" x2="128" y2="150"/><line x1="100" y1="30" x2="156" y2="150"/>
            <path d="M70 80 L130 80 M56 104 L144 104 M42 128 L158 128" />
        </g>
        <path d="M100 18 L92 34 M100 18 L108 34" stroke="#6b4a1f" stroke-width="4" stroke-linecap="round"/>
        <path d="M84 152 L84 118 Q100 104 116 118 L116 152 Z" fill="#4a3421"/>
        <path d="M150 60 q8 -10 0 -20 q-8 -10 0 -20" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    `, '움집'),

    // 비파형 동검: 비파(악기)를 닮은 청동 칼
    bipaDagger: svg(`
        <defs><linearGradient id="bd" x1="0" x2="1"><stop offset="0" stop-color="#5f7a52"/><stop offset="0.5" stop-color="#9bb07a"/><stop offset="1" stop-color="#4f6a45"/></linearGradient></defs>
        ${ground}
        <path d="M100 14 C108 34 110 52 112 66 C126 80 132 96 124 110 C132 124 130 140 116 152 L108 160 L92 160 L84 152 C70 140 68 124 76 110 C68 96 74 80 88 66 C90 52 92 34 100 14 Z" fill="url(#bd)" stroke="#34482c" stroke-width="3"/>
        <line x1="100" y1="22" x2="100" y2="158" stroke="#34482c" stroke-width="4"/>
        <circle cx="121" cy="110" r="3" fill="#34482c"/><circle cx="79" cy="110" r="3" fill="#34482c"/>
        <rect x="94" y="160" width="12" height="18" rx="2" fill="#6b5a3a" stroke="#3f3322" stroke-width="2"/>
        <path d="M104 40 C106 56 108 66 108 72" stroke="#d9e4c3" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"/>
    `, '비파형 동검'),

    // 고인돌(탁자식): 받침돌 위에 넓적한 덮개돌
    dolmen: svg(`
        <rect x="0" y="146" width="200" height="54" fill="#b7cf8f"/>
        <path d="M0 150 Q50 140 100 148 T200 146 L200 200 L0 200 Z" fill="#a3c07a"/>
        <path d="M58 146 L64 92 L82 92 L86 146 Z" fill="#9a9187" stroke="#5f574f" stroke-width="3"/>
        <path d="M116 146 L120 92 L138 92 L144 146 Z" fill="#8f877d" stroke="#5f574f" stroke-width="3"/>
        <path d="M18 92 C24 70 176 64 184 88 C188 100 180 104 160 104 L36 106 C20 106 14 100 18 92 Z" fill="#aaa298" stroke="#5f574f" stroke-width="3"/>
        <path d="M40 84 C80 74 130 72 166 80" stroke="#c9c2b8" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g stroke="#6f8f4a" stroke-width="3" stroke-linecap="round"><path d="M30 160 l-4 -10 M34 160 l2 -12 M166 162 l-3 -10 M170 162 l3 -11 M100 164 l0 -10"/></g>
    `, '고인돌'),

    // 반달 돌칼: 곡식 이삭을 따는 돌칼, 구멍 두 개에 끈
    halfMoonKnife: svg(`
        ${ground}
        <path d="M100 120 Q120 70 160 60" fill="none" stroke="#c7a36b" stroke-width="4"/>
        <path d="M100 120 Q80 70 40 60" fill="none" stroke="#c7a36b" stroke-width="4"/>
        <path d="M26 118 C40 70 160 70 174 118 Z" fill="#a39380" stroke="#5b4a3a" stroke-width="3"/>
        <path d="M26 118 L174 118" stroke="#e7ddd0" stroke-width="3"/>
        <circle cx="84" cy="100" r="6" fill="#f7efe2" stroke="#5b4a3a" stroke-width="2"/>
        <circle cx="116" cy="100" r="6" fill="#f7efe2" stroke="#5b4a3a" stroke-width="2"/>
        <g stroke="#b58b22" stroke-width="2" fill="#e8c35a">
            <path d="M60 170 Q64 146 76 134" fill="none"/><ellipse cx="78" cy="132" rx="4" ry="7" transform="rotate(30 78 132)"/><ellipse cx="72" cy="140" rx="4" ry="7" transform="rotate(20 72 140)"/>
            <path d="M140 170 Q136 146 124 134" fill="none"/><ellipse cx="122" cy="132" rx="4" ry="7" transform="rotate(-30 122 132)"/><ellipse cx="128" cy="140" rx="4" ry="7" transform="rotate(-20 128 140)"/>
        </g>
    `, '반달 돌칼'),

    // 청동 거울(잔무늬 거울 뒷면): 가는 선 무늬와 끈을 꿰는 꼭지
    bronzeMirror: svg(`
        <defs><radialGradient id="bm"><stop offset="0" stop-color="#9bb07a"/><stop offset="1" stop-color="#5f7a52"/></radialGradient></defs>
        <circle cx="100" cy="100" r="78" fill="url(#bm)" stroke="#34482c" stroke-width="4"/>
        <circle cx="100" cy="100" r="66" fill="none" stroke="#34482c" stroke-width="2"/>
        <circle cx="100" cy="100" r="40" fill="none" stroke="#34482c" stroke-width="2"/>
        <g stroke="#34482c" stroke-width="1.2" opacity="0.8">
            ${Array.from({ length: 24 }, (_, i) => {
                const a = (i / 24) * Math.PI * 2;
                const x1 = 100 + Math.cos(a) * 42, y1 = 100 + Math.sin(a) * 42;
                const x2 = 100 + Math.cos(a) * 64, y2 = 100 + Math.sin(a) * 64;
                return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
            }).join('')}
            ${[46, 52, 58].map(r => `<circle cx="100" cy="100" r="${r}" fill="none" stroke-dasharray="3 3"/>`).join('')}
            <path d="M72 100 L100 72 L128 100 L100 128 Z M80 100 L100 80 L120 100 L100 120 Z" fill="none"/>
        </g>
        <rect x="80" y="94" width="14" height="12" rx="4" fill="#4f6a45" stroke="#2c3b25" stroke-width="2"/>
        <rect x="106" y="94" width="14" height="12" rx="4" fill="#4f6a45" stroke="#2c3b25" stroke-width="2"/>
    `, '청동 거울'),
};
