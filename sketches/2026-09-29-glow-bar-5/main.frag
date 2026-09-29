// trail Pass가 그린 빛(막대 + 흔적)을 배경색 위에 입혀 화면에 보여 준다.

// 배경색.
uniform vec3 background; // @param color = #000000

// 픽셀마다 다른 0..1 값. 디더링용.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // trail Pass의 이번 프레임 빛(0..1). 흰 빛이라 r만 읽는다.
  float light = texture(iChannel0, fragCoord / iResolution.xy).r;

  // 스크린 합성: 배경을 빛만큼 흰색 쪽으로 밝힌다. 빛이 0이면 배경 그대로, 1이면 흰색.
  vec3 color = 1.0 - (1.0 - background) * (1.0 - light);

  // 어두운 그라데이션의 계단(밴딩)을 감추는 ±0.5/255 노이즈.
  color += (hash(fragCoord) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
