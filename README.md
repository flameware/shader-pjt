# shader-playground

로컬에서 GLSL 프래그먼트 셰이더를 스케치하는 브라우저 플레이그라운드입니다. Vite 위에서 raw WebGL2로 그리고, 저장하면 페이지를 새로고침하지 않고 셰이더만 바뀝니다. 코드는 에디터에서 쓰고, 브라우저는 결과만 보여 줍니다.

용어(Sketch, Pass, Feedback, Parameter, Library, Capture, Output size 등)의 정의는 [`CONTEXT.md`](CONTEXT.md)에 있습니다.

## 실행

Node `^22.18.0` 또는 `>=23.6.0`이 필요합니다. WebGL2와 float 렌더 타깃(`EXT_color_buffer_float`)을 지원하는 데스크톱 브라우저가 필요합니다. Chromium 계열(Arc)과 Safari에서 확인했고, Firefox는 확인하지 않았습니다.

```sh
npm install
npm run dev        # http://localhost:5173 — 가장 최근 Sketch가 열립니다
npm test           # 단위 테스트
npm run typecheck
```

특정 Sketch는 `?sketch=<폴더 이름>`으로 엽니다. 예: `http://localhost:5173/?sketch=2026-09-28-trail`

### 새 Sketch 만들기

```sh
npm run new                          # 오늘 날짜의 새 Sketch (default Template)
npm run new -- waves                 # sketches/YYYY-MM-DD-waves/
npm run new -- -t feedback trails    # feedback Template으로 시작
npm run new -- --from                # 가장 최근 Sketch의 소스 파일을 복사
npm run new -- waves --from          # 가장 최근 Sketch를 복사하고 slug는 waves
npm run new -- --no-open waves       # 에디터를 열지 않음
```

만든 뒤 `main.frag`를 에디터로 엽니다. 에디터는 `LAUNCH_EDITOR` 환경 변수로 지정할 수 있습니다. dev server가 떠 있으면 브라우저도 새 Sketch로 넘어갑니다. 전체 옵션은 `npm run new -- --help`로 봅니다.

## Sketch

Sketch는 `sketches/<YYYY-MM-DD-slug>/` 폴더 하나입니다.

```
sketches/2026-09-28-trail/
  main.frag     # Main pass (필수) — 화면에 보이는 Pass
  blur.frag     # 다른 Pass (선택) — 파일 이름이 Pass 이름
  common.glsl   # include용 파일 (선택)
  sketch.ts     # Pass 연결과 버퍼 설정 (선택)
```

각 `.frag`는 Shadertoy처럼 `mainImage`를 구현합니다. `#version`, `precision`, `main()`, 내장 uniform은 엔진이 붙입니다.

```glsl
uniform float speed; // @param 0..2 = 1

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
    vec3 col = 0.5 + 0.5 * cos(iTime * speed + uv.xyx + vec3(0.0, 2.0, 4.0));
    fragColor = vec4(col, 1.0);
}
```

내장 uniform: `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iChannel0..3`, `iChannelResolution[4]`.

### Pass와 `sketch.ts`

Pass 이름은 폴더 바로 아래 `.frag` 파일 이름이며 `[a-z][a-z0-9_]*` 형식이어야 합니다. 하위 폴더의 `.frag`는 Pass가 아닙니다. `sketch.ts`가 없으면 `main.frag` 하나만 실행합니다.

```ts
import { defineSketch, prev } from 'playground';

export default defineSketch({
  title: 'Pixels → Main',
  output: '4:5',                      // 기본 Output size (선택)
  passes: {
    pixels: { scale: 0.125, filter: 'nearest' },
    main: { channels: ['pixels'] },   // iChannel0 = 이번 프레임의 pixels
  },
});
```

- `channels`: 배열의 위치가 `iChannelN` 슬롯입니다(최대 4개). Pass 이름을 쓰면 그 Pass의 이번 프레임 출력을, `prev('이름')`을 쓰면 지난 프레임 출력을 읽습니다.
- **Feedback**: 어느 Pass든 `prev()`로 읽히는 Sketch입니다. `templates/feedback`처럼 `main: { channels: [prev('main')] }`이면 자기 자신의 지난 프레임을 읽습니다.
- 버퍼 옵션: `format`(`rgba8` / `rgba16f` 기본 / `rgba32f`), `filter`(`linear` 기본 / `nearest`), `wrap`(`clamp` 기본 / `repeat` / `mirror`), `scale`(작업 해상도 대비 비율) 또는 `size: [w, h]`. `main`에는 `channels`, `filter`, `wrap`만 쓸 수 있습니다.
- 실행 순서는 의존 관계로 정해지고 `main`이 항상 마지막입니다. 순환, 없는 Pass, 채널 초과는 에러로, `main`이 쓰지 않는 Pass는 경고로 표시됩니다.
- `.frag`를 저장하면 시간과 Feedback을 유지한 채 셰이더만 바뀝니다. `sketch.ts`를 고치거나 `.frag`를 추가·삭제하면 페이지를 다시 불러오고 처음부터 시작합니다.

### Parameter (`@param`)

uniform 선언 뒤에 `// @param` 주석을 달면 패널에 컨트롤이 생깁니다. 값은 Sketch별로 브라우저에 저장됩니다.

```glsl
uniform float speed;  // @param 0..2 = 1              슬라이더
uniform float grain;  // @param 0..1 = 0.2 step 0.01  step 지정
uniform float gain;   // @param = 1                   범위 없는 float는 숫자 입력
uniform int count;    // @param 1..20 = 5             int는 범위 필수
uniform bool invert;  // @param = false               체크박스
uniform vec3 tint;    // @param color = #ff8040       색 (vec4는 #rrggbbaa)
uniform vec2 center;  // @param -1..1 = 0, 0          2D 패드 (범위 필수)
uniform int mode;     // @param circle|square|ring = circle   선택 (인덱스로 전달)
```

- 여러 Pass에서 같은 이름을 쓰면 하나의 Parameter로 합쳐집니다. 선언이 서로 다르면 에러입니다.
- `@param`은 Sketch 자신의 파일에서만 쓸 수 있습니다. `lib/`와 lygia 안에서는 에러입니다.
- 패널의 **현재 값 복사**는 지금 값을 기본값으로 한 `uniform … // @param …` 줄을 클립보드에 복사합니다.

### `#include`와 Library

```glsl
#include "lib/noise/valueNoise.glsl"    // 프로젝트의 lib/
#include "lygia/generative/snoise.glsl" // node_modules/lygia/ (선택)
#include "common.glsl"                  // 이 파일 기준 상대 경로
```

- 경로의 첫 부분으로만 찾습니다. `lib/...`는 프로젝트의 `lib/`, `lygia/...`는 lygia 패키지, 그 밖에는 include하는 파일 기준 상대 경로입니다([ADR-0005](docs/adr/0005-include-paths-fixed-roots-include-once.md)).
- 상대 경로는 자기 루트(Sketch 폴더, `lib/`, lygia)를 벗어날 수 없습니다. 다른 Sketch의 파일은 include할 수 없고, 공유할 코드는 `lib/`로 옮깁니다.
- 한 Pass에서 같은 파일은 한 번만 펼쳐집니다(include-once).
- include된 파일을 저장해도 hot reload됩니다. 에러는 원래 파일의 `file:line`과 include 경로로 표시됩니다.

## 화면과 단축키

컴파일 에러가 나면 마지막으로 성공한 버전이 계속 돌고, 위쪽 배너에 에러가 원래 파일 위치와 함께 표시됩니다. 고쳐서 저장하면 배너가 사라집니다.

HUD는 마우스나 키 입력이 2.5초 동안 없으면 사라지고, 입력이 있으면 다시 나타납니다.

| 키 | 동작 |
| --- | --- |
| `Space` | 일시정지 / 재생 |
| `.` | 한 프레임 진행 (일시정지) |
| `-` / `=` | 느리게 / 빠르게 (0.1×–4×) |
| `0` | 속도 1× |
| `R` | 리셋 (시간 0, Feedback 비움) |
| `⌘K` / `Ctrl+K`, `/` | Sketch 팔레트 |
| `[` / `]` | 이전 / 다음 Sketch (이름순) |
| `C` | 화면 Capture |
| `Shift+C` | Output size Capture |
| `V` | Recording 시작 / 끝 |
| `H` | HUD 끄기 / 켜기 |
| `?` | 단축키 표 |

## Output size와 Capture

패널의 **Output** 폴더에서 Output size(`window`, `1:1`, `4:5`, `9:16`, `16:9`)와 render scale을 고릅니다. `window`가 아니면 화면이 그 비율로 레터박스됩니다.

- `fit`: 화면 크기 × min(DPR, 2)로 렌더링합니다. 작업하기에 가볍습니다.
- `full`: Output size 그대로 렌더링하고 화면에 맞춰 줄여 보여 줍니다.

Capture는 PNG로 `captures/<sketch>/<sketch>_<YYYYMMDD-HHmmss>_<W>x<H>.png`에 저장됩니다(git에서 제외). 시간, 프레임, Parameter 값, git 커밋 같은 메타데이터가 PNG 안에 들어갑니다. dev server가 없으면 다운로드로 저장됩니다.

- **화면 Capture** (`C`): 지금 보이는 프레임을 그대로 저장합니다.
- **Output size Capture** (`Shift+C`): 같은 순간을 Output size로 저장합니다. Feedback 없는 Sketch는 Output size로 다시 그려서 저장합니다. Feedback Sketch는 다시 시뮬레이션할 수 없으므로 `full`일 때만 지금 프레임을 저장합니다([ADR-0001](docs/adr/0001-feedback-capture-pins-working-resolution.md)).

## Recording

`V`(또는 패널의 **Recording** 폴더 버튼)로 지금 보이는 Sketch를 H.264 mp4(60fps)로 녹화하고, 다시 `V`를 누르면 끝내고 저장합니다. 누른 순간부터 녹화하며 리셋하지 않습니다. 처음부터 담으려면 먼저 `R`을 누릅니다.

- **최대 길이**: 패널의 **최대 길이**에서 없음 / 5 / 10 / 15 / 30초를 고릅니다. Sketch별로 브라우저에 저장됩니다. 최대 길이가 없어도 60초 안전 상한에서 끝납니다. 길이는 영상 기준이라 일시정지한 구간은 세지 않습니다.
- **크기**: 엔진이 렌더링하는 그대로 녹화합니다. `window`이면 창의 render size, 그 밖의 Output size는 render scale이 `full`일 때만 녹화할 수 있습니다. `fit`이면 녹화 버튼이 막히고 `full`로 바꾸라고 안내합니다.
- **화면이 느려져도 영상은 매끄럽습니다**: 녹화 중에는 실제로 흐른 시간과 관계없이 frame마다 `iTime`이 정확히 1/60초(× 속도)씩 진행하고, 렌더링한 frame 하나가 영상 frame 하나가 됩니다. 큰 Output size에서 화면이 느리게 움직여도 영상은 60fps로 매끄럽습니다([ADR-0006](docs/adr/0006-recording-advances-time-by-fixed-frame-steps.md)). 마우스와 Parameter 조작은 실시간으로 반영됩니다.
- **녹화 중 조작**: 일시정지한 구간은 영상에 들어가지 않고, `.`은 한 frame을 녹화합니다. 속도는 `iTime` 진행량만 바꿉니다. 리셋과 셰이더 hot reload는 녹화를 이어 갑니다.
- **자동 종료**: frame 크기가 바뀌는 사건(Sketch 전환, Output size나 render scale 변경, `window`에서 창 크기 변경)이 일어나면 녹화를 끝내고 그때까지의 분량을 저장합니다. 녹화 중이거나 저장 중에 페이지를 떠나려 하면 브라우저가 확인을 묻습니다.
- **HUD**: 녹화 중에는 빨간 점, 영상 기준 경과 시간, frame 수를 보여 줍니다. HUD는 영상에 들어가지 않습니다.
- **요구 사항**: WebCodecs `VideoEncoder`가 H.264를 지원해야 합니다. 지원하지 않으면 `V`를 누를 때 이유를 toast로 알리고 시작하지 않습니다.

영상은 Capture와 같은 위치와 이름 규칙으로 `captures/<sketch>/<sketch>_<YYYYMMDD-HHmmss>_<W>x<H>.mp4`에 저장되고, 옆에 같은 이름의 `.json` sidecar가 생깁니다. 이름이 겹치면 `-2`를 붙입니다. sidecar에는 Sketch, 크기, Output size, render scale, Feedback 여부, fps, frame 수, 길이, 녹화 시작 시점의 Parameter 값(`paramsAtStart`), git 커밋, 녹화 시각이 들어갑니다. dev server가 없거나 저장에 실패하면 mp4만 다운로드됩니다.

## 라이선스

- 엔진, 플러그인, `lib/` 등 이 저장소의 자체 코드는 [MIT](LICENSE)입니다.
- `sketches/`의 Sketch와 `captures/`의 Capture에는 라이선스를 부여하지 않습니다.
- Recording의 mp4 작성에 [Mediabunny](https://mediabunny.dev)를 npm 의존성으로 씁니다. Mediabunny는 [MPL-2.0](https://www.mozilla.org/MPL/2.0/)이며 저장소에 복사하거나 수정하지 않습니다.
- [lygia](https://lygia.xyz)는 대부분 Prosperity 3.0.0 라이선스라 비상업용으로만 씁니다. lygia는 선택 사항이며 저장소에 복사하지 않습니다. 어떤 Sketch가 lygia를 쓰는지는 `grep -r '#include "lygia/' sketches`로 알 수 있습니다([ADR-0003](docs/adr/0003-lygia-optional-non-commercial.md)).
