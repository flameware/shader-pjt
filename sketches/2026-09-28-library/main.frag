// 코드를 세 곳에서 가져오는 예제다: 프로젝트의 lib/, lygia(선택 사항, 비상업용 — ADR-0003),
// 그리고 이 Sketch 폴더 안의 common.glsl.
// 아래 include 줄은 저장할 때 엔진(Vite 플러그인)이 해당 파일 내용으로 그대로 펼쳐 넣는다.

// lib/: 프로젝트 자체 Library. valueNoise(p) — 격자 위 랜덤 값을 부드럽게 이은 노이즈(0..1).
#include "lib/noise/valueNoise.glsl"
// circle(p, r) — 원점 중심, 반지름 r인 원까지의 "부호 있는 거리"(SDF). 안쪽은 음수, 바깥은 양수.
#include "lib/sdf/circle.glsl"
// lygia: 외부 셰이더 라이브러리(node_modules/lygia). snoise(p) — 심플렉스 노이즈(-1..1).
#include "lygia/generative/snoise.glsl"
// 이 Sketch만의 공용 코드. centered()와 palette()가 여기 있다. 경로는 이 파일 기준 상대 경로.
#include "common.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // common.glsl의 centered(): 화면 중심 0, 짧은 변 -1..1인 좌표로 바꾼다(hello 예제의 uv와 같다).
  vec2 uv = centered(fragCoord);
  // 배경용 노이즈. uv*3.0으로 무늬를 촘촘하게 하고, iTime*0.2를 더해 천천히 흘러가게 한다.
  float n = valueNoise(uv * 3.0 + iTime * 0.2);
  // 원 테두리를 출렁이게 할 노이즈. 3D 노이즈의 세 번째 축에 시간을 넣으면
  // 같은 자리의 값이 시간에 따라 부드럽게 바뀐다(2D 노이즈를 시간 방향으로 움직이는 흔한 기법).
  float wobble = snoise(vec3(uv * 1.5, iTime * 0.3));
  // 반지름을 0.55 ± 0.08 범위에서 위치마다 다르게 해서 울퉁불퉁한 원의 SDF를 얻는다.
  float d = circle(uv, 0.55 + 0.08 * wobble);
  // SDF가 0인 곳이 원의 테두리. abs(d)가 0에 가까울수록 1이 되는 두께 약 0.02짜리 선.
  float ring = smoothstep(0.02, 0.0, abs(d));
  // common.glsl의 palette(): 숫자 하나를 받아 무지개색을 돌려준다.
  // 노이즈 값으로 위치마다 색을 다르게 하고, iTime*0.05로 전체 색이 천천히 돈다.
  vec3 bg = palette(n * 0.6 + iTime * 0.05);
  // 어둡게 줄인 배경 위에 흰 테두리를 섞어서 내보낸다.
  fragColor = vec4(mix(bg * 0.35, vec3(1.0), ring), 1.0);
}
