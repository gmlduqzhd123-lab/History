// 배경음악. 교실에서 여러 기기가 한꺼번에 울리지 않게 처음에는 꺼 두고,
// 학생이 켜면 이 기기에 기억한다. 브라우저는 사용자가 누르기 전에는 소리를 막으므로
// 켜 둔 기기도 첫 터치·키 입력 뒤에 재생한다.
import { h } from './dom.js';

const KEY = 'history-quest:bgm';
const SRC = 'media/history-quest-bgm.mp3';
const VOLUME = 1; // 파일 자체를 작게(-26 LUFS) 만들어 iOS처럼 음량을 못 바꾸는 기기도 조용히 들림
const DUCKED = 0.3; // 읽어 주기 목소리를 듣는 동안
const FADE_MS = 600;

let enabled = readSetting();
let audio = null;
let calm = false;
let speaking = false;
let fadeTimer = null;
let scheduled = false;

function readSetting() {
    try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}
function saveSetting() {
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* 저장이 막혀도 이번 방문에서는 동작 */ }
}

function player() {
    if (!audio) {
        audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = 0;
        audio.src = SRC; // 켠 기기에서만 내려받음
    }
    return audio;
}

function fadeTo(target, done) {
    clearInterval(fadeTimer);
    const el = audio;
    const start = el.volume;
    const began = performance.now();
    fadeTimer = setInterval(() => {
        const t = Math.min(1, (performance.now() - began) / FADE_MS);
        try { el.volume = start + (target - start) * t; } catch { /* 음량을 바꿀 수 없는 기기 */ }
        if (t === 1) { clearInterval(fadeTimer); done?.(); }
    }, 40);
}

// 아픈 역사를 다루는 화면, 다른 앱으로 전환, 사용법 영상 재생 중에는 멈춘다.
function videoPlaying() {
    return [...document.querySelectorAll('video')].some(video => !video.paused && !video.ended);
}
function shouldPlay() {
    return enabled && !calm && !document.hidden && !videoPlaying();
}

function update() {
    scheduled = false;
    if (!shouldPlay()) {
        if (audio && !audio.paused) fadeTo(0, () => { if (!shouldPlay()) audio.pause(); });
        return;
    }
    const el = player();
    const target = speaking ? DUCKED : VOLUME;
    if (el.paused) {
        el.play().then(update).catch(() => { /* 첫 터치 전이면 다음 입력에서 다시 시도 */ });
    } else {
        fadeTo(target);
    }
}

// 화면을 그리는 동안 차분한 화면 표시가 잠깐 꺼졌다 켜져도 음악이 튀지 않게 한 번에 반영한다.
function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(update);
}

function syncButtons() {
    document.querySelectorAll('.bgm-toggle').forEach(button => {
        button.setAttribute('aria-pressed', String(enabled));
        button.title = enabled ? '배경음악 끄기' : '배경음악 켜기';
        button.firstChild.textContent = enabled ? '🎵' : '🔇';
    });
}

export function bgmButton(className = 'btn btn-small') {
    const button = h('button', {
        class: `${className} bgm-toggle`, type: 'button', 'aria-label': '배경음악', 'aria-pressed': String(enabled),
        title: enabled ? '배경음악 끄기' : '배경음악 켜기',
        onclick: () => {
            enabled = !enabled;
            saveSetting();
            syncButtons();
            update(); // 누른 순간 바로 재생해야 브라우저가 소리를 허락함
        },
    }, h('span', { 'aria-hidden': 'true' }, enabled ? '🎵' : '🔇'));
    return button;
}

export function initBgm() {
    calm = document.body.classList.contains('calm');
    document.addEventListener('history:calm', event => { calm = event.detail; scheduleUpdate(); });
    document.addEventListener('history:speaking', event => { speaking = event.detail; scheduleUpdate(); });
    document.addEventListener('visibilitychange', update);
    // 미디어 이벤트는 퍼지지 않으므로 캡처 단계에서 받는다. 화면을 바꿔 영상이 사라지면
    // 화면 전환(차분한 화면 표시 갱신)에서 다시 확인한다.
    const videoChanged = event => { if (event.target instanceof HTMLVideoElement) scheduleUpdate(); };
    ['play', 'playing', 'pause', 'ended'].forEach(type => document.addEventListener(type, videoChanged, true));
    // 켜 둔 기기는 첫 입력 때 재생을 시작한다(브라우저 자동 재생 제한). 음악 버튼은 직접 처리.
    const firstInput = event => {
        if ((audio && !audio.paused) || event.target.closest?.('.bgm-toggle')) return;
        update();
    };
    document.addEventListener('pointerdown', firstInput, true);
    document.addEventListener('keydown', firstInput, true);
    window.addEventListener('storage', event => {
        if (event.key !== KEY) return;
        enabled = readSetting();
        syncButtons();
        update();
    });
}
