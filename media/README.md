# 사용법 영상

`history-quest-guide.mp4`는 실제 앱 화면을 사용한 45초 안내 영상입니다.
한국어 화면 안내와 선택 가능한 자막, 경쾌한 배경음악·단계 전환 효과음으로 구성합니다.
샘플 탐험가와 기록은 영상 제작용 예시입니다.

- H.264 Main 3.1, 1280×720, 25fps, yuv420p, fast-start MP4
- AAC-LC, 48kHz 스테레오, 128kbps. 음악·효과음 전체는 약 -20 LUFS로 조절하며
  시작·끝은 부드럽게 페이드합니다. 주요 단계에는 짧은 두 음의 알림음,
  중간 동작에는 작은 현악기 느낌의 효과음을 사용합니다.
- 회원 가입 없는 시작 → 이름·번호·캐릭터 → 정거장과 유물 → 다섯 학습 단계
  → 자료 탐구 → 역사 노트·인쇄·PDF → 같은 기기 기록과 이어하기 코드
- 코드는 진도만 옮기며 작성한 글은 현재 기기에 남습니다.
- 앱 자체 그림과 자체 호스팅 Pretendard/Noto Serif KR 글꼴을 사용했습니다.
  글꼴의 라이선스는 `fonts/`에서 확인할 수 있습니다.
- 음악·효과음은 `create-guide-audio.py`로 프로젝트용으로 직접 합성했습니다.
  112 BPM의 밝은 마림바·현악기 느낌으로 구성하며 외부 음악·샘플·음성은 사용하지 않았습니다.

소개 화면의 통계 바로 다음에 배치됩니다. 영상은 자동 재생하지 않고
`preload="none"`으로 첫 방문에 다운로드하지 않습니다.
재생 버튼을 누르면 소리가 나오며 기본 영상 컨트롤로 음량·음소거를 조절합니다.
음소거 상태에서도 화면 안내·한국어 자막과 옆의 글 안내를 사용할 수 있습니다.
선택 영상은 학습 앱의 필수 오프라인 설치와 분리됩니다. 설치 후 새로 연
페이지에서 전체 영상을 받아 저장했다면 오프라인 재생·탐색을 지원합니다.
첫 영상을 볼 때는 인터넷 연결이 필요합니다.

오디오를 다시 생성하려면 Python 3, NumPy, FFmpeg가 필요합니다. 저장소 루트에서
아래 명령을 실행하면 기존 화면은 재인코딩하지 않고 음악·효과음만 교체합니다.
출력 영상의 재생을 검증한 뒤 `media/history-quest-guide.mp4`에 반영하세요.

```sh
python3 media/create-guide-audio.py /tmp/history-quest-guide-audio.wav
ffmpeg -y -i media/history-quest-guide.mp4 -i /tmp/history-quest-guide-audio.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -af loudnorm=I=-20:TP=-2:LRA=7 -t 45 -movflags +faststart \
  /tmp/history-quest-guide-with-audio.mp4
```

같은 영상 경로에 새 파일을 반영할 때는 `sw.js`의 캐시 버전도 올려야
기존 설치가 이전 영상 대신 새 영상을 저장합니다.

앱의 주요 화면이나 버튼이 바뀌면 영상과 포스터를 함께 다시 녹화하고
자막의 시간과 글 안내를 확인하세요. 게시 전에 `ffprobe`로 형식·길이를,
`ffmpeg -v error -i media/history-quest-guide.mp4 -f null -`로 디코딩을 확인하고,
`tests/guide-video.py`, `tests/guide-video-offline.py`로 실제 재생을 검증하세요.

# 배경음악

`history-quest-bgm.mp3`는 Suno로 만든 3분 37초 연주곡입니다(만든 사람: hallyo11).
원본(182kbps, 표지 그림 포함, 4.9MB)에서 앞의 0.5초 무음을 잘라 내고
-26 LUFS로 작게 맞춘 뒤 1.5초 페이드인·3초 페이드아웃을 넣어
80kbps 스테레오 MP3(약 2.2MB)로 만들었습니다. 반복 재생할 때 이음새가 부드럽습니다.

- 처음에는 꺼져 있습니다. 교실에서 여러 기기가 동시에 울리지 않게 하기 위해서입니다.
  학생이 화면 위쪽 🔇/🎵 버튼으로 켜면 이 기기에 설정을 기억합니다(`history-quest:bgm`).
- 브라우저의 자동 재생 제한 때문에 켜 둔 기기도 첫 터치·키 입력 뒤에 재생합니다.
- 6·25 전쟁처럼 차분한 화면(`body.calm`), 다른 앱으로 전환했을 때,
  사용법 영상을 재생하는 동안에는 멈춥니다. 읽어 주기 목소리가 나오는 동안에는 작게 줄입니다.
- 파일 자체를 작게 만든 이유는 iOS처럼 웹에서 음량을 바꿀 수 없는 기기에서도
  조용하게 들리게 하기 위해서입니다.
- 음악을 켠 기기만 파일을 받습니다. 사용법 영상과 같은 방식으로 받은 뒤 저장해
  오프라인에서도 재생할 수 있고, 학습 앱의 필수 오프라인 설치에는 포함하지 않습니다.

다른 곡으로 바꿀 때는 같은 경로에 새 파일을 반영하고 `sw.js`의 캐시 버전을 올리세요.

```sh
ffmpeg -y -ss 0.5 -i 원본.mp3 -map 0:a:0 -map_metadata -1 \
  -af "loudnorm=I=-26:TP=-6:LRA=11,afade=t=in:d=1.5,areverse,afade=t=in:d=3,areverse" \
  -c:a libmp3lame -b:a 80k -ar 44100 -ac 2 media/history-quest-bgm.mp3
```
