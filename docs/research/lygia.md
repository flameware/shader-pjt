# lygia 도입 가능성

- Ticket: [#4](https://github.com/flameware/shader-pjt/issues/4) (part of [#1](https://github.com/flameware/shader-pjt/issues/1))
- 조사일: 2026-09-28
- 기준 버전: lygia git `main` @ [`ce08fe3`](https://github.com/patriciogonzalezvivo/lygia/commit/ce08fe351478b6c14297d103a8ce98d8e787d4d2) (2026-09-14), 소스 상 버전은 `1.4.1` ([`version.glsl`](https://github.com/patriciogonzalezvivo/lygia/blob/main/version.glsl)), npm [`lygia@1.4.1`](https://www.npmjs.com/package/lygia) (2026-02-07 publish)

## 요약

- **라이선스**: 공개 라이선스는 [Prosperity Public License 3.0.0](https://github.com/patriciogonzalezvivo/lygia/blob/main/LICENSE.md)(비상업 무료, 상업은 30일 trial)이고, 후원자·기여자에게는 [Patron License](https://lygia.xyz/license)가 추가로 붙는 dual-license 구조다. 개인 hobby 용도, public repo, 개인 SNS에 Capture 올리기는 "anticipated commercial application"이 없는 한 비상업 사용에 해당한다. 판매·의뢰·수익화가 끼면 30일이 지난 뒤에는 Patron(GitHub Sponsors) 또는 별도 상업 라이선스가 필요하다.
- **WebGL2 / GLSL ES 3.00 호환**: 문제 없다. lygia 파일에는 `#version`이나 `precision`이 없고, `texture2D` 대 `texture` 차이는 `__VERSION__ >= 300` 분기(`SAMPLER_FNC` macro)로 흡수한다.
- **가져오기**: npm 패키지나 git submodule을 로컬 파일로 두고, 우리 Vite 쪽 include resolver가 직접 읽는 방식을 권장한다. `lygia.xyz` 원격 resolve는 오늘 기준으로 버전 고정 경로와 license 페이지가 동작하지 않아 신뢰하기 어렵다.
- **include 규칙**: 모든 include가 `#include "../math/mod289.glsl"` 형태다. 즉 **include하는 파일 기준 상대경로**이고, `#ifndef FNC_*` include guard가 붙어 있어 단순 텍스트 치환 resolver로 충분하다.
- **크기**: 함수 하나당 파일 하나인 granular 구조다. `snoise`는 5파일·304줄, `fbm`은 11파일·755줄, `lighting/raymarch`는 46파일·2373줄을 끌고 온다.
- **에러 줄 번호**: flatten하면 줄 번호가 수백 줄씩 밀린다. resolver가 line map을 만들거나 `#line` directive를 넣어야 한다. 이 요구는 lygia와 무관하게 `#include`를 도입하는 것만으로 생긴다.

## 1. 라이선스

### 1.1 현재 조건

repo 루트의 [`LICENSE.md`](https://github.com/patriciogonzalezvivo/lygia/blob/main/LICENSE.md)는 **The Prosperity Public License 3.0.0**이다. 마지막 변경은 2025-09-20 커밋 `594a166`이다. 핵심 조항은 다음과 같다.

- **Purpose**: "use and share this software for noncommercial purposes for free and to try this software for commercial purposes for thirty days."
- **Personal Uses**: "Personal use for research, experiment, and testing for the benefit of public knowledge, personal study, private entertainment, hobby projects, amateur pursuits, or religious observance, without any anticipated commercial application, doesn't count as use for a commercial purpose."
- **Commercial Trial**: 상업 목적 사용은 30일까지만 허용된다. 회사 업무로 쓰면 회사 전체에 trial 1회만 인정된다.
- **Notices**: 이 소프트웨어의 일부라도 복사본을 넘겨받는 사람은 라이선스 전문과 Contributor·Source Code 줄을 함께 받아야 한다.
- **Reliability**: 기여자는 라이선스를 철회할 수 없다.

[`README.md`](https://github.com/patriciogonzalezvivo/lygia#license)의 License 절은 이 구조를 dual license로 설명한다. GitHub Sponsors 후원자와 기여자는 자동으로 **Patron License**에 추가되어 Prosperity의 비상업 조건을 무시할 수 있다. 특정 버전 하나에 묶인 영구 상업 라이선스도 따로 구매할 수 있다고 적혀 있다.

Patron License 본문(`https://lygia.xyz/license`)은 조사 시점에 HTTP 500(`401 ... api.github.com/graphql`)을 반환했다. 그래서 [2025-12-14 Wayback 스냅샷](https://web.archive.org/web/20251214162605/https://lygia.xyz/license)으로 확인했다. 주요 내용은 다음과 같다.

- 결제 플랫폼에서 "patron license" 보상이 포함된 tier에 정기 결제 중인 동안에만 유효하다.
- 비상업·copyleft 규칙을 무시할 수 있다.
- 더 큰 애플리케이션에 포함시켜 sublicense할 수 있다.

npm 메타데이터의 `license` 필드는 `"Prosperity License & Patron License (https://lygia.xyz/license)"`이다. GitHub API는 `NOASSERTION`(Other)으로 인식한다.

### 1.2 파일별 라이선스가 섞여 있음

각 `.glsl` 파일 상단 YAML 주석에 `license:` 필드가 있다. 조사 시점 657개 `.glsl`을 집계한 결과는 다음과 같다(직접 grep).

| 파일 헤더 | 개수 |
|---|---|
| Prosperity + Patron 명시 | 377 |
| MIT (예: [`generative/snoise.glsl`](https://github.com/patriciogonzalezvivo/lygia/blob/main/generative/snoise.glsl), Stefan Gustavson·Ian McEwan) | 142 |
| BSD | 3 |
| CC BY 3.0 ([`math/hammersley.glsl`](https://github.com/patriciogonzalezvivo/lygia/blob/main/math/hammersley.glsl)) | 1 |
| `license:` 필드 없음 (예: `math/mod289.glsl`) → repo 루트 LICENSE를 따른다고 보는 게 안전 | 203 |

따라서 "lygia 전체가 Prosperity"라는 말은 정확하지 않다. 다만 MIT 함수도 대개 Prosperity 헬퍼를 include하므로(예: `snoise`는 `mod289`, `permute`를 끌고 온다), 실무에서는 전체를 Prosperity로 취급하는 게 맞다.

### 1.3 이 프로젝트 시나리오별 해석

(법률 자문이 아니라 라이선스 문구를 그대로 읽은 해석이다.)

| 시나리오 | 해석 |
|---|---|
| 개인 Sketch 작업, 로컬 실행 | Personal Uses에 해당 → 무료 |
| GitHub public repo (lygia를 npm dep이나 submodule로만 참조) | lygia 복사본을 배포하지 않으므로 Notices 의무가 없다. submodule은 pointer일 뿐이고 `node_modules`는 커밋하지 않는다. |
| repo에 lygia 파일을 vendoring(복사 커밋) | "share"는 허용되지만 Notices 의무가 생긴다. `LICENSE.md` 전문과 Contributor·Source 줄을 함께 커밋해야 한다. |
| 플레이그라운드를 정적 사이트로 공개 배포 (flatten된 셰이더에 lygia 코드 포함) | 복사본 배포이므로 Notices가 필요하다. 사이트에 license 전문과 출처를 노출해야 한다. |
| Capture(PNG)를 개인 SNS에 게시 | 라이선스는 **software**를 규율하며, 렌더 결과물에 대한 별도 조항은 없다. 게시 자체는 복사본 배포가 아니다. 판단 기준은 "그 사용이 commercial purpose인가"뿐이고, 취미 게시는 Personal Uses에 해당한다. |
| Capture 판매(프린트·NFT), 클라이언트 의뢰, 수익화 채널용 제작, 회사 업무 | commercial purpose에 해당 → 30일 trial 후 Patron(Sponsors tier) 또는 상업 라이선스가 필요하다. 문구가 "anticipated commercial application"이므로, 나중에 팔 **계획**이 있는 작업도 애매해진다. |

## 2. GLSL ES 3.00 / WebGL2 호환성

- **`#version` / `precision` 없음**: 657개 `.glsl` 어디에도 `#version`과 `precision` 선언이 없다. `#version 300 es`와 `precision highp float;`는 Sketch 쪽에서 선언해야 한다. resolver는 `#version`을 항상 첫 줄로 유지하고, include는 그 뒤, 가능하면 `precision` 선언 뒤에 펼쳐야 한다.
- **`texture2D` 대 `texture`**: 코드 본문에서 `texture2D(`를 직접 호출하는 곳은 없다. 모두 [`sampler.glsl`](https://github.com/patriciogonzalezvivo/lygia/blob/main/sampler.glsl)의 macro를 거친다.
  ```glsl
  #if __VERSION__ >= 300
  #define SAMPLER_FNC(TEX, UV) texture(TEX, UV)
  #else
  #define SAMPLER_FNC(TEX, UV) texture2D(TEX, UV)
  #endif
  ```
  cube map도 [`lighting/envMap.glsl`](https://github.com/patriciogonzalezvivo/lygia/blob/main/lighting/envMap.glsl)에서 `__VERSION__ >= 300`이면 `textureLod`를 쓴다. GLSL ES 3.00에서 `__VERSION__`은 300이므로 자동으로 맞는 쪽이 선택된다.
- **`#extension GL_OES_standard_derivatives`**: `math/aastep.glsl` 등 4개 파일에 있지만 `#if defined(GL_OES_standard_derivatives)`로 감싸져 있다. ES 3.00에서는 derivatives가 core라서 이 macro가 정의되지 않고, 따라서 `#extension`이 코드 중간에 나오는 문제도 생기지 않는다. 실제 로직은 `__VERSION__ >= 300` 분기로 `dFdx`/`dFdy`를 쓴다.
- **`PLATFORM_WEBGL` define**: 37개 파일이 이 macro로 WebGL1의 loop 제약(상수 bound)을 우회한다. WebGL2에서는 dynamic loop가 되므로 정의하지 않는 편이 낫다.
- **templating via `#define`**: `SAMPLER_FNC`, `FBM_NOISE_FNC` 같은 옵션 macro는 include **전에** `#define`해야 적용된다([`CONTRIBUTE.md`](https://github.com/patriciogonzalezvivo/lygia/blob/main/CONTRIBUTE.md) Design Guidelines).
- **이름 충돌**: `math/const.glsl`은 `PI`, `TAU`, `HALF_PI` 등을 `#ifndef`로 정의한다. Sketch가 include **이후에** 다른 값으로 `#define PI`를 하면 macro 재정의 에러가 난다. 함수도 `random`, `fill`, `stroke`, `ratio` 같은 흔한 이름을 global로 쓰므로, 우리 자체 라이브러리와 이름이 겹칠 수 있다.
- **테스트 범위**: repo의 자동 테스트(`test/wesl/`, vitest + wgsl-test)는 WESL/WGSL 대상이다. GLSL은 자동 컴파일 테스트가 없다. 드물게 특정 함수가 WebGL2에서 컴파일되지 않을 수 있으며, 이런 문제는 Sketch 컴파일 에러로 드러난다.

## 3. 가져오는 방식

[`README_GLSL.md`](https://github.com/patriciogonzalezvivo/lygia/blob/main/README_GLSL.md)에 따르면 `#include`는 "up to the project developer to implement"다. 공식·커뮤니티 resolver 목록도 같은 문서에 있다.

### A. npm `lygia` (권장 후보 1)
- `lygia@1.4.1` tarball에는 `.glsl` 657개가 전부 들어 있다. HLSL/MSL/WGSL/WESL/CUDA와 WESL `dist/`까지 합치면 2740 files, 4.1 MB unpacked다(`npm view lygia`, tarball 확인).
- **주의**: `package.json`의 `exports`가 `"./*": "./dist/*/weslBundle.js"`만 노출한다. 그래서 `import x from 'lygia/generative/snoise.glsl?raw'` 같은 Node/Vite 모듈 해석은 WESL bundle 경로로 매핑되어 실패한다. 우리 resolver는 `node_modules/lygia/<path>`를 **fs로 직접 읽어야** 한다.
- npm publish(2026-02-07)가 git `main`(2026-09-14)보다 뒤처져 있다. 버전 번호는 둘 다 1.4.1이다.
- `pnpm add -D -E lygia@1.4.1`처럼 정확한 버전으로 고정하면 재현성이 확보된다.

### B. git submodule (권장 후보 2)
- 태그가 있다: `1.3.0` … `1.4.0`, `1.4.1`. 태그에 고정하면 npm보다 최신 커밋도 선택할 수 있다.
- working tree는 약 17 MB(`.git` 제외 기준, 다른 언어 포함)다. [`prune.py`](https://github.com/patriciogonzalezvivo/lygia/blob/main/prune.py)로 GLSL만 남길 수 있지만 submodule에서는 의미가 적다.
- clone할 때 `--recursive`가 필요하다는 사소한 번거로움이 있다.

### C. 원격 resolve (`lygia.xyz`): 비권장
- [`resolve.js`](https://lygia.xyz/resolve.js)는 `#include "lygia/..."` 줄을 `https://lygia.xyz/...`로 바꿔 받아오는 **1단계** 치환이다. `resolveLygia`는 동기 `XMLHttpRequest`를 쓴다. 재귀 해석은 서버가 한다. `https://lygia.xyz/generative/snoise.glsl`을 받으면 의존 파일이 이미 flatten된 254줄이 온다.
- README는 `lygia/vX.X.X/...` 패턴으로 버전을 고정할 수 있다고 하지만, 조사 시점에 `v1.4.1`, `v1.4.0`, `v1.1.3` 경로가 모두 `Path ... not found`를 반환했다. `/license` 페이지도 500이었다.
- 오프라인에서 동작하지 않고, hot reload 때마다 네트워크를 탄다. 서버가 flatten해서 주기 때문에 원본 파일 단위로 에러 줄을 매핑할 수도 없다. 우리 요구(로컬 Vite, 빠른 reload, 에러 매핑)와 맞지 않는다.
- npm의 [`resolve-lygia`](https://www.npmjs.com/package/resolve-lygia)(1.0.4, 2023-08)는 같은 원격 방식이다.

### D. vendoring (필요한 파일만 복사)
- 가장 단순하지만 Notices 의무가 생기고(§1.3), 업데이트를 직접 추적해야 한다.

### 참고: 기존 Vite 플러그인
[`vite-plugin-glsl`](https://github.com/UstymUkhman/vite-plugin-glsl)(MIT, 1.6.1, 2026-07)이 lygia의 로컬 `#include`를 해석한다고 README_GLSL.md에 소개되어 있다. 다만 v1 설계는 "thin hand-written engine"이고 에러 줄 매핑을 직접 통제해야 하므로, 자체 resolver가 적합해 보인다. 채택 여부는 별도 판단 사항이다.

## 4. `#include` 규칙과 Vite 쪽 resolver의 궁합

lygia 쪽 사실은 다음과 같다(직접 grep).

- 모든 include가 **따옴표 형식**이고(`<...>` 없음) 줄 맨 앞에 온다(들여쓰기된 include 0건).
- 경로는 **include하는 파일 기준 상대경로**다. 예: `generative/snoise.glsl` → `#include "../math/mod289.glsl"`. 루트의 묶음 파일(`math.glsl`, `sdf.glsl` 등)은 `#include "math/..."`처럼 역시 자기 위치 기준이다.
- 모든 함수가 `#ifndef FNC_<NAME>` / `#define FNC_<NAME>` guard로 감싸여 있다. 중복 include는 컴파일 에러를 내지 않고 코드만 부풀린다.
- `#if` 블록 안의 조건부 include는 657개 중 2개 파일, 3건뿐이다(`color/lut.glsl`, `draw/stroke.glsl`). `#if`를 무시하고 양쪽을 다 펼쳐도 guard 덕분에 안전하다.

우리 resolver에 필요한 것은 다음과 같다.

1. **prefix 매핑**: Sketch에서 `#include "lygia/generative/snoise.glsl"`로 쓰면 `lygia/`를 `node_modules/lygia/`(또는 submodule 경로)로 매핑한다. 이것은 lygia 공식 예제와 원격 resolver가 쓰는 관례와도 같다. 그 외 경로는 include하는 파일 기준 상대경로로 해석한다. lygia 내부 include가 전부 상대경로라서 이 규칙 하나로 재귀 해석이 된다.
2. **include-once**: 정규화된 절대경로 기준으로 한 번만 펼치고, 순환을 감지한다. guard가 있으니 필수는 아니지만 출력 크기와 line map이 깔끔해진다.
3. **`#version` 보존**: `#version 300 es`는 반드시 결과의 첫 줄이어야 한다.
4. **HMR watch**: 해석된 모든 파일을 Vite watcher에 등록한다. lygia 파일은 사실상 바뀌지 않으니 우리 자체 라이브러리 파일이 주 대상이다.
5. 이 규칙은 우리 자체 공용 라이브러리(`lib/` 등)에도 그대로 적용할 수 있다. 즉 **resolver는 lygia와 독립적으로 설계**되고, lygia는 prefix 하나로 붙는다.

## 5. 크기와 의존 구조

함수 하나당 파일 하나이고(`CONTRIBUTE.md` "Granularity"), 묶음 파일(`color/blend.glsl` → `color/blend/*.glsl`)도 있다. 이 repo의 relative include를 재귀 해석해 include-once 기준으로 측정한 값은 다음과 같다.

| include | 파일 수 | 줄 수 | 바이트 |
|---|---|---|---|
| `generative/random.glsl` | 1 | 126 | 3.5 KB |
| `sdf/circleSDF.glsl` | 1 | 30 | 0.9 KB |
| `draw/stroke.glsl` | 3 | 70 | 2.5 KB |
| `color/space/hsv2rgb.glsl` | 3 | 49 | 1.6 KB |
| `generative/snoise.glsl` | 5 | 304 | 9.9 KB |
| `generative/cnoise.glsl` | 5 | 323 | 11.7 KB |
| `color/mixOklab.glsl` | 6 | 172 | 5.8 KB |
| `filter/gaussianBlur.glsl` | 9 | 419 | 15.2 KB |
| `generative/fbm.glsl` | 11 | 755 | 23.4 KB |
| `color/blend.glsl` (묶음) | 33 | 692 | 25.8 KB |
| `math.glsl` (묶음) | 66 | 1617 | 54.4 KB |
| `lighting/raymarch.glsl` | 46 | 2373 | 71.0 KB |

- 줄 수의 상당 부분은 YAML 헤더 주석이다. 쓰지 않는 overload와 함수는 GLSL 컴파일러가 제거하므로 GPU 비용은 없다. 비용은 **컴파일 시간**(수천 줄 수준에서는 체감이 작음)과 **에러 줄 번호 밀림**에 있다.
- 묶음 파일(`math.glsl`, `sdf.glsl`, `color/blend.glsl`)보다 개별 함수 파일을 include하는 것이 좋다.
- 이 모든 것은 dev 서버에서 텍스트로 처리되며, JS bundle 크기에는 영향이 없다.

## 6. 에러 줄 번호 매핑에 미치는 영향

flatten하면 Sketch 본문 줄이 include 분량만큼 밀린다. 예: `fbm` 하나를 include하면 약 755줄이 밀린다. 그러면 WebGL `getShaderInfoLog`가 `ERROR: 0:812: ...`처럼 무의미한 위치를 가리킨다. 해결책은 두 가지다.

1. **line map 테이블**: resolver가 출력 줄 → `{file, line}` 배열을 만들고, info log의 `0:N`을 역변환한다. 브라우저 동작에 의존하지 않는다.
2. **`#line` directive**: GLSL ES 3.00은 `#line line source-string-number`를 지원한다([GLSL ES 3.00 spec](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) §3.4). 각 include 펼침 앞뒤에 `#line 1 <fileIdx>`와 `#line <resumeLine> <parentIdx>`를 넣으면 컴파일러가 `fileIdx:line` 형태로 보고한다. Chrome, Firefox, Safari의 WebGL은 ANGLE translator를 거친다. ANGLE은 info log 위치를 `file:line`으로 출력한다([`InfoSink.cpp` `TInfoSinkBase::location`](https://github.com/google/angle/blob/main/src/compiler/translator/InfoSink.cpp)). 단, 브라우저별 실제 출력은 prototype에서 확인해야 한다.

→ 1번이 더 견고하다. 2번은 결과가 로그에 그대로 드러나 디버깅이 쉽다. 둘을 같이 써도 된다. 어느 쪽이든 **lygia 전용 문제가 아니라 `#include` 기능 자체의 요구사항**이다. lygia는 include 분량이 커서 이 요구를 필수로 만들 뿐이다. lygia 내부에서 에러가 나는 경우(macro 템플릿을 잘못 설정한 경우 등)에도 file 단위 매핑이 있으면 원인 파일을 바로 알 수 있다.

## 권고 (결정을 위한 input)

1. **도입 가능, 단 "유일한 공용 라이브러리"가 아니라 "선택적 외부 라이브러리"로.** v1의 공용 라이브러리는 우리 자체 `#include` resolver와 자체 `lib/`로 정의한다. lygia는 `lygia/` prefix 매핑 하나로 붙인다. resolver를 lygia에 종속시키지 않으므로, 라이선스 상황이 바뀌어도 prefix만 떼면 된다.
2. **라이선스는 현재 용도(개인 hobby + public repo + SNS Capture 게시)에서 문제없다.** 다만 Capture 판매, 의뢰, 수익화 계획이 **조금이라도** 있으면 Prosperity의 "anticipated commercial application" 문구에 걸린다. 그 경우 GitHub Sponsors로 Patron License를 받거나, 해당 Sketch에서는 lygia를 빼야 한다. 이 판단은 사용자가 해야 한다.
3. **가져오기는 npm devDependency를 정확한 버전으로 고정(`lygia@1.4.1`)하고, fs로 직접 읽는 방식을 1순위로 권한다.** 최신 커밋이 필요하면 태그에 고정한 git submodule을 쓴다. 원격 `lygia.xyz` resolve와 vendoring은 피한다. vendoring하면 repo에 license 전문을 포함해야 한다.
4. **resolver 요구사항**: `lygia/` prefix, 상대경로, include-once, `#version` 첫 줄 보존, 해석된 파일 watch, 에러 줄 매핑(line map과/또는 `#line`).
5. **Sketch 작성 관례**: `#version 300 es`, 그다음 `precision highp float;`, 그다음 옵션 `#define`, 그다음 `#include` 순서로 쓴다. `PLATFORM_WEBGL`은 정의하지 않는다. 묶음 파일보다 개별 함수 파일을 include한다.

## Sources

- lygia repo: https://github.com/patriciogonzalezvivo/lygia (commit `ce08fe3`, 2026-09-14)
  - `LICENSE.md`, `README.md` (License 절), `README_GLSL.md`, `CONTRIBUTE.md`, `package.json`, `sampler.glsl`, `lighting/envMap.glsl`, `math/const.glsl`, `math/aastep.glsl`, `generative/snoise.glsl`, `prune.py`
- Patron License: https://lygia.xyz/license (조사 시점 500), [Wayback 2025-12-14 스냅샷](https://web.archive.org/web/20251214162605/https://lygia.xyz/license)
- Prosperity Public License 3.0.0: https://prosperitylicense.com/versions/3.0.0
- 원격 resolver: https://lygia.xyz/resolve.js, 서버 응답 예 https://lygia.xyz/generative/snoise.glsl
- npm: https://www.npmjs.com/package/lygia (`npm view lygia`, tarball 1.4.1), https://www.npmjs.com/package/resolve-lygia, https://www.npmjs.com/package/vite-plugin-glsl
- git tags: `git ls-remote --tags https://github.com/patriciogonzalezvivo/lygia.git`
- GLSL ES 3.00 spec: https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
- ANGLE info log 형식: https://github.com/google/angle/blob/main/src/compiler/translator/InfoSink.cpp
- 수치(파일 수, 줄 수, 라이선스 헤더 집계)는 위 커밋을 clone해 직접 스크립트로 측정한 값이다.
