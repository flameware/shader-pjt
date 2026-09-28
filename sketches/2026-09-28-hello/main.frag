// 화면 가운데에 숨 쉬듯 커졌다 작아지는 링을 그린다.
// 드래그하면 링의 중심이 따라오고, 마우스 버튼을 누르고 있는 동안 화면이 조금 밝아진다.

// 모든 Pass의 진입점. 엔진이 픽셀마다 이 함수를 한 번씩 호출한다(Shadertoy와 같은 형식).
// fragCoord: 지금 칠하는 픽셀의 좌표(왼쪽 아래가 0,0, 픽셀 중심이라 0.5 단위로 끝난다).
// fragColor: 이 픽셀의 최종 색(RGBA)을 여기에 써서 내보낸다.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 픽셀 좌표를 "화면 중심이 0, 짧은 변이 -1..1"인 좌표로 바꾼다.
  // 2*fragCoord - iResolution: 중심을 0으로 옮기고, 짧은 변 길이로 나눠 가로세로 비율을 맞춘다.
  // 이렇게 해야 창이 가로로 길어도 원이 찌그러지지 않는다.
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

  // 링의 중심. 기본은 화면 한가운데(0,0).
  vec2 center = vec2(0.0);
  // iMouse.xy는 마지막으로 누른(드래그한) 위치의 픽셀 좌표. 한 번도 누르지 않았으면 (0,0)이다.
  if (iMouse.x > 0.0 || iMouse.y > 0.0) {
    // 마우스 위치도 uv와 같은 방식으로 바꿔서 중심으로 쓴다.
    center = (2.0 * iMouse.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
  }

  // 이 픽셀이 링 중심에서 얼마나 떨어져 있는지(거리).
  float d = length(uv - center);
  // 링: 반지름이 0.4를 기준으로 sin 때문에 0.3..0.5 사이를 오간다(iTime*2.0 → 약 3초 주기).
  // abs(d - 반지름)은 "링 선까지의 거리"이고, smoothstep(0.02, 0.0, x)는
  // x가 0이면 1, 0.02 이상이면 0이 되는 부드러운 계단이다. → 두께 약 0.02짜리 부드러운 선.
  float ring = smoothstep(0.02, 0.0, abs(d - 0.4 - 0.1 * sin(iTime * 2.0)));
  // 배경색: cos로 만드는 무지개 팔레트. RGB 채널마다 위상(0, 2, 4)을 다르게 줘서 색이 갈라지고,
  // uv.xyx를 더해 위치마다, iTime을 더해 시간에 따라 색이 흐른다. 0.5+0.5*cos로 0..1 범위로 맞춘다.
  vec3 bg = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
  // mix(a, b, t)는 a와 b를 t 비율로 섞는다. 링이 없는 곳(ring=0)은 어둡게 줄인 배경,
  // 링 위(ring=1)는 흰색이 된다.
  vec3 color = mix(bg * 0.35, vec3(1.0), ring);
  // iMouse.z는 버튼을 누르고 있는 동안 양수, 떼면 음수. 누르고 있는 동안만 전체를 조금 밝게 한다.
  if (iMouse.z > 0.0) color += 0.15;

  // 알파는 1(불투명). 캔버스가 불투명이라 알파 값은 화면에 영향을 주지 않는다.
  fragColor = vec4(color, 1.0);
}
