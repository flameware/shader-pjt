// 빛나는 흰 막대 count개를 캔버스 위에 무작위로 뿌렸다. 막대마다 길이, 위치, 회전이 다르다.
// 막대마다 거리에 반비례하는 빛을 내고, 여러 막대의 빛은 더해진다.
// 무작위 값은 막대 번호로 정해지므로, count를 늘려도 이미 있던 막대는 그 자리에 그대로 있다.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
// 막대 개수.
uniform int count;             // @param 1..256 = 8
// 막대 길이의 무작위 범위(기준 픽셀). 막대마다 이 사이의 길이를 고른다.
uniform float minHeight;       // @param 1..1000 = 40
uniform float maxHeight;       // @param 1..1000 = 400
// 빛의 세기. 막대 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity;       // @param 0..20 = 3
uniform bool intensityOsc;     // @param = false
uniform float intensityPeriod; // @param 0.5..60 = 4
// 빛 색 그룹. 막대마다 앞에서부터 colorCount가지 색 중 하나를 무작위로 골라 그 색의 빛을 낸다
// (막대 자체는 흰색). 패널의 색 선택기는 늘 8개가 보이지만, colorCount 뒤의 색은 쓰이지 않는다.
uniform int colorCount;        // @param 1..8 = 5
uniform vec3 color0;           // @param color = #ffffff
uniform vec3 color1;           // @param color = #ffffff
uniform vec3 color2;           // @param color = #ffffff
uniform vec3 color3;           // @param color = #ffffff
uniform vec3 color4;           // @param color = #ffffff
uniform vec3 color5;           // @param color = #ffffff
uniform vec3 color6;           // @param color = #ffffff
uniform vec3 color7;           // @param color = #ffffff
// 켜면 빛이 막대의 양옆으로만 퍼진다(막대 양 끝에서는 나오지 않는다).
uniform bool sidesOnly;        // @param = false

// 막대 너비(기준 픽셀). 모든 막대가 같다.
const float WIDTH = 2.0;

// 오실레이션이 켜져 있으면 lo..hi 사이를 period초 주기로 오가는 값, 꺼져 있으면 value 그대로.
// t=0에서 최소값으로 시작한다. lo, hi는 위 @param 범위와 같은 값을 넘겨야 한다(셰이더는 범위를 모른다).
float osc(float value, bool on, float period, float lo, float hi) {
  if (!on) return value;
  return mix(lo, hi, 0.5 - 0.5 * cos(6.2831853 * iTime / period));
}

// 원점 중심, 반쪽 크기 b인 직사각형까지의 거리(안쪽은 음수).
float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// 픽셀마다 다른 0..1 값. 디더링용.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 막대 번호 i마다 정해진 0..1 값 4개(x 위치, y 위치, 회전, 길이에 쓴다).
vec4 hash4(float i) {
  return fract(sin(vec4(i * 127.1, i * 311.7, i * 74.7, i * 269.5) + 1.0) * 43758.5453);
}

// 막대 번호 i마다 정해진 0..1 값 하나(빛 색 고르기에 쓴다).
float hash1(float i) {
  return fract(sin(i * 419.2 + 3.0) * 43758.5453);
}

// 색 그룹의 idx번째 색(0..7).
vec3 groupColor(int idx) {
  if (idx == 0) return color0;
  if (idx == 1) return color1;
  if (idx == 2) return color2;
  if (idx == 3) return color3;
  if (idx == 4) return color4;
  if (idx == 5) return color5;
  if (idx == 6) return color6;
  return color7;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 이번 프레임에 쓸 빛의 세기. 범위는 uniform 선언의 @param 범위와 맞춘다.
  float k = osc(intensity, intensityOsc, intensityPeriod, 0.0, 20.0);

  // 화면 픽셀 하나가 기준 픽셀로 몇 개인지.
  float px = 1080.0 / min(iResolution.x, iResolution.y);
  // 화면 중심이 0인 기준 픽셀 좌표.
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  // 캔버스의 반쪽 크기(기준 픽셀). 막대 중심은 이 안에 뿌린다.
  vec2 halfSize = 0.5 * iResolution.xy * px;

  // 모든 막대의 빛을 색까지 더한 값(톤매핑 전)과, 이 픽셀이 막대 안인 정도(0..1).
  vec3 glow = vec3(0.0);
  float bar = 0.0;
  for (int i = 0; i < count; i++) {
    vec4 rnd = hash4(float(i));
    // 막대 중심: 캔버스 안의 무작위 위치.
    vec2 center = (2.0 * rnd.xy - 1.0) * halfSize;
    // 막대 방향: 0..180° 중 무작위(직사각형은 180° 돌리면 같은 모양이다).
    float a = 3.1415927 * rnd.z;
    vec2 dir = vec2(cos(a), sin(a));
    float h = mix(minHeight, maxHeight, rnd.w);
    // 빛 색: 색 그룹의 앞 colorCount가지 중 무작위 하나.
    vec3 tint = groupColor(int(hash1(float(i)) * float(colorCount)));

    // 막대 기준 좌표: x는 막대를 가로지르는 방향, y는 막대 길이 방향(막대 중심이 0).
    vec2 rel = p - center;
    vec2 q = vec2(dot(rel, vec2(-dir.y, dir.x)), dot(rel, dir));

    // 막대 가장자리까지의 거리(기준 픽셀).
    float d = sdBox(q, 0.5 * vec2(WIDTH, h));

    // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
    if (sidesOnly) {
      // 거리를 가로지르는 방향으로만 재고, 막대 길이 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
      // → 막대와 같은 길이의 띠가 양옆으로 뻗는다.
      float inside = clamp(0.5 - (abs(q.y) - 0.5 * h) / px, 0.0, 1.0);
      glow += tint * (k / max(abs(q.x) - 0.5 * WIDTH, 0.5) * inside);
    } else {
      glow += tint * (k / max(d, 0.5));
    }

    // 막대 자체: 화면 픽셀 한 칸 폭으로 안티앨리어싱한 흰 직사각형.
    bar = max(bar, clamp(0.5 - d / px, 0.0, 1.0));
  }

  // 톤매핑: 1을 넘는 밝기를 하얗게 잘라내지 않고 1에 부드럽게 다가가게 한다(RGB 채널마다 따로).
  vec3 color = 1.0 - exp(-glow);
  color = mix(color, vec3(1.0), bar);

  // 어두운 그라데이션의 계단(밴딩)을 감추는 ±0.5/255 노이즈.
  color += (hash(fragCoord) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
