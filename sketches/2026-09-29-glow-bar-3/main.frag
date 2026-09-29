// glow-bar-2에 오실레이션을 더했다: 각 Parameter를 켜면 그 값이 자기 범위의 최소값과 최대값 사이를
// 사인파로 오간다. 한 사이클(최소 → 최대 → 최소)의 길이는 Parameter마다 따로 정한다.
// 오실레이션이 켜진 Parameter는 슬라이더 값 대신 오가는 값을 쓴다.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
uniform float width;        // @param 0.5..20 = 2
uniform bool widthOsc;      // @param = false
uniform float widthPeriod;  // @param 0.5..60 = 4
uniform float height;       // @param 10..1000 = 200
uniform bool heightOsc;     // @param = false
uniform float heightPeriod; // @param 0.5..60 = 4
// 막대 개수. 360°를 같은 간격으로 나눠 놓는다.
uniform int count;          // @param 1..32 = 8
uniform bool countOsc;      // @param = false
uniform float countPeriod;  // @param 0.5..60 = 4
// 화면 중심에서 막대 안쪽 끝까지의 거리. 0이면 막대들이 중심에서 맞닿는다.
uniform float radius;       // @param 0..500 = 100
uniform bool radiusOsc;     // @param = false
uniform float radiusPeriod; // @param 0.5..60 = 4
// 빛의 세기. 막대 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity;       // @param 0..20 = 3
uniform bool intensityOsc;     // @param = false
uniform float intensityPeriod; // @param 0.5..60 = 4
// 켜면 빛이 막대의 양옆으로만 퍼진다(막대 양 끝에서는 나오지 않는다).
uniform bool sidesOnly;     // @param = false

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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 이번 프레임에 쓸 Parameter 값들. 범위는 uniform 선언의 @param 범위와 맞춘다.
  float w = osc(width, widthOsc, widthPeriod, 0.5, 20.0);
  float h = osc(height, heightOsc, heightPeriod, 10.0, 1000.0);
  // 막대 개수는 정수라서 반올림한다. 오실레이션 중에는 막대가 하나씩 생기고 사라진다.
  int n = int(floor(osc(float(count), countOsc, countPeriod, 1.0, 32.0) + 0.5));
  float r = osc(radius, radiusOsc, radiusPeriod, 0.0, 500.0);
  float k = osc(intensity, intensityOsc, intensityPeriod, 0.0, 20.0);

  // 화면 픽셀 하나가 기준 픽셀로 몇 개인지.
  float px = 1080.0 / min(iResolution.x, iResolution.y);
  // 화면 중심이 0인 기준 픽셀 좌표.
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;

  // 모든 막대의 빛을 더한 값(톤매핑 전)과, 이 픽셀이 막대 안인 정도(0..1).
  float glow = 0.0;
  float bar = 0.0;
  for (int i = 0; i < n; i++) {
    // i번째 막대의 방향. 첫 막대는 위쪽(90°)을 향하고, 나머지는 360°를 n등분한 간격으로 돈다.
    float a = 1.5707963 + 6.2831853 * float(i) / float(n);
    vec2 dir = vec2(cos(a), sin(a));
    // 막대 기준 좌표: x는 막대를 가로지르는 방향, y는 막대 길이 방향(막대 중심이 0).
    // 막대 중심은 중심에서 r + h/2만큼 dir 쪽으로 떨어져 있다.
    vec2 q = vec2(dot(p, vec2(-dir.y, dir.x)), dot(p, dir) - r - 0.5 * h);

    // 막대 가장자리까지의 거리(기준 픽셀).
    float d = sdBox(q, 0.5 * vec2(w, h));

    // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
    if (sidesOnly) {
      // 거리를 가로지르는 방향으로만 재고, 막대 길이 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
      // → 막대와 같은 길이의 띠가 양옆으로 뻗는다.
      float inside = clamp(0.5 - (abs(q.y) - 0.5 * h) / px, 0.0, 1.0);
      glow += k / max(abs(q.x) - 0.5 * w, 0.5) * inside;
    } else {
      glow += k / max(d, 0.5);
    }

    // 막대 자체: 화면 픽셀 한 칸 폭으로 안티앨리어싱한 흰 직사각형.
    bar = max(bar, clamp(0.5 - d / px, 0.0, 1.0));
  }

  // 톤매핑: 1을 넘는 밝기를 하얗게 잘라내지 않고 1에 부드럽게 다가가게 한다.
  vec3 color = vec3(1.0 - exp(-glow));
  color = mix(color, vec3(1.0), bar);

  // 어두운 그라데이션의 계단(밴딩)을 감추는 ±0.5/255 노이즈.
  color += (hash(fragCoord) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
