# 실제 유물 사진 넣는 방법

지금 앱의 유물 그림은 모두 직접 그린 그림(SVG)이에요. 이 폴더에 사진을 넣고 `content/photos.js`에 한 줄을 적으면 그림 대신 사진이 보여요.
사진을 불러오지 못하면(파일 이름이 틀렸거나 인터넷이 끊겼을 때) 자동으로 원래 그림이 보이니 안심하세요.

## 순서
1. 아래 표에서 바꿀 유물을 찾아, 사진 파일 이름을 **표의 이름 그대로** 바꿔 이 `img/` 폴더에 올려요. (예: `img/handaxe.jpg`)
   - 가로세로 600px 정도, 200KB 이하로 줄이면 학교 와이파이에서도 빨리 떠요.
2. `content/photos.js`에서 그 유물 줄 맨 앞의 `//`를 지우고, `credit`에 출처를 적어요.
   ```js
   handaxe: { src: 'img/handaxe.jpg', credit: '국립중앙박물관 (공공누리 제1유형)' },
   ```
3. 저장소에 올리면 끝이에요.

## 어디서 사진을 구하나요? (저작권)
수업 자료로 나누어 쓰는 앱이므로, **자유롭게 써도 되는 사진**만 넣어 주세요.
- **국립중앙박물관 e뮤지엄** (emuseum.go.kr): 상세 화면에 **공공누리 제1유형** 표시가 있는 사진은 출처만 밝히면 자유롭게 쓸 수 있어요.
- **국가유산포털** (heritage.go.kr): 공공누리 유형을 확인하고 써요.
- **위키미디어 공용** (commons.wikimedia.org): "퍼블릭 도메인"이나 CC 라이선스(CC BY, CC BY-SA) 사진. CC 사진은 credit에 촬영자와 라이선스를 적어요.
- ❌ 블로그·쇼핑몰·교과서 사진처럼 출처가 불분명하거나 이용 허락이 없는 사진은 넣지 마세요.

## 사진 이름표
| 이름(key) | 파일 이름 | 유물·그림 |
|---|---|---|
| `handaxe` | `img/handaxe.jpg` | 주먹도끼 |
| `combPot` | `img/combPot.jpg` | 빗살무늬 토기 |
| `grinder` | `img/grinder.jpg` | 갈돌과 갈판 |
| `bipaDagger` | `img/bipaDagger.jpg` | 비파형 동검 |
| `halfMoonKnife` | `img/halfMoonKnife.jpg` | 반달 돌칼 |
| `dolmen` | `img/dolmen.jpg` | 고인돌 |
| `huntingMural` | `img/huntingMural.jpg` | 무용총 수렵도 |
| `incenseBurner` | `img/incenseBurner.jpg` | 백제 금동 대향로 |
| `goldCrown` | `img/goldCrown.jpg` | 신라 금관 |
| `ironIngot` | `img/ironIngot.jpg` | 덩이쇠 |
| `seokguram` | `img/seokguram.jpg` | 석굴암 본존불 |
| `seokgatap` | `img/seokgatap.jpg` | 불국사 석가탑 |
| `divineBell` | `img/divineBell.jpg` | 성덕대왕 신종 |
| `balhaeTile` | `img/balhaeTile.jpg` | 발해 연꽃무늬 수막새 |
| `celadonVase` | `img/celadonVase.jpg` | 고려청자 (상감 매병) |
| `tripitakaBlock` | `img/tripitakaBlock.jpg` | 팔만대장경판 |
| `jikjiBook` | `img/jikjiBook.jpg` | 직지 |
| `angbuilgu` | `img/angbuilgu.jpg` | 앙부일구 |
| `cheugugi` | `img/cheugugi.jpg` | 측우기 |
| `hunminBook` | `img/hunminBook.jpg` | 훈민정음 해례본 |
| `samgang` | `img/samgang.jpg` | 삼강행실도 |
| `turtleShip` | `img/turtleShip.jpg` | 거북선 |
| `sangpyeong` | `img/sangpyeong.jpg` | 상평통보 |
| `geojunggi` | `img/geojunggi.jpg` | 거중기 |
| `seodangPainting` | `img/seodangPainting.jpg` | 김홍도의 「서당」 |
| `cheokhwabi` | `img/cheokhwabi.jpg` | 척화비 |
| `streetcar` | `img/streetcar.jpg` | 전차 |
| `dongnipNews` | `img/dongnipNews.jpg` | 독립신문 |
| `dongnipmun` | `img/dongnipmun.jpg` | 독립문 |
| `declaration` | `img/declaration.jpg` | 3·1 운동 독립 선언서 |
| `taegukgi` | `img/taegukgi.jpg` | 태극기 |
| `malmoi` | `img/malmoi.jpg` | 우리말 사전 원고 |
| `provisionalGov` | `img/provisionalGov.jpg` | 대한민국 임시 정부 청사 |
| `liberation` | `img/liberation.jpg` | 광복을 맞은 사람들 |
| `ballotBox` | `img/ballotBox.jpg` | 5·10 총선거의 투표함 |
| `tentSchool` | `img/tentSchool.jpg` | 천막 학교 |
| `dmzFence` | `img/dmzFence.jpg` | 휴전선과 비무장 지대 |
| `hut` | `img/hut.jpg` | (이야기 카드·장면 그림) |
| `bronzeMirror` | `img/bronzeMirror.jpg` | (이야기 카드·장면 그림) |
| `cheomseongdae` | `img/cheomseongdae.jpg` | (이야기 카드·장면 그림) |
