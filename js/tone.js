// 말투 바꾸기: 아픈 역사를 다루는 퀘스트(calm: true)에서는 축하·장난 표현 대신 차분한 표현을 씀
const NORMAL = {
    correct: '🎉 정답!',
    found: '👍 찾았어요!',
    retryCorrect: '👍 이번엔 맞혔어요!',
    masteryIcon: '🏆',
    masteryStamp: '개념 통과',
    masteryPraise: '멋져요! 핵심 개념을 잘 알고 있어요.',
    summaryDone: '🎉 훌륭한 정리예요!',
    questStamp: '탐험 완료',
    questDone: '🎉 정거장 탐험을 마쳤어요!',
    questDoneAgain: '🏅 도장을 받은 정거장이에요',
    item: '유물',
    dexTitle: '🏺 도감에 모은 유물',
};
const CALM = {
    correct: '✔ 맞아요',
    found: '✔ 맞아요',
    retryCorrect: '✔ 이번엔 맞았어요',
    masteryIcon: '📖',
    masteryStamp: '배움 완료',
    masteryPraise: '핵심 내용을 잘 이해했어요.',
    summaryDone: '✔ 정리를 마쳤어요',
    questStamp: '배움 완료',
    questDone: '오늘 배운 내용을 기억해요',
    questDoneAgain: '배움을 마친 정거장이에요',
    item: '자료',
    dexTitle: '📁 살펴본 자료',
};

let calm = false;

export function setCalm(value) {
    calm = !!value;
    document.body.classList.toggle('calm', calm);
}

export const tone = key => (calm ? CALM : NORMAL)[key];
