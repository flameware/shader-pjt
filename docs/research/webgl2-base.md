# 얇은 WebGL2 기반: raw WebGL2 vs 얇은 헬퍼

> 리서치 티켓 [#2](https://github.com/flameware/shader-pjt/issues/2) (map [#1](https://github.com/flameware/shader-pjt/issues/1)) 결과. 조사일: 2026-09-28.
> 이 문서는 결정을 위한 **입력**이다. 결정 자체는 map/ADR에서 내린다.

## 요약

- **float 렌더 타깃은 WebGL2에서 사실상 어디서나 된다.** `EXT_color_buffer_float`는 Chrome 56 / Firefox 51 / Safari 15(iOS 포함)부터 지원되고, 실측 지원율이 99.9%를 넘는다. ping-pong feedback에 `RGBA16F`/`RGBA32F`를 쓸 수 있다.
- **함정은 filtering이다.** `RGBA32F` 텍스처에 `LINEAR` 필터를 쓰려면 `OES_texture_float_linear`가 필요한데, iPhone(iOS)에는 없다 (iPadOS만 지원, 실측 iOS 53%). `RGBA16F`는 WebGL2 core에서 filterable이므로 **feedback 버퍼 기본 포맷은 `RGBA16F` + `LINEAR`**가 안전하다.
- **헬퍼 후보:** twgl.js만 활발히 유지보수 중(2026-09 커밋, v7.0.0). picogl.js는 2022년 이후 커밋이 없고, regl은 WebGL1 API 기준이며, ogl은 scene-graph 성격이라 "얇은 헬퍼"에서 벗어난다.
- **코드량:** Shadertoy 버퍼 모델은 fullscreen triangle 한 개, 프로그램 N개, FBO 2N개, uniform 몇 개가 전부다. GL 계층만 보면 raw WebGL2가 **~90–120줄**, twgl.js가 **~35–50줄**로 추정된다. 줄어드는 부분은 주로 uniform setter와 FBO 생성 boilerplate다. 반면 에러 매핑, 패스 그래프, HMR, 캡처 같은 공통 로직(~150–250줄)은 어느 쪽이든 똑같이 직접 짜야 한다.
- **권장(결정 입력):** raw WebGL2 위에 작은 자체 모듈(`gl/` 약 100–150줄)을 두는 쪽을 권한다. twgl.js도 합리적인 대안이지만 절약되는 코드가 적고, 에러 오버레이·hot reload·캡처처럼 어차피 직접 짜야 하는 부분이 엔진의 대부분이다.

---

## 1. Float / half-float 렌더 타깃 지원

### 1.1 관련 extension 정리 (WebGL2 기준)

| Extension | 하는 일 | 브라우저 (MDN BCD) | 실측 지원율 (web3dsurvey, WebGL2) |
|---|---|---|---|
| `EXT_color_buffer_float` | `R16F`, `RG16F`, `RGBA16F`, `R32F`, `RG32F`, `RGBA32F`, `R11F_G11F_B10F`를 **color-renderable**로 만든다. WebGL2 전용. | Chrome 56, Firefox 51, Safari 15 (iOS mirror) | **99.94%** (iOS 100%, Safari 100%) |
| `EXT_color_buffer_half_float` | 16-bit float만 렌더 가능하게 한다. 32F 렌더를 못 하는 플랫폼을 위한 대안. | Chrome 63, Firefox 47, Safari 14 | 92.03% (Firefox 5%: Firefox는 `EXT_color_buffer_float`로 대신 노출한다) |
| `OES_texture_float_linear` | 32-bit float 텍스처의 `LINEAR` filtering을 허용한다. | Chrome 29, Firefox 24, Safari 8, **Safari iOS: "Only supported on iPadOS"** | **90.89%**, iOS **53.24%**, Safari 57.57%, Android 75.93% |
| `EXT_float_blend` | 32F 타깃에 blending을 허용한다. | Chrome 75, Firefox 67, Safari 14.1 / iOS 15 | 이번에는 조사하지 않음 |

출처: [MDN EXT_color_buffer_float](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float), [MDN EXT_color_buffer_half_float](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_half_float), [MDN OES_texture_float_linear](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float_linear), 버전 번호는 [mdn/browser-compat-data](https://github.com/mdn/browser-compat-data/tree/main/api)의 `api/*.json` 원본, 실측치는 [web3dsurvey: EXT_color_buffer_float](https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_float) / [EXT_color_buffer_half_float](https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_half_float) / [OES_texture_float_linear](https://web3dsurvey.com/webgl2/extensions/OES_texture_float_linear), 스펙은 [Khronos EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/).

WebGL2 자체는 Chrome 56 / Firefox 51 / Safari 15부터 지원된다 ([BCD WebGL2RenderingContext](https://github.com/mdn/browser-compat-data/blob/main/api/WebGL2RenderingContext.json)). 따라서 "WebGL2가 있으면 `EXT_color_buffer_float`도 있다"고 봐도 무방하다.

### 1.2 Filtering: 16F vs 32F

- WebGL2(= OpenGL ES 3.0) core에서 `RGBA16F`는 **texture-filterable**이고, `RGBA32F`는 filterable이 **아니다** ([OpenGL ES 3.0 spec, Table 3.13](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf)). `OES_texture_float_linear`가 존재하는 이유가 바로 이것이다.
- iPhone Safari에는 `OES_texture_float_linear`가 없다. `RGBA32F` + `LINEAR`는 texture incomplete가 되어 검은색으로 샘플된다.
- 따라서 모든 플랫폼에서 render와 `LINEAR` 샘플이 둘 다 보장되는 포맷은 `RGBA16F`다.

### 1.3 실무 규칙 (엔진에 반영할 것)

1. context 생성 직후 `gl.getExtension('EXT_color_buffer_float')`를 호출한다. 이 호출을 해야 활성화되므로 필수다. 없으면 `EXT_color_buffer_half_float`로 fallback하고, 둘 다 없으면 `RGBA8`로 떨어뜨리며 경고한다.
2. feedback 버퍼 기본값: `RGBA16F`, `HALF_FLOAT`, `LINEAR`, `CLAMP_TO_EDGE`.
3. 32F가 필요한 패스(시뮬레이션 누적 등)는 opt-in으로 두고 `NEAREST` 또는 `texelFetch`를 쓴다. `OES_texture_float_linear`가 있을 때만 `LINEAR`를 쓴다.
4. FBO 생성 후 `checkFramebufferStatus`로 `FRAMEBUFFER_COMPLETE`를 확인한다.
5. PNG 캡처 시 float FBO를 `readPixels`하려면 `RGBA`/`FLOAT` 조합이 필요하다 (`UNSIGNED_BYTE` 불가, [Khronos 스펙](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)). 캡처는 최종 `RGBA8` 타깃이나 canvas에서 하는 게 단순하다.

---

## 2. 헬퍼 후보 비교

데이터: GitHub API(`gh api repos/...`), npm registry(`npm view`), npm downloads API(최근 30일, 2026-08-28~09-26). 크기는 npm tarball을 받아 esbuild로 minify+gzip해서 직접 측정했다.

| 라이브러리 | WebGL2 | 최근 커밋 / 릴리스 | Stars | npm 월 다운로드 | 크기 (min+gzip) | 성격 |
|---|---|---|---|---|---|---|
| [twgl.js](https://github.com/greggman/twgl.js) | O | 2026-09-09 / v7.0.0 (2025-07) | 3.0k | 105k | full ~23KB ([bundlephobia](https://bundlephobia.com/package/twgl.js)), 우리가 쓸 함수만 tree-shake 시 **~18KB** | 함수 모음. 상태를 숨기지 않는다. |
| [picogl.js](https://github.com/tsherif/picogl.js) | O (WebGL2 전용) | **2022-01-11** / v0.17.9 (2022-06) | 0.8k | 13k | **~15.5KB** | 객체형 API (DrawCall, Framebuffer). 사실상 휴면 상태다. |
| [regl](https://github.com/regl-project/regl) | X (WebGL1 API; [#378 "Investigate WebGL 2.0 support"](https://github.com/regl-project/regl/issues/378) open) | 2026-06-22 / v2.1.1 (2024-11) | 5.6k | 3.2M | ~38KB | 함수형·선언형. `#version 300 es`, MRT, `texelFetch`를 1급으로 쓸 수 없다. |
| [ogl](https://github.com/oframe/ogl) | O | 2025-04-13 / v1.0.11 | 4.7k | 2.3M | ~34KB | 소형 scene graph (Mesh/Camera/Transform). "얇은 헬퍼"보다는 미니 three.js에 가깝다. |

twgl.js가 주는 것 ([README](https://github.com/greggman/twgl.js#readme)):
- `createProgramInfo`: 컴파일·링크와 uniform setter 자동 생성. 에러 로그에 줄 번호를 붙여 준다.
- `setUniforms(programInfo, {iTime, iResolution, iChannel0: tex})`: 타입별 `uniform*`와 sampler unit 할당을 자동 처리한다.
- `createFramebufferInfo` / `resizeFramebufferInfo` / `bindFramebufferInfo`: FBO와 첨부 텍스처를 생성하고 resize한다.
- `createBufferInfoFromArrays` / `drawBufferInfo`: fullscreen quad를 그린다. 우리 모델에서는 `gl_VertexID` 트릭을 쓰면 필요 없다.

---

## 3. 코드량 비교: Shadertoy 버퍼 모델

구현 대상: 패스 N개(Buffer A–D + Image), 각 패스는 fragment shader 하나. `iChannelN`은 다른 버퍼나 자기 자신의 이전 프레임을 가리킨다. `iTime`, `iTimeDelta`, `iFrame`, `iResolution`, `iMouse`를 쓴다.

### 3.1 공통 (어느 쪽이든 직접 짜야 하는 것)

- 사용자 코드 wrapping: `#version 300 es` / `precision` / uniform 선언 / `out vec4 fragColor; void main(){ mainImage(fragColor, gl_FragCoord.xy); }`. 약 20줄.
- 컴파일 에러를 파싱해서 사용자 코드 줄 번호로 되돌리고 오버레이에 표시한다. prefix 줄 수만큼 offset을 보정해야 하므로 twgl의 에러 포맷을 그대로 쓰기는 어렵다. 약 30–50줄.
- 패스 그래프: 실행 순서, ping-pong swap, 자기 참조 처리. 약 40줄.
- 마우스 상태 (Shadertoy `iMouse`의 zw 부호 규칙), 시간, resize, DPR. 약 40줄.
- Vite HMR로 셰이더를 교체할 때 이전 program과 FBO를 dispose하고 버퍼 내용을 유지할지 결정한다.
- 고해상도 캡처: 별도 크기의 FBO 세트로 한 프레임을 렌더한 뒤 `readPixels` → PNG로 저장.

### 3.2 raw WebGL2에서만 추가되는 것 (추정)

```ts
// fullscreen triangle: attribute/VBO 없이 동작한다
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(p*2.-1., 0., 1.); }`;
gl.bindVertexArray(gl.createVertexArray()); gl.drawArrays(gl.TRIANGLES, 0, 3);

// float 타깃 생성
function createTarget(w: number, h: number) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw …;
  return { tex, fbo };
}

// uniform: Shadertoy uniform 집합은 고정이므로 location을 캐시하고 직접 set한다
const loc = (n: string) => gl.getUniformLocation(prog, n);
gl.uniform1f(u.iTime, t); gl.uniform3f(u.iResolution, w, h, 1); gl.uniform4f(u.iMouse, …);
channels.forEach((tex, i) => { gl.activeTexture(gl.TEXTURE0 + i);
  gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[`iChannel${i}`], i); });
```

| 부분 | raw WebGL2 | twgl.js |
|---|---|---|
| compile/link + 에러 로그 | ~25줄 | ~3줄 (단, 줄 번호 보정은 어차피 직접 해야 한다) |
| fullscreen draw | ~6줄 (`gl_VertexID`) | ~6줄 (같은 트릭을 쓰거나 `createBufferInfoFromArrays`) |
| float FBO 생성/resize/dispose | ~30줄 | ~8줄 |
| uniform 설정 (고정 집합) | ~15줄 | ~5줄 |
| extension 체크 / fallback | ~10줄 | ~10줄 (twgl도 직접 해야 한다) |
| **엔진 GL 계층 합계 (추정)** | **~90–120줄** | **~35–50줄** |
| 공통 로직 (3.1) | ~150–250줄 | 동일 |

추정 근거: 위 스케치와 twgl README/API 예제를 비교했다. 실측이 아니므로 ±50% 오차가 있을 수 있다. 핵심은 **헬퍼가 줄여주는 양이 GL 계층의 60줄 안팎이고, 전체 엔진에서는 소수**라는 점이다. Shadertoy 모델은 uniform 집합이 고정이고 geometry가 없어서 헬퍼의 장점(임의 uniform/attribute 자동화)이 크게 살지 않는다.

---

## 4. 트레이드오프

**raw WebGL2**
- 장점: 의존성 0. 모든 GL 상태가 눈에 보이므로 GLSL/파이프라인 학습에 좋다 (사용자가 GLSL 초중급이므로 학습 가치가 있다). 디버깅할 때 추상화 층이 없다. 크기 0KB.
- 단점: boilerplate가 약 60–80줄 늘어난다. sampler unit이나 texture binding 실수(검은 화면)를 직접 디버깅해야 한다.

**twgl.js**
- 장점: 유지보수가 활발하고, 저자가 [webgl2fundamentals](https://webgl2fundamentals.org/)의 greggman이라 문서·예제가 풍부하다. `setUniforms`로 사용자 정의 uniform(슬라이더 등)을 붙이기가 쉬워진다.
- 단점: 약 18KB gzip 추가. 엔진 대부분(에러 매핑, 패스 그래프, HMR, 캡처)에는 도움이 안 된다. API가 `ProgramInfo`/`FramebufferInfo` 개념을 추가로 요구한다.

**picogl / regl / ogl**: 각각 휴면(picogl), WebGL1 API(regl), scene graph(ogl)라서 이 프로젝트 전제("얇게, WebGL2, GLSL ES 3.00")와 맞지 않는다. 후보에서 제외하길 권한다.

## 5. 권장 (결정을 위한 입력)

1. **raw WebGL2 + 자체 `gl/` 모듈**(`createProgram`, `createTarget`, `PingPong`, `setShadertoyUniforms`, 합계 약 100–150줄)을 권한다. 이유: 절약되는 코드가 적고, 학습 가치가 있고, 의존성이 없다.
2. 전환 조건: 나중에 **사용자 정의 uniform(GUI 슬라이더 등)**을 폭넓게 지원하거나 geometry 기반 스케치(vertex shader, 메시)로 확장하게 되면 twgl.js 도입을 재검토한다. twgl은 함수 단위라서 부분 도입이 쉽다.
3. 기본 버퍼 포맷은 `RGBA16F` + `LINEAR`로 하고, 32F는 opt-in(`NEAREST`)으로 둔다. iPhone 호환성 때문이다.

## 6. 새로 떠오른 질문 (티켓 후보)

- 버퍼별 포맷·필터·wrap 설정을 사용자에게 노출할지, 노출한다면 어떤 문법으로 할지 (Shadertoy는 UI로 노출한다).
- 사용자 정의 uniform(슬라이더/컬러 피커) 지원 여부. 헬퍼 선택에 영향을 준다.
- 고해상도 캡처 시 feedback 버퍼는 해상도 의존적이다. 캡처를 "현재 상태의 업스케일"로 할지 "고해상도로 처음부터 N프레임 재시뮬레이션"으로 할지 정해야 한다.
- HMR로 셰이더를 교체할 때 feedback 버퍼 내용을 유지할지 리셋할지.
- 모바일(iOS)을 v1 지원 대상에 넣는지. 넣는다면 32F·filtering 제약이 확정 요구사항이 된다.
