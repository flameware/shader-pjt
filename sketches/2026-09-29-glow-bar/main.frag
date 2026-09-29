// 검은 바탕 한가운데의 가늘고 긴 흰 막대에서 흰 빛이 바깥으로 번진다.
// Zach Lieberman의 초기 스케치에서 자주 보이는 가장 원시적인 형태: 도형 하나 + 거리에 반비례하는 빛.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
uniform float width;     // @param 0.5..20 = 2
uniform float height;    // @param 10..1000 = 200
// 빛의 세기. 막대 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity; // @param 0..20 = 3
// 켜면 빛이 막대의 왼쪽/오른쪽으로만 퍼진다(위/아래 끝에서는 나오지 않는다).
uniform bool sidesOnly;  // @param = false

// 원점 중심, 반쪽 크기 b인 직사각형까지의 거리(안쪽은 음수).
float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// 픽셀마다 다른 0..1 값. 디더링용.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 화면 픽셀 하나가 기준 픽셀로 몇 개인지.
  float px = 1080.0 / min(iResolution.x, iResolution.y);
  // 화면 중심이 0인 기준 픽셀 좌표.
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;

  // 막대 가장자리까지의 거리(기준 픽셀).
  float d = sdBox(p, 0.5 * vec2(width, height));

  // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
  float glow = intensity / max(d, 0.5);
  if (sidesOnly) {
    // 거리를 가로 방향으로만 재고, 막대 높이 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
    // → 막대와 같은 높이의 띠가 좌우로 뻗는다.
    float inside = clamp(0.5 - (abs(p.y) - 0.5 * height) / px, 0.0, 1.0);
    glow = intensity / max(abs(p.x) - 0.5 * width, 0.5) * inside;
  }
  // 톤매핑: 1을 넘는 밝기를 하얗게 잘라내지 않고 1에 부드럽게 다가가게 한다.
  vec3 color = vec3(1.0 - exp(-glow));

  // 막대 자체: 화면 픽셀 한 칸 폭으로 안티앨리어싱한 흰 직사각형.
  float bar = clamp(0.5 - d / px, 0.0, 1.0);
  color = mix(color, vec3(1.0), bar);

  // 어두운 그라데이션의 계단(밴딩)을 감추는 ±0.5/255 노이즈.
  color += (hash(fragCoord) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
