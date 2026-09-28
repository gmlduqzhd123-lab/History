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
    // 고구려 무용총 수렵도: 말 탄 사람이 활을 쏘며 사슴을 쫓는 벽화 (간단히 다시 그린 그림)
    huntingMural: svg(`
        <rect x="6" y="6" width="188" height="188" rx="6" fill="#ecd7ae" stroke="#7a5a3a" stroke-width="4"/>
        <g fill="none" stroke-linecap="round" stroke-width="7">
            <path d="M10 176 Q30 146 50 176 Q70 146 90 176" stroke="#b84a34"/>
            <path d="M10 176 Q30 156 50 176 Q70 156 90 176" stroke="#f5ecd9" stroke-width="4"/>
            <path d="M110 180 Q130 150 150 180 Q170 150 190 180" stroke="#3f3a34"/>
            <path d="M110 180 Q130 160 150 180 Q170 160 190 180" stroke="#f5ecd9" stroke-width="4"/>
            <path d="M120 40 Q134 20 148 40" stroke="#b84a34" stroke-width="5"/>
        </g>
        <g stroke="#3f2a1e" stroke-width="2.5" stroke-linejoin="round">
            <path d="M162 70 l-6 -14 m6 14 l6 -16 m-9 6 l-6 -2 m12 -2 l6 -3" fill="none" stroke-width="2.5"/>
            <ellipse cx="160" cy="92" rx="18" ry="8" fill="#c77a45"/>
            <path d="M174 88 L184 76 L188 80 L178 92 Z" fill="#c77a45"/>
            <path d="M148 98 L136 110 M154 99 L150 114 M168 99 L180 110 M172 97 L188 104" fill="none"/>
        </g>
        <g stroke="#2e1d14" stroke-width="2.5" stroke-linejoin="round">
            <path d="M52 120 L30 132 M58 124 L44 144 M104 120 L128 128 M100 124 L118 144" fill="none" stroke-width="4"/>
            <ellipse cx="80" cy="116" rx="30" ry="13" fill="#8b3a2b"/>
            <path d="M104 110 L122 92 L132 96 L126 104 L110 120 Z" fill="#8b3a2b"/>
            <path d="M50 112 Q34 104 30 118" fill="none" stroke-width="4"/>
            <path d="M80 104 L84 80" fill="none" stroke-width="5"/>
            <circle cx="85" cy="72" r="8" fill="#f1d9b5"/>
            <path d="M78 66 Q85 56 92 66" fill="#2e1d14"/>
            <path d="M86 86 L104 80" fill="none" stroke-width="3"/>
            <path d="M104 62 Q118 80 104 98" fill="none" stroke-width="3"/>
            <path d="M104 62 L104 98" fill="none" stroke-width="1.5"/>
            <path d="M104 80 L146 88" fill="none" stroke-width="2"/>
            <path d="M146 88 l-7 -4 m7 4 l-7 3" fill="none" stroke-width="2"/>
        </g>
    `, '무용총 수렵도'),

    // 백제 금동 대향로: 용 받침, 연꽃 몸통, 산 모양 뚜껑, 꼭대기 봉황
    incenseBurner: svg(`
        <defs><linearGradient id="ib" x1="0" x2="1"><stop offset="0" stop-color="#9c6b1f"/><stop offset="0.45" stop-color="#e8c25a"/><stop offset="1" stop-color="#8a5c18"/></linearGradient></defs>
        ${ground}
        <g stroke="#5c3d0e" stroke-width="2.5" stroke-linejoin="round" fill="url(#ib)">
            <path d="M62 172 Q64 150 84 150 Q100 142 116 150 Q136 150 138 172 Q100 182 62 172 Z"/>
            <path d="M84 150 Q76 140 86 134 Q96 140 94 150" fill="none"/>
            <path d="M92 150 L92 136 L108 136 L108 150 Z"/>
            <path d="M58 112 Q60 142 100 142 Q140 142 142 112 Z"/>
            <path d="M66 114 Q74 132 84 138 M86 114 Q92 134 100 140 M114 114 Q108 134 100 140 M134 114 Q126 132 116 138" fill="none"/>
            <path d="M56 112 Q56 56 100 50 Q144 56 144 112 Z"/>
            <path d="M62 104 q8 -12 16 0 q8 -14 16 0 q8 -14 16 0 q8 -12 16 0 q6 -10 12 0" fill="none"/>
            <path d="M66 86 q8 -12 16 0 q9 -14 18 0 q9 -14 18 0 q8 -12 14 0" fill="none"/>
            <path d="M74 68 q8 -10 14 0 q6 -12 12 0 q6 -12 12 0 q6 -10 12 0" fill="none"/>
            <path d="M100 50 L100 40"/>
            <path d="M100 40 Q86 30 82 14 Q94 20 100 28 Q106 20 118 14 Q114 30 100 40 Z"/>
            <path d="M100 28 Q104 14 96 8" fill="none"/>
            <circle cx="96" cy="8" r="3"/>
        </g>
        <g fill="#5c3d0e"><circle cx="80" cy="96" r="2"/><circle cx="120" cy="96" r="2"/><circle cx="100" cy="78" r="2"/></g>
    `, '백제 금동 대향로'),

    // 신라 금관: 나뭇가지(出) 모양과 사슴뿔 모양 세움 장식, 곱은옥과 달개
    goldCrown: svg(`
        <defs><linearGradient id="gc" x1="0" x2="1"><stop offset="0" stop-color="#b8861b"/><stop offset="0.5" stop-color="#f3d36b"/><stop offset="1" stop-color="#a87814"/></linearGradient></defs>
        <g fill="none" stroke="url(#gc)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
            ${[64, 100, 136].map(x => `<path d="M${x} 140 V40 M${x} 118 H${x - 14} V98 M${x} 118 H${x + 14} V98 M${x} 92 H${x - 14} V72 M${x} 92 H${x + 14} V72 M${x} 66 H${x - 12} V48 M${x} 66 H${x + 12} V48"/>`).join('')}
            <path d="M38 140 Q34 110 44 88 Q38 76 30 70 M44 88 Q50 72 46 58 M40 112 Q28 104 24 92"/>
            <path d="M162 140 Q166 110 156 88 Q162 76 170 70 M156 88 Q150 72 154 58 M160 112 Q172 104 176 92"/>
        </g>
        <path d="M28 136 Q100 124 172 136 L172 156 Q100 144 28 156 Z" fill="url(#gc)" stroke="#7a5510" stroke-width="2"/>
        <g fill="#7a5510">${[40, 58, 76, 94, 112, 130, 148, 164].map(x => `<circle cx="${x}" cy="${x < 100 ? 146 - (x - 28) * 0.08 : 146 - (172 - x) * 0.08}" r="2"/>`).join('')}</g>
        <g fill="#f7dc7a" stroke="#a87814" stroke-width="1">
            ${[[64, 58], [100, 52], [136, 58], [64, 84], [136, 84], [100, 106], [50, 106], [150, 106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}
        </g>
        <g fill="#3f8f5a" stroke="#1f5a34" stroke-width="1.5">
            ${[[80, 74], [118, 74], [100, 90], [48, 90], [152, 90]].map(([x, y]) => `<path d="M${x} ${y} a6 6 0 1 1 6 6 q-2 6 -8 8 q4 -6 2 -14 z"/>`).join('')}
        </g>
        <g stroke="#b8861b" stroke-width="3" fill="none"><path d="M44 154 L40 182 M156 154 L160 182"/></g>
        <g fill="#f3d36b" stroke="#a87814"><path d="M40 182 l-6 8 l6 6 l6 -6 z M160 182 l-6 8 l6 6 l6 -6 z"/></g>
    `, '신라 금관'),

    // 가야 덩이쇠: 가운데가 잘록한 납작한 쇳덩이 여러 장
    ironIngot: svg(`
        ${ground}
        ${[0, 1, 2, 3].map(i => {
            const y = 70 + i * 22, dx = i % 2 ? 6 : 0;
            return `<path d="M${30 + dx} ${y} L${76 + dx} ${y + 8} L${124 + dx} ${y + 8} L${170 + dx} ${y} L${170 + dx} ${y + 16} L${124 + dx} ${y + 20} L${76 + dx} ${y + 20} L${30 + dx} ${y + 16} Z" fill="${['#6b6560', '#5d5752', '#716a63', '#57514c'][i]}" stroke="#2f2b28" stroke-width="2.5" stroke-linejoin="round"/>
                    <path d="M${36 + dx} ${y + 4} L${76 + dx} ${y + 11} L${124 + dx} ${y + 11} L${164 + dx} ${y + 4}" stroke="#9a938b" stroke-width="2" fill="none" opacity="0.7"/>`;
        }).join('')}
        <g fill="#9a4f26" opacity="0.8"><circle cx="58" cy="82" r="4"/><circle cx="142" cy="108" r="5"/><circle cx="96" cy="140" r="4"/><circle cx="150" cy="148" r="3"/></g>
        <path d="M20 118 Q14 100 22 86 M180 126 Q188 108 180 92" stroke="#c7a36b" stroke-width="4" fill="none" stroke-linecap="round"/>
    `, '덩이쇠'),

    // 신라 첨성대: 돌을 병 모양으로 쌓고 가운데에 네모난 창
    cheomseongdae: svg(`
        <rect x="0" y="160" width="200" height="40" fill="#b7cf8f"/>
        <rect x="52" y="150" width="96" height="14" fill="#b9ae9c" stroke="#6b5f4f" stroke-width="2"/>
        <path d="M56 150 C78 140 82 100 82 36 L118 36 C118 100 122 140 144 150 Z" fill="#d6cab5" stroke="#6b5f4f" stroke-width="3"/>
        <g stroke="#8f8471" stroke-width="1.5">
            ${Array.from({ length: 12 }, (_, i) => {
                const y = 44 + i * 9;
                const t = (y - 36) / 114;
                const half = 18 + Math.pow(t, 3) * 26;
                return `<line x1="${(100 - half).toFixed(1)}" y1="${y}" x2="${(100 + half).toFixed(1)}" y2="${y}"/>`;
            }).join('')}
        </g>
        <rect x="92" y="86" width="16" height="16" fill="#4a3f33" stroke="#6b5f4f" stroke-width="2"/>
        <path d="M72 36 H128 M72 28 H128 M78 24 V40 M122 24 V40" stroke="#8f8471" stroke-width="5" stroke-linecap="square"/>
        <g fill="#fde68a"><path d="M40 30 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z"/><path d="M160 20 l2 4 4 1 -3 3 1 4 -4 -2 -3 2 1 -4 -3 -3 4 -1z"/><circle cx="150" cy="60" r="2"/><circle cx="30" cy="70" r="2"/></g>
    `, '첨성대'),
    // 석굴암 본존불: 둥근 천장 굴 안에 앉은 불상 (간단히 다시 그린 그림)
    seokguram: svg(`
        <path d="M16 196 V92 Q16 14 100 14 Q184 14 184 92 V196 Z" fill="#5b544c"/>
        <path d="M30 196 V96 Q30 30 100 30 Q170 30 170 96 V196 Z" fill="#7a7168"/>
        <g stroke="#6a625a" stroke-width="1.5" fill="none">${[48, 66, 84].map(y => `<path d="M${40 + (y - 48) * 0.1} ${y + 30} Q100 ${y - 10} ${160 - (y - 48) * 0.1} ${y + 30}"/>`).join('')}</g>
        <circle cx="100" cy="66" r="30" fill="#ece5d6" stroke="#b7ad9a" stroke-width="3"/>
        <g stroke="#8f8574" stroke-width="2.5" stroke-linejoin="round">
            <path d="M40 186 Q100 168 160 186 L160 196 L40 196 Z" fill="#d9d0bf"/>
            <path d="M44 184 Q52 150 72 138 L128 138 Q148 150 156 184 Q100 170 44 184 Z" fill="#efe8da"/>
            <path d="M74 140 Q72 110 84 96 L116 96 Q128 110 126 140 Z" fill="#f4eee2"/>
            <path d="M84 98 Q92 118 88 138 M116 98 Q108 118 112 138" fill="none"/>
            <path d="M80 164 Q100 150 122 164" fill="none"/>
            <path d="M118 150 L128 172" fill="none"/>
            <ellipse cx="100" cy="78" rx="15" ry="18" fill="#f4eee2"/>
            <circle cx="100" cy="56" r="8" fill="#e2d9c8"/>
            <path d="M92 76 q3 2 6 0 M102 76 q3 2 6 0 M97 88 q3 2 6 0" fill="none" stroke-width="1.8"/>
            <path d="M85 80 v10 M115 80 v10" fill="none" stroke-width="2"/>
        </g>
    `, '석굴암 본존불'),

    // 불국사 석가탑: 2층 기단 위에 올린 3층 석탑
    seokgatap: svg(`
        <rect x="0" y="176" width="200" height="24" fill="#d9c29c"/>
        <g fill="#d8d1c4" stroke="#6b645a" stroke-width="2.5" stroke-linejoin="round">
            <rect x="34" y="160" width="132" height="16"/>
            <rect x="42" y="146" width="116" height="14"/>
            <rect x="54" y="128" width="92" height="18"/>
            <path d="M30 128 L170 128 L162 118 L38 118 Z"/>
            <rect x="66" y="98" width="68" height="20"/>
            <path d="M40 98 L160 98 L152 88 L48 88 Z"/>
            <rect x="72" y="74" width="56" height="14"/>
            <path d="M48 74 L152 74 L144 64 L56 64 Z"/>
            <rect x="78" y="52" width="44" height="12"/>
            <path d="M56 52 L144 52 L136 42 L64 42 Z"/>
        </g>
        <g stroke="#6b645a" stroke-width="2"><line x1="100" y1="128" x2="100" y2="146"/><line x1="100" y1="98" x2="100" y2="118"/><line x1="100" y1="74" x2="100" y2="88"/></g>
        <g fill="#b9ad98" stroke="#6b645a" stroke-width="2"><rect x="94" y="32" width="12" height="10"/><circle cx="100" cy="26" r="6"/><path d="M100 20 V8"/></g>
        <path d="M144 150 l14 -8" stroke="#b58b22" stroke-width="2"/>
        <rect x="150" y="132" width="26" height="16" rx="3" fill="#f3e3b5" stroke="#b58b22" stroke-width="2" transform="rotate(-8 163 140)"/>
        <path d="M154 138 h18 M154 142 h14" stroke="#b58b22" stroke-width="1.5" transform="rotate(-8 163 140)"/>
    `, '석가탑'),

    // 성덕대왕 신종: 용 모양 고리, 음통, 연꽃 무늬 당좌
    divineBell: svg(`
        <defs><linearGradient id="db" x1="0" x2="1"><stop offset="0" stop-color="#4f6a45"/><stop offset="0.5" stop-color="#8fa577"/><stop offset="1" stop-color="#435c3b"/></linearGradient></defs>
        <path d="M60 14 L140 14" stroke="#6b5a3a" stroke-width="6" stroke-linecap="round"/>
        <path d="M92 14 Q88 34 100 38 Q112 34 108 14" fill="none" stroke="#34482c" stroke-width="5"/>
        <rect x="112" y="22" width="8" height="18" rx="2" fill="url(#db)" stroke="#2c3b25" stroke-width="2"/>
        <path d="M62 44 Q100 32 138 44 L150 160 Q152 176 162 180 L38 180 Q48 176 50 160 Z" fill="url(#db)" stroke="#2c3b25" stroke-width="3"/>
        <path d="M60 58 Q100 48 140 58" fill="none" stroke="#2c3b25" stroke-width="2"/>
        <path d="M50 164 Q100 156 150 164" fill="none" stroke="#2c3b25" stroke-width="2"/>
        <g stroke="#2c3b25" stroke-width="1.5" fill="#9bb07a">
            <circle cx="72" cy="128" r="12"/>
            ${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<ellipse cx="${(72 + Math.cos(a) * 7).toFixed(1)}" cy="${(128 + Math.sin(a) * 7).toFixed(1)}" rx="3" ry="5" transform="rotate(${(i * 45 + 90)} ${(72 + Math.cos(a) * 7).toFixed(1)} ${(128 + Math.sin(a) * 7).toFixed(1)})"/>`; }).join('')}
        </g>
        <g fill="none" stroke="#d9e4c3" stroke-width="2" opacity="0.8"><path d="M104 100 q10 -14 22 -6 q-6 10 -16 12 M112 104 q12 4 20 -2"/><circle cx="118" cy="90" r="4"/></g>
        <g stroke="#9ca3af" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.8"><path d="M170 90 q8 10 0 20 M180 84 q12 16 0 32 M30 90 q-8 10 0 20 M20 84 q-12 16 0 32"/></g>
    `, '성덕대왕 신종'),

    // 발해 연꽃무늬 수막새: 지붕 기와 끝을 막는 둥근 기와
    balhaeTile: svg(`
        <circle cx="100" cy="100" r="82" fill="#8f877e" stroke="#4f4a44" stroke-width="4"/>
        <circle cx="100" cy="100" r="68" fill="#a39b91" stroke="#4f4a44" stroke-width="2"/>
        <g fill="#6f6860">${Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return `<circle cx="${(100 + Math.cos(a) * 75).toFixed(1)}" cy="${(100 + Math.sin(a) * 75).toFixed(1)}" r="2.5"/>`; }).join('')}</g>
        <g fill="#bdb5aa" stroke="#4f4a44" stroke-width="2">
            ${Array.from({ length: 6 }, (_, i) => `<path d="M100 100 C88 80 88 50 100 40 C112 50 112 80 100 100 Z" transform="rotate(${i * 60} 100 100)"/>`).join('')}
        </g>
        <g fill="#7a736b">${Array.from({ length: 6 }, (_, i) => `<path d="M100 72 l-4 -14 l4 -4 l4 4 z" transform="rotate(${i * 60 + 30} 100 100)"/>`).join('')}</g>
        <circle cx="100" cy="100" r="14" fill="#a39b91" stroke="#4f4a44" stroke-width="2"/>
        <g fill="#4f4a44"><circle cx="100" cy="100" r="2.5"/>${Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return `<circle cx="${(100 + Math.cos(a) * 8).toFixed(1)}" cy="${(100 + Math.sin(a) * 8).toFixed(1)}" r="2"/>`; }).join('')}</g>
    `, '발해 연꽃무늬 수막새'),
    // 고려청자(상감 매병): 옥빛 병에 흰 학과 구름을 상감으로 넣음
    celadonVase: svg(`
        <defs><linearGradient id="cv" x1="0" x2="1"><stop offset="0" stop-color="#6f9a8a"/><stop offset="0.45" stop-color="#b3d4c4"/><stop offset="1" stop-color="#5f8a7a"/></linearGradient></defs>
        ${ground}
        <path d="M86 22 L114 22 L112 34 Q150 44 152 86 Q154 130 124 168 L120 176 L80 176 L76 168 Q46 130 48 86 Q50 44 88 34 Z" fill="url(#cv)" stroke="#3f6457" stroke-width="3" stroke-linejoin="round"/>
        <path d="M84 22 L116 22 L116 16 L84 16 Z" fill="#8fb8a8" stroke="#3f6457" stroke-width="2.5"/>
        <path d="M60 64 Q100 56 140 64" fill="none" stroke="#3f6457" stroke-width="2"/>
        <g fill="#f8f5ec" stroke="#2f3b36" stroke-width="1.5">
            <path d="M68 96 q10 -8 20 -2 l8 -6 l-2 8 q-8 8 -20 6 z"/><path d="M96 90 l6 -8" fill="none"/>
            <path d="M112 126 q10 -8 20 -2 l8 -6 l-2 8 q-8 8 -20 6 z"/><path d="M140 120 l6 -8" fill="none"/>
            <path d="M74 146 q8 -6 16 -2 l6 -5 l-2 6 q-6 6 -16 5 z"/>
        </g>
        <g fill="none" stroke="#f8f5ec" stroke-width="2.5" stroke-linecap="round">
            <path d="M118 84 q6 -6 12 0 q6 -6 10 2"/><path d="M62 124 q6 -6 12 0 q6 -6 10 2"/><path d="M108 156 q5 -5 10 0 q5 -5 8 2"/>
        </g>
    `, '고려청자'),

    // 팔만대장경판: 글자를 거꾸로 새긴 나무판, 양 끝에 마구리
    tripitakaBlock: svg(`
        ${ground}
        <g transform="rotate(-6 100 100)">
            <rect x="20" y="58" width="16" height="92" rx="3" fill="#6b4a2a" stroke="#3f2a16" stroke-width="2.5"/>
            <rect x="164" y="58" width="16" height="92" rx="3" fill="#6b4a2a" stroke="#3f2a16" stroke-width="2.5"/>
            <rect x="34" y="64" width="132" height="80" fill="#b98a55" stroke="#3f2a16" stroke-width="2.5"/>
            <rect x="42" y="70" width="116" height="68" fill="#c99c64" stroke="#7a5530" stroke-width="1.5"/>
            <g fill="#4a3018">${Array.from({ length: 13 }, (_, c) => Array.from({ length: 7 }, (_, r) => `<rect x="${48 + c * 8.4}" y="${74 + r * 9}" width="5.5" height="6" rx="1" opacity="${0.55 + ((c * 7 + r) % 3) * 0.15}"/>`).join('')).join('')}</g>
        </g>
    `, '팔만대장경판'),

    // 직지: 금속 활자로 찍은 책 (펼친 모습)
    jikjiBook: svg(`
        ${ground}
        <path d="M100 52 Q70 40 30 46 L30 160 Q70 154 100 166 Z" fill="#efe3c6" stroke="#6b5a3a" stroke-width="3"/>
        <path d="M100 52 Q130 40 170 46 L170 160 Q130 154 100 166 Z" fill="#f5ebd2" stroke="#6b5a3a" stroke-width="3"/>
        <g stroke="#9c8a66" stroke-width="1">${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${40 + i * 10}" y1="58" x2="${40 + i * 10}" y2="150"/><line x1="${110 + i * 10}" y1="56" x2="${110 + i * 10}" y2="150"/>`).join('')}</g>
        <g fill="#2f2a24">${[0, 1, 2, 3, 4].map(i => Array.from({ length: 8 }, (_, r) => `<rect x="${43 + i * 10}" y="${64 + r * 10.5}" width="5" height="6" rx="1"/><rect x="${113 + i * 10}" y="${62 + r * 10.5}" width="5" height="6" rx="1"/>`).join('')).join('')}</g>
        <g transform="translate(140 150)">
            <rect x="0" y="0" width="16" height="16" rx="2" fill="#8a8f96" stroke="#3f444a" stroke-width="2"/>
            <rect x="20" y="4" width="16" height="16" rx="2" fill="#9aa0a8" stroke="#3f444a" stroke-width="2"/>
            <path d="M4 5 h8 M8 5 v7 M24 9 h8 M28 9 v7" stroke="#3f444a" stroke-width="2"/>
        </g>
    `, '직지'),
    // 앙부일구: 솥 모양 해시계, 그림자로 시각을 읽음
    angbuilgu: svg(`
        <defs><linearGradient id="ab" x1="0" x2="1"><stop offset="0" stop-color="#4f6a45"/><stop offset="0.5" stop-color="#8fa577"/><stop offset="1" stop-color="#435c3b"/></linearGradient></defs>
        ${ground}
        <path d="M60 176 L72 132 M140 176 L128 132 M84 180 L90 136 M116 180 L110 136" stroke="#34482c" stroke-width="6" stroke-linecap="round"/>
        <path d="M36 80 Q36 150 100 150 Q164 150 164 80 Z" fill="url(#ab)" stroke="#2c3b25" stroke-width="3"/>
        <ellipse cx="100" cy="80" rx="64" ry="20" fill="#e9dfc4" stroke="#2c3b25" stroke-width="3"/>
        <g stroke="#6b5a3a" stroke-width="1.2" fill="none">
            ${[-48, -32, -16, 0, 16, 32, 48].map(dx => `<path d="M${100 + dx} ${80 - Math.sqrt(1 - (dx / 64) ** 2) * 20 + 2} Q${100 + dx * 0.8} 84 ${100 + dx} ${80 + Math.sqrt(1 - (dx / 64) ** 2) * 20 - 2}"/>`).join('')}
            <ellipse cx="100" cy="80" rx="52" ry="14"/><ellipse cx="100" cy="80" rx="38" ry="10"/>
        </g>
        <path d="M100 80 L140 62" stroke="#2c3b25" stroke-width="3" stroke-linecap="round"/>
        <path d="M100 80 L128 90" stroke="#6b5a3a" stroke-width="4" opacity="0.45" stroke-linecap="round"/>
        <g font-size="12" text-anchor="middle">${[['🐭', 58, 76], ['🐯', 78, 68], ['🐍', 122, 68], ['🐴', 142, 76]].map(([e, x, y]) => `<text x="${x}" y="${y}">${e}</text>`).join('')}</g>
        <circle cx="170" cy="30" r="12" fill="#fcd34d"/>
    `, '앙부일구'),

    // 측우기: 비의 양을 재는 원통과 돌 받침(측우대)
    cheugugi: svg(`
        ${ground}
        <path d="M150 20 q-6 10 0 16 q6 -6 0 -16 M168 40 q-5 8 0 13 q5 -5 0 -13 M40 30 q-5 8 0 13 q5 -5 0 -13" fill="#93c5fd"/>
        <rect x="52" y="132" width="96" height="40" fill="#c9c0b0" stroke="#6b645a" stroke-width="3"/>
        <path d="M60 140 h80 M60 164 h80" stroke="#8f8574" stroke-width="1.5"/>
        <g fill="none" stroke="#8f8574" stroke-width="1.5"><rect x="70" y="146" width="60" height="12"/></g>
        <rect x="76" y="46" width="48" height="86" fill="#8a8f96" stroke="#3f444a" stroke-width="3"/>
        <ellipse cx="100" cy="46" rx="24" ry="6" fill="#5f646a" stroke="#3f444a" stroke-width="3"/>
        <g stroke="#3f444a" stroke-width="2"><line x1="76" y1="74" x2="124" y2="74"/><line x1="76" y1="104" x2="124" y2="104"/></g>
        <g transform="translate(132 60)"><rect x="0" y="0" width="10" height="68" fill="#e9d8a6" stroke="#8a6d2a" stroke-width="2"/>
            ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${6 + i * 7}" x2="${i % 2 ? 4 : 7}" y2="${6 + i * 7}" stroke="#8a6d2a" stroke-width="1.5"/>`).join('')}</g>
    `, '측우기'),

    // 훈민정음 해례본: 펼친 책에 우리 글자
    hunminBook: svg(`
        ${ground}
        <path d="M100 44 Q70 32 28 38 L28 162 Q70 156 100 168 Z" fill="#efe3c6" stroke="#6b5a3a" stroke-width="3"/>
        <path d="M100 44 Q130 32 172 38 L172 162 Q130 156 100 168 Z" fill="#f5ebd2" stroke="#6b5a3a" stroke-width="3"/>
        <g font-family="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif" fill="#2f2a24" text-anchor="middle" font-weight="bold">
            ${['훈', '민', '정', '음'].map((c, i) => `<text x="154" y="${72 + i * 26}" font-size="22">${c}</text>`).join('')}
            ${[['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'], ['ㅁ', 'ㅂ', 'ㅅ', 'ㅇ']].map((col, i) => col.map((c, j) => `<text x="${130 - i * 20}" y="${70 + j * 26}" font-size="17">${c}</text>`).join('')).join('')}
            ${[['ㆍ', 'ㅡ', 'ㅣ'], ['ㅏ', 'ㅓ', 'ㅗ']].map((col, i) => col.map((c, j) => `<text x="${84 - i * 22}" y="${72 + j * 30}" font-size="18">${c}</text>`).join('')).join('')}
        </g>
        <g stroke="#9c8a66" stroke-width="1.5">${[0, 1, 2].map(i => `<line x1="${44 - i * 0}" y1="${60 + i * 34}" x2="44" y2="${84 + i * 34}"/>`).join('')}</g>
    `, '훈민정음 해례본'),

    // 삼강행실도: 효자 이야기를 그림으로 그린 책의 한 장면
    samgang: svg(`
        <rect x="28" y="18" width="144" height="168" fill="#f3e7c9" stroke="#6b5a3a" stroke-width="3"/>
        <rect x="38" y="28" width="124" height="96" fill="#fbf4e2" stroke="#9c8a66" stroke-width="1.5"/>
        <path d="M44 118 Q70 108 100 116 T156 112" stroke="#8fa577" stroke-width="3" fill="none"/>
        <path d="M130 50 q-12 10 -4 22 q-14 4 -6 18 h28 q8 -14 -6 -18 q8 -12 -12 -22 z" fill="#8fa577" stroke="#4f6a45" stroke-width="1.5"/>
        <rect x="132" y="88" width="6" height="26" fill="#8a6d2a"/>
        <g stroke="#3f2a1e" stroke-width="2" stroke-linejoin="round">
            <circle cx="72" cy="62" r="7" fill="#f1d9b5"/><path d="M64 58 q8 -8 16 0" fill="#e5e7eb"/>
            <path d="M62 70 L82 70 L86 104 L58 104 Z" fill="#c7a36b"/>
            <circle cx="104" cy="82" r="6" fill="#f1d9b5"/><path d="M98 78 q6 -6 12 0" fill="#3f2a1e"/>
            <path d="M98 88 L112 88 L116 104 L92 104 Z" fill="#7aa0c9"/>
            <path d="M96 94 L86 88" fill="none"/>
            <path d="M84 88 l-6 2 l2 4 z" fill="#b84a34"/>
        </g>
        <g stroke="#6b5a3a" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<line x1="${48 + i * 13}" y1="134" x2="${48 + i * 13}" y2="${170 - (i % 3) * 6}"/>`).join('')}</g>
    `, '삼강행실도'),
    // 거북선: 용머리, 쇠못이 박힌 덮개, 노
    turtleShip: svg(`
        <rect x="0" y="140" width="200" height="60" fill="#9cc3e0"/>
        <path d="M0 150 q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke="#e8f3fb" stroke-width="3"/>
        <g transform="translate(-14 0)">
        <g stroke="#5a3a1e" stroke-width="3" stroke-linecap="round">${[48, 66, 84, 102, 120, 138].map(x => `<line x1="${x}" y1="134" x2="${x - 10}" y2="166"/>`).join('')}</g>
        <path d="M24 108 L176 108 L166 140 L36 140 Z" fill="#8a5a30" stroke="#4a2e14" stroke-width="3" stroke-linejoin="round"/>
        <g fill="#f3e3b5" stroke="#4a2e14" stroke-width="1.5">${[44, 62, 80, 98, 116, 134, 152].map(x => `<rect x="${x}" y="116" width="10" height="8"/>`).join('')}</g>
        <path d="M30 108 Q100 52 170 108 Z" fill="#6b7a5a" stroke="#34402a" stroke-width="3"/>
        <g stroke="#34402a" stroke-width="1.2" fill="none">${[0, 1, 2].map(r => `<path d="M${46 + r * 14} ${104 - r * 12} Q100 ${74 - r * 10 + 16} ${154 - r * 14} ${104 - r * 12}"/>`).join('')}</g>
        <g stroke="#2f2f2f" stroke-width="2" stroke-linecap="round">${Array.from({ length: 11 }, (_, i) => { const x = 44 + i * 11.2; const y = 108 - Math.sin(Math.PI * (x - 30) / 140) * 28; return `<line x1="${x.toFixed(1)}" y1="${(y + 2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 6).toFixed(1)}"/>`; }).join('')}</g>
        <path d="M170 104 Q182 86 196 90 L194 102 L184 104 Q186 112 176 116 Z" fill="#b84a34" stroke="#5a1f14" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="186" cy="94" r="2" fill="#fde68a"/>
        <path d="M196 94 q6 -6 2 -14 q8 2 2 -10" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
        <path d="M100 80 V54" stroke="#4a2e14" stroke-width="3"/><path d="M100 54 L120 60 L100 66 Z" fill="#b84a34"/>
        </g>
    `, '거북선'),

    // 상평통보: 가운데 네모 구멍이 뚫린 엽전과 엽전 꾸러미
    sangpyeong: svg(`
        ${ground}
        <path d="M24 150 Q60 128 100 140 T176 138" fill="none" stroke="#c7a36b" stroke-width="4"/>
        <g fill="#a47b3a" stroke="#5c4418" stroke-width="2">${[40, 58, 76, 94, 112, 130, 148, 166].map((x, i) => `<ellipse cx="${x}" cy="${140 - Math.sin(i / 1.3) * 8}" rx="6" ry="14"/>`).join('')}</g>
        <circle cx="100" cy="76" r="54" fill="#c49a4f" stroke="#5c4418" stroke-width="4"/>
        <circle cx="100" cy="76" r="46" fill="none" stroke="#8a6526" stroke-width="2"/>
        <rect x="86" y="62" width="28" height="28" fill="#f7efe2" stroke="#5c4418" stroke-width="3"/>
        <g font-family="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans CJK KR','Noto Serif CJK KR',serif" font-size="20" font-weight="bold" fill="#4a3412" text-anchor="middle">
            <text x="100" y="52">常</text><text x="100" y="116">平</text><text x="132" y="84">通</text><text x="68" y="84">寶</text>
        </g>
    `, '상평통보'),

    // 거중기: 도르래와 밧줄로 무거운 돌을 들어 올리는 기계
    geojunggi: svg(`
        ${ground}
        <g stroke="#6b4a2a" stroke-width="7" stroke-linecap="round"><line x1="40" y1="176" x2="52" y2="34"/><line x1="160" y1="176" x2="148" y2="34"/><line x1="40" y1="34" x2="160" y2="34"/><line x1="46" y1="100" x2="154" y2="100"/></g>
        <g stroke="#6b4a2a" stroke-width="4"><line x1="30" y1="176" x2="52" y2="140"/><line x1="170" y1="176" x2="148" y2="140"/></g>
        <g fill="#c7a36b" stroke="#4a2e14" stroke-width="2.5">
            <circle cx="84" cy="46" r="9"/><circle cx="116" cy="46" r="9"/><circle cx="100" cy="72" r="9"/><circle cx="90" cy="96" r="7"/><circle cx="110" cy="96" r="7"/>
        </g>
        <g stroke="#8a6d2a" stroke-width="2" fill="none"><path d="M75 46 L91 96 M125 46 L109 96 M84 37 H116 M100 81 L100 124"/><path d="M84 55 L28 150 M116 55 L172 150"/></g>
        <g fill="#8a5a30" stroke="#4a2e14" stroke-width="2"><circle cx="24" cy="152" r="10"/><circle cx="176" cy="152" r="10"/></g>
        <g stroke="#4a2e14" stroke-width="2"><path d="M14 152 h20 M24 142 v20 M166 152 h20 M176 142 v20"/></g>
        <path d="M72 124 L128 124 L134 156 L66 156 Z" fill="#aaa298" stroke="#5f574f" stroke-width="3" stroke-linejoin="round"/>
        <path d="M78 132 L122 132" stroke="#c9c2b8" stroke-width="3"/>
    `, '거중기'),

    // 김홍도 「서당」을 간단히 다시 그린 풍속화 장면
    seodangPainting: svg(`
        <rect x="8" y="8" width="184" height="184" fill="#efe2c4" stroke="#8a7550" stroke-width="3"/>
        <g stroke="#3f2a1e" stroke-width="2" stroke-linejoin="round">
            <path d="M138 110 Q140 84 156 80 Q172 84 174 110 Q158 120 138 110 Z" fill="#e8e0cc"/>
            <circle cx="156" cy="70" r="10" fill="#f1d9b5"/>
            <path d="M144 64 h24 M150 64 v-10 h12 v10" fill="#2f2a24"/>
            <path d="M152 78 q4 6 8 0" fill="none"/>
            <path d="M136 112 L176 112 L180 118 L132 118 Z" fill="#b89a6a"/>
            <path d="M96 118 Q96 96 108 92 Q120 96 120 118 Z" fill="#9cb4c9"/>
            <circle cx="108" cy="84" r="9" fill="#f1d9b5"/>
            <path d="M101 80 q7 -9 14 0" fill="#3f2a1e"/>
            <path d="M112 88 q4 2 6 -2 M104 88 l-2 4" fill="none" stroke-width="1.5"/>
            <path d="M112 100 L126 94" fill="none"/>
            ${[[40, 70], [60, 64], [34, 124], [58, 134], [84, 150], [120, 154], [150, 150]].map(([x, y], i) => `
                <path d="M${x - 12} ${y + 26} Q${x - 12} ${y + 8} ${x} ${y + 6} Q${x + 12} ${y + 8} ${x + 12} ${y + 26} Z" fill="${['#e8e0cc', '#c9d7b5', '#e8e0cc', '#dcc9a6', '#c9d7b5', '#e8e0cc', '#dcc9a6'][i]}"/>
                <circle cx="${x}" cy="${y}" r="8" fill="#f1d9b5"/>
                <path d="M${x - 4} ${y + 2} q4 ${i % 2 ? 3 : 4} 8 0" fill="none" stroke-width="1.5"/>`).join('')}
        </g>
        <text x="20" y="30" font-size="12" fill="#8a7550" font-family="'Apple SD Gothic Neo','Malgun Gothic',sans-serif">서당</text>
    `, '김홍도의 서당(다시 그린 그림)'),
};
