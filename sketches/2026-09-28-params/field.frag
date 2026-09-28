// 움직이는 줄무늬에 노이즈를 섞은 배경을 그리는 Pass. main.frag가 iChannel0으로 읽는다.
// common.glsl을 가져와서 main.frag와 같은 `speed` Parameter를 함께 쓴다.
#include "common.glsl"

// Parameter 선언: 이 uniform에 붙은 주석 덕분에 패널에 슬라이더가 생긴다.
// 범위 0..1, 기본값 0.2, 슬라이더 한 칸이 0.01. 줄무늬와 노이즈를 섞는 비율로 쓴다.
uniform float grain; // @param 0..1 = 0.2 step 0.01

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 버퍼 안의 위치를 0..1로(왼쪽 아래 0, 오른쪽 위 1).
  vec2 uv = fragCoord / iResolution.xy;
  // 세로 줄무늬: x 방향으로 sin 물결을 40배 촘촘하게. 0.5+0.5*sin으로 0..1 범위.
  // iTime * speed로 옆으로 흐르고, speed 슬라이더로 흐르는 속도를 바꾼다.
  float stripes = 0.5 + 0.5 * sin(uv.x * 40.0 + iTime * speed * 3.0);
  // 셰이더에서 흔히 쓰는 간단한 의사 난수. 픽셀 좌표를 dot으로 숫자 하나로 만들고,
  // sin에 큰 수를 곱한 뒤 fract()로 소수 부분만 남기면 0..1의 "무작위처럼 보이는" 값이 된다.
  // iTime을 더해서 매 프레임 값이 바뀌어 지글거리는 필름 그레인처럼 보인다.
  float noise = fract(sin(dot(fragCoord, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
  // grain이 0이면 줄무늬만, 1이면 노이즈만. 흑백이므로 같은 값을 RGB 세 채널에 넣는다.
  fragColor = vec4(vec3(mix(stripes, noise, grain)), 1.0);
}
