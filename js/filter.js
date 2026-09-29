// 비속어 거르기 (글자 사이에 기호를 넣은 변형과 초성 줄임말까지)
const badWords = ['바보', '멍청이', '씨발', '시발', '씨빨', '존나', '졸라', '개새끼', '미친', '병신', '지랄', '새끼', '뒤져', '닥쳐',
    'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄹ', 'ㅁㅊ', 'ㅈㄴ', 'ㄷㅊ'];
// 역사 정리에 자주 나오는 멀쩡한 말은 거르지 않음 (예: 영향을 미친, 시발점, 바보온달)
const safeWords = ['새끼손가락', '새끼발가락', '새끼줄', '새끼를 낳', '새끼 돼지', '새끼 동물',
    '영향을 미친', '영향을미친', '미친 영향', '미친다', '시발점', '시발역', '바보 온달', '바보온달', '뒤져서', '뒤져 보', '뒤져보', '졸라서', '졸랐'];
const badWordRegexes = badWords.map(word => new RegExp(word.split('').join('[.,\\-_*~!^@#0-9]*'), 'gi'));

export function filterProfanity(text) {
    const kept = [];
    let result = String(text);
    safeWords.forEach(word => { result = result.split(word).join(`\u0000${kept.push(word) - 1}\u0000`); });
    badWordRegexes.forEach(regex => { result = result.replace(regex, '🌸'); });
    return result.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[i]);
}
