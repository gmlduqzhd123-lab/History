// 사진이 등록되어 있으면 사진을, 없거나 불러오지 못하면 직접 그린 그림(SVG)을 보여 줌
import { h } from './dom.js';
import { art } from './art.js';
import { photos } from '../content/photos.js';

export const hasPicture = key => !!(art[key] || photos[key]);

export const creditOf = key => photos[key]?.credit || '';

// container 안에 사진(또는 그림)을 채움. alt 는 사진 설명(정답이 드러나지 않게 필요할 때만)
export function fillPicture(container, key, alt = '') {
    const photo = photos[key];
    if (!photo) {
        container.insertAdjacentHTML('afterbegin', art[key] || '');
        return container;
    }
    const img = h('img', { src: photo.src, alt, decoding: 'async' });
    img.addEventListener('error', () => {
        img.remove();
        container.insertAdjacentHTML('afterbegin', art[key] || '');
        // 사진 대신 그림이 보이므로 사진 출처 줄도 지움
        document.querySelectorAll(`.photo-credit[data-key="${key}"]`).forEach(el => el.remove());
    }, { once: true });
    container.prepend(img);
    return container;
}

export function creditLine(key) {
    const credit = creditOf(key);
    return credit ? h('div', { class: 'photo-credit', 'data-key': key }, `사진: ${credit}`) : null;
}
