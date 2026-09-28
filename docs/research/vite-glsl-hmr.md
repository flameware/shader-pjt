# Vite에서 GLSL 상태 유지 hot reload와 `#include` 해석

- 티켓: [#3](https://github.com/flameware/shader-pjt/issues/3) (map [#1](https://github.com/flameware/shader-pjt/issues/1))
- 조사일: 2026-09-28
- 기준 버전: Vite `main` (package.json 8.3.1), `vite-plugin-glsl` 1.6.1 (`main`), GLSL ES 3.00 spec rev.6, ANGLE `main`

## 질문

`.frag`/`.glsl`을 저장하면 페이지 새로고침 없이 셰이더만 교체(시간·feedback 버퍼 유지)하려면 어떤 방법이 있는가? `#include`와 그 의존성 변경은 어떻게 전파되는가? include를 펼친 뒤 컴파일 에러 줄 번호를 원본 파일로 어떻게 되돌리는가?

## 요약

1. **Vite의 HMR 전파 규칙만 알면 셰이더 교체 자체는 쉽다.** 셰이더 파일이 JS 모듈(`export default "..."`)로 변환되기만 하면, 그걸 import하는 쪽에서 `import.meta.hot.accept(dep, cb)`로 받으면 된다. boundary가 없으면 full reload로 떨어진다.
2. **`vite-plugin-glsl`은 `#include`와 include 파일 변경 전파까지 해준다** (`this.addWatchFile` → Vite가 이를 module graph의 import로 기록). 하지만 **HMR accept 코드는 넣지 않고, 줄 번호 매핑 정보도 내보내지 않는다.** include를 펼친 뒤의 줄 번호를 원본으로 되돌릴 방법이 없다.
3. **줄 번호 매핑은 "펼칠 때 만든 줄 테이블(expanded line → {file, line})"을 JS 쪽에 들고 있는 방식이 가장 견고하다.** `#line <line> <source-string-number>`도 spec상 가능하고 ANGLE도 지원하지만, 조건부 컴파일 블록 안의 include 등 엣지 케이스가 있다.
4. **모든 주요 브라우저(Chrome, Safari, Firefox)는 셰이더를 ANGLE translator로 검증한다.** 그래서 info log 형식이 `ERROR: <string>:<line>: '<token>' : <reason>`로 사실상 통일되어 있다. 다만 token이 없는 전역 에러나 link 에러에는 줄 번호가 없다.
5. **권장:** 약 100~150줄짜리 **자체 Vite 플러그인**을 만든다. include 전개 + line table + `addWatchFile` + `export default { source, lines }`를 내보내고, 엔진 쪽 sketch loader에서 `import.meta.hot.accept`로 받는다. `vite-plugin-glsl`은 참고 구현으로만 쓴다.

## 1. Vite HMR 기본 동작 (사실 관계)

- `import.meta.hot.accept(cb)`는 self-accept이고, `accept(dep, cb)`나 `accept([deps], cb)`는 직접 의존성의 업데이트를 받는다. "A module that 'accepts' hot updates is considered an HMR boundary." 는 [Vite HMR API](https://vite.dev/guide/api-hmr)에 나오는 문장이다.
- `import.meta.hot.data`는 같은 모듈의 인스턴스가 교체되어도 유지되는 객체다. 재할당은 안 되고 property만 mutate해야 한다 ([HMR API](https://vite.dev/guide/api-hmr)). 엔진 인스턴스(GL context, feedback FBO, 시작 시각)를 여기에 붙여두면 엔진 모듈 자체가 교체되더라도 상태를 살릴 수 있다.
- `import.meta.hot.dispose` / `prune` / `invalidate` / `on(event)` / `send(event)`를 제공한다 ([HMR API](https://vite.dev/guide/api-hmr)).
- 서버는 변경된 모듈에서 importer 방향으로 boundary를 찾는다. boundary 없이 끝(dead end)에 닿으면 `full-reload`를 보낸다. [`hmr.ts`의 `propagateUpdate` / `hasDeadEnd` → `type: 'full-reload'`](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/hmr.ts)에서 확인할 수 있다. 즉 **셰이더 모듈을 accept하는 곳이 없으면 페이지가 새로고침되어 시간과 feedback이 날아간다.**
- 플러그인 훅:
  - `handleHotUpdate(ctx)` (`ctx.file`, `timestamp`, `modules`, `read()`, `server`)는 영향받는 모듈 목록을 좁히거나, 빈 배열을 반환하고 `server.ws.send`로 custom event를 보내 HMR을 완전히 직접 처리할 수 있다 ([Plugin API: handleHotUpdate](https://vite.dev/guide/api-plugin#handlehotupdate), [Client-server communication](https://vite.dev/guide/api-plugin#client-server-communication)).
  - Vite 6+에는 환경별 `hotUpdate` 훅이 있다 (`type: 'create' | 'update' | 'delete'`, `this.environment.hot.send({ type: 'custom', event, data })`) ([Environment API for plugins](https://vite.dev/guide/api-environment-plugins)). 서버 코드는 `plugin.hotUpdate ?? plugin.handleHotUpdate` 순서로 호출한다 ([hmr.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/hmr.ts)).
  - custom event 이름에는 prefix를 붙이라고 권장한다 ([Plugin API](https://vite.dev/guide/api-plugin#client-server-communication)).
- **`this.addWatchFile(id)`를 transform 안에서 호출하면 그 파일은 dev 서버의 module graph에서 해당 모듈의 import로 기록된다.** `TransformPluginContext.addWatchFile`이 `_addedImports`에 id를 넣고 ([pluginContainer.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/pluginContainer.ts)), `importAnalysis`가 "attached by pluginContainer.addWatchFile" 주석과 함께 이를 `importedUrls`에 합친다 ([importAnalysis.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/importAnalysis.ts)). 그래서 **include 파일을 저장하면 그것을 include한 셰이더 모듈이 invalidate되고 재변환되어 일반 HMR 전파를 탄다.** 이것이 "include 의존성 변경 전파"의 핵심 메커니즘이다.

## 2. 셰이더만 교체하는 방법 비교

### A. `?raw` import + `import.meta.hot.accept`

```ts
import frag from './sketch.frag?raw';
engine.setShader(frag);
if (import.meta.hot) import.meta.hot.accept('./sketch.frag?raw', (m) => m && engine.setShader(m.default));
```

- `?raw`는 Vite 내장 기능으로, 파일을 문자열로 가져온다 ([Features: Importing Asset as String](https://vite.dev/guide/assets#importing-asset-as-string)).
- 장점: 플러그인이 필요 없다.
- 단점: **`#include`를 해석하지 않는다.** include를 브라우저 런타임에서 풀려면 라이브러리 파일을 `import.meta.glob('./lib/**/*.glsl', { query: '?raw', import: 'default', eager: true })`로 전부 가져와서 JS로 전개해야 한다 ([Features: Glob Import](https://vite.dev/guide/features#glob-import)). 이렇게 하면 line table을 런타임에서 직접 만들 수 있고, glob 대상 파일이 바뀌면 glob을 가진 모듈로 HMR이 전파된다. 하지만 lygia 전체(수백~천여 파일)를 eager glob하면 dev 요청이 많아진다. 작은 자체 라이브러리라면 충분히 실용적이다.

### B. `vite-plugin-glsl` + importer 쪽 accept

- 기능: `#include` (`importKeywords` 기본 `['#include']`), 상대 경로와 `root` 기준 경로, `defaultExtension: 'glsl'`, `warnDuplicatedImports: true`, `removeDuplicatedImports: false`, `minify`, `onComplete`, `watch: true` ([README](https://github.com/UstymUkhman/vite-plugin-glsl#readme), [src/index.js](https://github.com/UstymUkhman/vite-plugin-glsl/blob/main/src/index.js)). lygia README도 web 번들러 예로 이 플러그인을 든다 ([lygia README](https://github.com/patriciogonzalezvivo/lygia#readme)).
- HMR: transform에서 `watch && !prod`일 때 `dependentChunks`의 모든 chunk에 `this.addWatchFile(chunk)`를 호출한다 ([src/index.js](https://github.com/UstymUkhman/vite-plugin-glsl/blob/main/src/index.js)). 1절의 메커니즘에 따라 **include 파일 변경은 셰이더 모듈로 전파된다.** 하지만 출력은 단순히 `export default "<shader string>"`이고 accept 코드가 없다. 그래서 A와 똑같이 importer에서 `import.meta.hot.accept('./x.frag', ...)`를 써야 한다. 과거 이슈: [#12 Hot Reload Not Firing on Included Shaders](https://github.com/UstymUkhman/vite-plugin-glsl/issues/12), [#31](https://github.com/UstymUkhman/vite-plugin-glsl/issues/31).
- 줄 번호: include 줄을 chunk 본문으로 치환만 한다. `#line`을 넣지 않고, 줄 매핑 테이블도 내보내지 않는다 ([src/loadShader.js](https://github.com/UstymUkhman/vite-plugin-glsl/blob/main/src/loadShader.js)). PR [#9 "generate sourcemaps"](https://github.com/UstymUkhman/vite-plugin-glsl/pull/9)는 JS wrapper용 build sourcemap이다. GLSL info log의 줄 번호와는 관계가 없다. `onComplete(shader)` 콜백은 이미 전개된 문자열만 받으므로 경계 정보를 복원할 수 없다. → **"원본 파일:줄" 에러 오버레이 요구사항을 이 플러그인으로는 충족할 수 없다** (fork가 필요하다).
- lygia 주의점: lygia 파일은 `#include "../math/…"`를 include guard(`#ifndef FNC_…`) **바깥**, 파일 맨 위에 둔다 ([예: generative/snoise.glsl](https://github.com/patriciogonzalezvivo/lygia/blob/main/generative/snoise.glsl)). 그래서 중복 include가 흔하고, 기본값 `warnDuplicatedImports: true`이면 경고가 쏟아진다. `removeDuplicatedImports: true`를 쓰거나 자체 구현에서 "once" 처리를 하는 게 낫다.

### C. 자체 Vite 플러그인 (권장 후보)

역할:

1. `transform`에서 `.frag/.glsl`을 받아 `#include "…"`를 재귀 전개한다 (중복은 once 처리, 순환은 에러). 전개하면서 **출력 줄마다 `{ file, line }`을 기록한 테이블**을 만든다.
2. 각 include 파일마다 `this.addWatchFile(abs)`를 호출한다. 그러면 include 변경이 자동으로 전파된다 (1절).
3. 출력은 `export default { source, lines: [[fileIdx, line], …], files: ['sketches/a.frag', 'lib/noise.glsl', …] }` 형태로 한다. dev에서 셰이더 모듈이 스스로 `import.meta.hot.accept()`하고 엔진 registry로 새 값을 넘기게 할 수도 있고(self-accept), 스케치 로더가 dep accept할 수도 있다.
4. (선택) 전개 단계에서 `#include` 파일 누락 같은 전처리 에러가 나면, 모듈을 throw시키는 대신(Vite 에러 오버레이 + 연쇄 reload 위험) `{ error }`를 export해서 엔진 오버레이로 보낸다.

custom event(`server.ws.send` / `hot.send`)로 소스만 밀어주는 방식도 가능하다. 하지만 module graph 기반 전파(`addWatchFile`)를 쓰면 의존성 추적을 직접 할 필요가 없다. 그래서 **일반 모듈 HMR + accept가 더 단순하다.** custom event는 "pass 구조 변경 → 엔진 리셋" 같은 부가 신호에만 쓰면 된다.

### 비교표

| | `?raw` + 런타임 전개 | `vite-plugin-glsl` | 자체 플러그인 |
|---|---|---|---|
| `#include` | 직접 구현 (`import.meta.glob`) | O | 직접 구현 |
| include 변경 전파 | glob 모듈 경유 O | O (`addWatchFile`) | O (`addWatchFile`) |
| 새로고침 없는 교체 | accept 필요 | accept 필요 | accept 내장 가능 |
| 원본 파일:줄 매핑 | O (런타임 테이블) | **X** | O (빌드 테이블) |
| lygia 규모 대응 | 요청 수 부담 | O | O |
| 구현량 | 작음~중간 | 0 | 중간 (~100–150줄) |

## 3. 컴파일 에러 줄 번호를 원본으로 되돌리기

### GLSL ES 3.00 spec 사실 관계 ([GLSL ES 3.00 spec, rev.6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf))

- §3.2 Source Strings: 진단 메시지는 "line number within a string **and** which source string"을 식별해야 한다. string은 0부터 센다.
- §3.4 Preprocessor: `#line line` 또는 `#line line source-string-number`. "After processing this directive (including its new-line), the implementation will behave as if it is compiling at line number *line* and source string number *source-string-number*." 즉 **ES 3.00에서는 `#line N` 다음 줄이 N이다** (ES 1.00의 "line+1" 규칙과 다르다).
- `__FILE__`은 현재 source string 번호를 가리키는 정수이고, `__LINE__`은 현재 줄이다.
- `#version 300 es`는 반드시 **첫 줄**에 있어야 한다 (§3.4). 따라서 prelude(공통 uniform 선언 등)를 주입하거나 `#line`을 넣을 때는 모두 `#version` 다음에 와야 한다.

### 브라우저 로그 형식

- Chrome은 ANGLE을 쓰고, Safari도 Safari 15부터 WebGL을 ANGLE(Metal backend) 위에서 돌린다 ([WebKit: New features in Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)). Firefox도 셰이더 검증/변환에 ANGLE translator를 쓴다 (Firefox 부분은 1차 출처로 재확인하지 못했다. 실측으로 확인할 것).
- ANGLE info log 형식: `TDiagnostics::writeInfo`에 "Format is file:linenum: 'token' : extrainfo"라고 되어 있고, `TInfoSinkBase::prefix`가 `ERROR: ` / `WARNING: `를 붙이며, `location(file, line)`은 `"<file>:<line>: "`(line이 0이면 `"<file>:?: "`)를 출력한다 ([Diagnostics.cpp](https://github.com/google/angle/blob/main/src/compiler/translator/Diagnostics.cpp), [InfoSink.cpp](https://github.com/google/angle/blob/main/src/compiler/translator/InfoSink.cpp)). 예: `ERROR: 0:12: 'foo' : undeclared identifier`.
- 주의점:
  - token이 없는 에러(`globalError`)에는 **위치가 아예 없다.**
  - `getProgramInfoLog`(link 에러: varying 불일치, 출력 누락 등)에는 보통 줄 번호가 없다. 파서는 "줄 번호 없음"을 허용해야 한다.
  - 한 에러가 여러 줄 로그를 낼 수 있고, 연쇄 에러도 있다. 마지막에 `ERROR: N compilation errors.  No code generated.` 같은 요약 줄이 붙는다(ANGLE 관례).
  - 정규식은 `/^(ERROR|WARNING):\s*(\d+):(\d+|\?):\s*(.*)$/`처럼 느슨하게 쓰고, 매칭되지 않는 줄은 원문 그대로 보여준다.
- `#line` 파싱: ANGLE `DirectiveParser::parseLine`은 line과 선택적 file 번호를 읽어 `setLineNumber(line)` / `setFileNumber(file)`을 호출한다 ([DirectiveParser.cpp](https://github.com/google/angle/blob/main/src/compiler/preprocessor/DirectiveParser.cpp)). 따라서 `#line 1 3`을 넣으면 이후 에러가 `ERROR: 3:<line>:`으로 보고된다.

### 매핑 방식 비교

1. **줄 테이블 (권장).** 전개기가 출력 줄 i마다 `{fileIdx, line}`을 기록한다. 로그의 `0:<n>`을 `lines[n-1]`로 조회하면 된다. 드라이버의 `#line` 해석에 의존하지 않고, include가 `#if` 블록 안에 있어도 테이블은 항상 정확하다(텍스트 기준이라서). prelude 주입분도 같은 테이블에 `<prelude>`로 넣으면 된다.
2. **`#line <n> <fileIdx>` 삽입.** include 시작에 `#line 1 k`, 복귀 지점에 `#line <다음줄> <부모k>`를 넣는다. 로그 자체에 원본 좌표가 찍혀서 파서가 단순해진다. 하지만 (a) include가 skip되는 조건부 그룹 안에 있으면 그 안의 `#line`도 무시되고 전개된 본문 줄 수만큼 번호가 어긋난다. (b) `__FILE__` 값이 바뀐다. (c) 드라이버 구현 차이의 위험을 떠안는다. 테이블 방식의 보조 수단으로만 고려한다.
3. **JS source map (v3).** 브라우저 devtools용이다. GL info log와는 연결되지 않아 의미가 없다.

## 4. 권장 (결정 입력)

- **자체 Vite 플러그인 C + 줄 테이블 매핑**을 권장한다.
  - include 전파는 `this.addWatchFile`로 Vite module graph에 맡긴다.
  - 셰이더 모듈은 `{ source, lines, files }`를 export한다.
  - 엔진 로더는 `import.meta.hot.accept`로 새 모듈을 받아 컴파일한다. 성공하면 program만 교체하고(시간·FBO 유지), 실패하면 이전 program을 유지한 채 로그를 테이블로 매핑해 오버레이에 표시한다.
  - 엔진 상태(GL context, FBO, t0)는 `import.meta.hot.data`에 보관해서 엔진 코드 자체의 HMR에도 대비한다.
- `vite-plugin-glsl`은 include 해석 로직(경로 규칙, 중복 처리)의 **참고 구현**으로 쓴다. 에러 줄 매핑 요구사항 때문에 그대로 쓰기는 어렵다.
- 대안: 줄 매핑을 "include 파일이면 파일명만 표시, 줄은 대략"으로 타협할 수 있다면, `vite-plugin-glsl` + `removeDuplicatedImports: true` + importer accept로 코드 0줄 시작이 가능하다.

## 5. 새로 드러난 질문 (티켓 후보)

- 스케치 단위가 `.frag` 하나인가, 아니면 TS 스케치 파일(pass 구성·uniform) + 여러 `.frag`인가? 이 선택에 따라 accept 위치와 "pass 구조 변경 감지"(TS 모듈 HMR 시 diff) 설계가 달라진다.
- lygia 사용 시 include 경로 규칙: `lygia/...`를 `node_modules/lygia`로 resolve할지, git submodule로 둘지. 그리고 lygia의 `#include`가 guard 바깥에 있어 생기는 중복 처리 정책.
- Firefox/Safari의 실제 info log 형식과 `#line` 동작을 실측하는 작은 spike (에러 파서 테스트 fixture 확보).
