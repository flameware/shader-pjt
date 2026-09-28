// 모든 종류의 Parameter를 보여 주는 예제. 오른쪽 위 패널에서 값을 바꿔 보면 바로 반영되고,
// 값은 브라우저에 저장되어 새로고침해도 유지된다.
// common.glsl에 speed가 선언되어 있어서, field.frag와 이 파일이 같은 speed 값을 공유한다.
#include "common.glsl"

// 아래 uniform들은 각각 패널의 컨트롤 하나가 된다. 각 줄 끝의 주석이 컨트롤 종류와 범위를 정한다.
// int, 범위 1..20, 기본 5 → 정수 슬라이더. 원 둘레에 놓을 도형 개수.
uniform int count;    // @param 1..20 = 5
// bool, 기본 false → 체크박스. 켜면 색을 반전한다.
uniform bool invert;  // @param = false
// vec3 color → 색 선택기(RGB). 도형 색. 16진 색은 0..1 값으로 바뀌어 전달된다.
uniform vec3 tint;    // @param color = #ff8040
// vec4 color → 알파가 있는 색 선택기. 기본은 검정에 알파 0x80(약 0.5). 배경 색과 그 진하기.
uniform vec4 bg;      // @param color = #00000080
// vec2, 범위 -1..1 → 2D 패드. 도형들이 둘러쌀 중심 위치(uv 좌표계 기준).
uniform vec2 center;  // @param -1..1 = 0, 0
// 선택지 목록 → 드롭다운. 셰이더에는 고른 항목의 순서 번호(0, 1, 2)가 int로 전달된다.
uniform int mode;     // @param circle|square|ring = circle

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 화면 중심 0, 짧은 변 -1..1인 좌표.
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  // center 기준의 상대 위치. 이후 계산은 center가 원점인 것처럼 할 수 있다.
  vec2 p = uv - center;
  // 회전 각도로 쓸 시간. speed 슬라이더로 회전 속도가 바뀐다.
  float t = iTime * speed;

  // center 주위의 원 위에 도형 count개를 같은 간격으로 놓고, 시간에 따라 돌린다.
  // shapes는 "이 픽셀이 도형 안인 정도"(0..1). 여러 도형 중 가장 큰 값을 남긴다.
  float shapes = 0.0;
  for (int i = 0; i < count; i++) {
    // i번째 도형의 각도. 6.2831853은 2π(한 바퀴). 한 바퀴를 count등분하고 t만큼 돌린다.
    float a = 6.2831853 * float(i) / float(count) + t;
    // 반지름 0.5인 원 위의 도형 중심을 원점으로 옮긴 좌표. q가 (0,0)이면 도형 한가운데.
    vec2 q = p - 0.5 * vec2(cos(a), sin(a));
    // mode에 따라 도형까지의 거리(SDF, 안쪽 음수)를 고른다. 삼항 연산자를 두 번 이어 쓴 것:
    //   mode 0 circle: length(q) - 0.12 → 반지름 0.12인 원
    //   mode 1 square: max(|x|, |y|) - 0.1 → 반쪽 변 0.1인 정사각형
    //   mode 2 ring:   | length(q) - 0.1 | - 0.02 → 반지름 0.1, 두께 0.04인 고리
    float d = mode == 0 ? length(q) - 0.12 : mode == 1 ? max(abs(q.x), abs(q.y)) - 0.1 : abs(length(q) - 0.1) - 0.02;
    // d가 0 이하(도형 안)면 1, 0.01 이상(바깥)이면 0. 경계는 0.01 폭으로 부드럽게(안티앨리어싱).
    shapes = max(shapes, smoothstep(0.01, 0.0, d));
  }

  // field Pass가 그린 줄무늬를 iChannel0에서 읽는다(sketch.ts의 channels 설정).
  vec3 field = texture(iChannel0, fragCoord / iResolution.xy).rgb;
  // 배경: 어둡게 줄인 줄무늬 위에 bg 색을 bg의 알파만큼 덮는다(알파 0이면 줄무늬만, 1이면 bg 색만).
  vec3 back = mix(field * 0.3, bg.rgb, bg.a);
  // 도형이 있는 곳은 tint 색, 없는 곳은 배경.
  vec3 color = mix(back, tint, shapes);
  // invert 체크박스가 켜져 있으면 색을 반전한다(1 - 색).
  if (invert) color = 1.0 - color;
  fragColor = vec4(color, 1.0);
}
