// glow-bar를 바퀴살처럼 늘어놓았다: 빛나는 흰 막대 count개가 화면 중심을 둘러싸고 바깥을 향한다.
// 막대마다 거리에 반비례하는 빛을 내고, 여러 막대의 빛은 더해진다.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
uniform float width;     // @param 0.5..20 = 2
uniform float height;    // @param 10..1000 = 200
// 막대 개수. 360°를 같은 간격으로 나눠 놓는다.
uniform int count;       // @param 1..32 = 8
// 화면 중심에서 막대 안쪽 끝까지의 거리. 0이면 막대들이 중심에서 맞닿는다.
uniform float radius;    // @param 0..500 = 100
// 빛의 세기. 막대 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity; // @param 0..20 = 3
// 켜면 빛이 막대의 양옆으로만 퍼진다(막대 양 끝에서는 나오지 않는다).
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

  // 모든 막대의 빛을 더한 값(톤매핑 전)과, 이 픽셀이 막대 안인 정도(0..1).
  float glow = 0.0;
  float bar = 0.0;
  for (int i = 0; i < count; i++) {
    // i번째 막대의 방향. 첫 막대는 위쪽(90°)을 향하고, 나머지는 360°를 count등분한 간격으로 돈다.
    float a = 1.5707963 + 6.2831853 * float(i) / float(count);
    vec2 dir = vec2(cos(a), sin(a));
    // 막대 기준 좌표: x는 막대를 가로지르는 방향, y는 막대 길이 방향(막대 중심이 0).
    // 막대 중심은 중심에서 radius + height/2만큼 dir 쪽으로 떨어져 있다.
    vec2 q = vec2(dot(p, vec2(-dir.y, dir.x)), dot(p, dir) - radius - 0.5 * height);

    // 막대 가장자리까지의 거리(기준 픽셀).
    float d = sdBox(q, 0.5 * vec2(width, height));

    // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
    if (sidesOnly) {
      // 거리를 가로지르는 방향으로만 재고, 막대 길이 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
      // → 막대와 같은 길이의 띠가 양옆으로 뻗는다.
      float inside = clamp(0.5 - (abs(q.y) - 0.5 * height) / px, 0.0, 1.0);
      glow += intensity / max(abs(q.x) - 0.5 * width, 0.5) * inside;
    } else {
      glow += intensity / max(d, 0.5);
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
