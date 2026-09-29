// 빛나는 흰 막대 하나가 화면 가운데 세로줄을 따라 위 ↔ 아래를 천천히 오가며 제멋대로 회전하고,
// 지나간 자리에 빛의 흔적을 남긴다.
// 이 Pass는 배경 없이 "빛"만 그린다(0 = 빛 없음, 1 = 흰색). 자기 지난 프레임(iChannel0)을 읽어
// 흔적을 이어 가고, 배경색은 main Pass에서 입힌다.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
uniform float width;       // @param 0.5..20 = 1
uniform float height;      // @param 10..1000 = 600
// 빛의 세기. 막대 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity;   // @param 0..20 = 10
// 켜면 빛이 막대의 양옆으로만 퍼진다(막대 양 끝에서는 나오지 않는다).
uniform bool sidesOnly;    // @param = true
// 한 번 왕복(위 → 아래 → 위)하는 데 걸리는 시간(초).
uniform float duration;    // @param 1..120 = 12
// 회전 세기. 클수록 더 많이, 더 빨리 돈다. 0이면 세로로 선 채 움직인다.
uniform float spin;        // @param 0..10 = 2
// 흔적이 사라지기까지 걸리는 프레임 수. 가장 밝은 흔적도 이 프레임 수가 지나면 완전히 사라진다.
uniform int trailFrames;   // @param 1..600 = 120

// 원점 중심, 반쪽 크기 b인 직사각형까지의 거리(안쪽은 음수).
float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// 정수 x마다 정해진 0..1 값.
float hash1(float x) {
  return fract(sin(x * 127.1 + 1.0) * 43758.5453);
}

// 1차원 그레디언트 노이즈(약 -0.5..0.5). x가 1 늘 때마다 무작위로 방향을 틀며 부드럽게 오간다.
float gnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float g0 = 2.0 * hash1(i) - 1.0;
  float g1 = 2.0 * hash1(i + 1.0) - 1.0;
  float u = f * f * (3.0 - 2.0 * f);
  return mix(g0 * f, g1 * (f - 1.0), u);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 화면 픽셀 하나가 기준 픽셀로 몇 개인지.
  float px = 1080.0 / min(iResolution.x, iResolution.y);
  // 화면 중심이 0인 기준 픽셀 좌표.
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;

  // 막대 중심의 세로 위치. 막대가 어느 쪽으로 돌아 있어도 화면 밖에 완전히 숨는 높이(화면 반 + 막대 반)에서
  // 시작해 반대쪽 같은 높이까지 간다. cos로 움직여서 위/아래 끝에서는 느려지고 가운데서 빠르다.
  float travel = 0.5 * iResolution.y * px + 0.5 * height;
  float y = travel * cos(6.2831853 * iTime / duration);
  vec2 center = vec2(0.0, y);

  // 회전 각도: 노이즈 두 겹을 더해 속도와 방향이 무작위로 부드럽게 바뀐다.
  float a = 6.2831853 * spin * (gnoise(iTime * 0.5) + 0.5 * gnoise(iTime * 1.3 + 17.0));
  // 막대 길이 방향. a = 0이면 세로(위쪽).
  vec2 dir = vec2(-sin(a), cos(a));

  // 막대 기준 좌표: x는 막대를 가로지르는 방향, y는 막대 길이 방향(막대 중심이 0).
  vec2 rel = p - center;
  vec2 q = vec2(dot(rel, vec2(dir.y, -dir.x)), dot(rel, dir));

  // 막대 가장자리까지의 거리(기준 픽셀).
  float d = sdBox(q, 0.5 * vec2(width, height));

  // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
  float glow = intensity / max(d, 0.5);
  if (sidesOnly) {
    // 거리를 가로지르는 방향으로만 재고, 막대 길이 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
    // → 막대와 같은 길이의 띠가 양옆으로 뻗는다.
    float inside = clamp(0.5 - (abs(q.y) - 0.5 * height) / px, 0.0, 1.0);
    glow = intensity / max(abs(q.x) - 0.5 * width, 0.5) * inside;
  }
  // 톤매핑: 1을 넘는 밝기를 하얗게 잘라내지 않고 1에 부드럽게 다가가게 한다.
  float light = 1.0 - exp(-glow);

  // 막대 자체: 화면 픽셀 한 칸 폭으로 안티앨리어싱한 흰 직사각형.
  float bar = clamp(0.5 - d / px, 0.0, 1.0);
  light = mix(light, 1.0, bar);

  // 흔적: 지난 프레임의 빛을 매 프레임 1/trailFrames만큼 빼서 일정한 속도로 지운다
  // (밝기 1인 곳도 trailFrames 프레임 뒤에는 0). 지금 빛이 더 밝은 곳은 지금 빛을 남긴다.
  float last = texture(iChannel0, fragCoord / iResolution.xy).r;
  light = max(last - 1.0 / float(trailFrames), light);

  fragColor = vec4(vec3(light), 1.0);
}
