// 브라우저 내장 음성으로 읽어 주기 (인터넷 없이도 동작하는 기기가 많음)
import { h, plain } from './dom.js';

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let koVoice = null;
function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    koVoice = voices.find(v => v.lang === 'ko-KR') || voices.find(v => v.lang && v.lang.startsWith('ko')) || null;
}
if (ttsSupported) {
    pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

let activeButton = null;

// 가운뎃점이 든 역사 이름은 기계가 "삼 점 일"처럼 읽지 않도록 부르는 말로 바꿔 읽음
const SPOKEN = [['3·1', '삼일'], ['6·25', '육이오'], ['5·10', '오일공'], ['1·4', '일사'], ['8·15', '팔일오']];

function cleanForSpeech(text) {
    // 이모지와 기호는 읽지 않게 제거
    let t = plain(text).replace(/[ㆍ‧•・･]/g, '·');
    SPOKEN.forEach(([from, to]) => { t = t.split(from).join(to); });
    return t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

export function stopSpeaking() {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    if (activeButton) activeButton.classList.remove('speaking');
    activeButton = null;
}

// 크롬은 긴 글을 한 번에 읽히면 15초쯤에서 멈추는 문제가 있어 문장 단위로 나눠 읽음
function splitSentences(text) {
    const parts = text.match(/[^.!?。]+[.!?。]*/g) || [text];
    return parts.map(p => p.trim()).filter(Boolean);
}

export function speak(text, button) {
    if (!ttsSupported) return;
    const wasActive = activeButton === button;
    stopSpeaking();
    if (wasActive) return; // 읽는 중에 다시 누르면 멈춤
    const sentences = splitSentences(cleanForSpeech(text));
    if (!sentences.length) return;
    if (button) { button.classList.add('speaking'); activeButton = button; }
    const mine = activeButton;
    sentences.forEach((sentence, i) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'ko-KR';
        if (koVoice) utterance.voice = koVoice;
        utterance.rate = 0.95;
        if (i === sentences.length - 1) utterance.onend = () => { if (activeButton === mine) stopSpeaking(); };
        utterance.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled' && activeButton === mine) stopSpeaking(); };
        window.speechSynthesis.speak(utterance);
    });
}

// 🔊 읽어 주기 버튼 (지원하지 않는 기기에서는 만들지 않음)
export function speakButton(getText, label = '읽어 주기') {
    if (!ttsSupported) return null;
    const btn = h('button', { class: 'speak-btn', type: 'button', 'aria-label': label }, `🔊 ${label}`);
    btn.addEventListener('click', () => speak(typeof getText === 'function' ? getText() : getText, btn));
    return btn;
}
