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

function cleanForSpeech(text) {
    // 이모지와 기호는 읽지 않게 제거
    return plain(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

export function stopSpeaking() {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    if (activeButton) activeButton.classList.remove('speaking');
    activeButton = null;
}

export function speak(text, button) {
    if (!ttsSupported) return;
    const wasActive = activeButton === button;
    stopSpeaking();
    if (wasActive) return; // 읽는 중에 다시 누르면 멈춤
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.lang = 'ko-KR';
    if (koVoice) utterance.voice = koVoice;
    utterance.rate = 0.95;
    utterance.onend = utterance.onerror = () => {
        if (activeButton === button) stopSpeaking();
    };
    if (button) { button.classList.add('speaking'); activeButton = button; }
    window.speechSynthesis.speak(utterance);
}

// 🔊 읽어 주기 버튼 (지원하지 않는 기기에서는 만들지 않음)
export function speakButton(getText, label = '읽어 주기') {
    if (!ttsSupported) return null;
    const btn = h('button', { class: 'speak-btn', type: 'button', 'aria-label': label }, `🔊 ${label}`);
    btn.addEventListener('click', () => speak(typeof getText === 'function' ? getText() : getText, btn));
    return btn;
}
