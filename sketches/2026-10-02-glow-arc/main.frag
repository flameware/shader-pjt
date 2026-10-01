// glow-bar-6의 막대 대신, 화면 중앙의 흰 호(arc) 하나에서 빛이 새어 나온다.
// 호는 원의 위쪽 꼭대기를 가운데로 해서 좌우로 똑같이 벌어지고(180°면 위쪽 반원, 360°면 원 전체),
// rotation만큼 돌아간다. 빛은 호까지의 거리에 반비례하고, 원의 안쪽이나 바깥쪽 한쪽으로만 나온다.

// 길이 단위는 "기준 픽셀": 짧은 변을 1080px로 본 픽셀. 창 크기나 Capture 크기가 달라도 구도가 같다.
// 호의 반지름(기준 픽셀, 호 두께의 가운데까지).
uniform float radius;          // @param 1..1000 = 300
// 호가 차지하는 각도(도). 0이면 점, 180이면 반원, 360이면 원.
uniform float arcDegree;       // @param 0..360 = 180
// 호의 회전(도, 반시계 방향). 0이면 호의 가운데가 위를 향한다.
uniform float rotation;        // @param -180..180 = 0
// 빛의 세기. 호 가장자리에서 1 기준 픽셀 떨어진 곳의 (톤매핑 전) 밝기.
uniform float intensity;       // @param 0..20 = 3
uniform bool intensityOsc;     // @param = false
uniform float intensityPeriod; // @param 0.5..60 = 4
// 빛 색(호 자체는 흰색).
uniform vec3 glowColor;        // @param color = #ffffff
// 켜면 빛이 호의 안팎으로만 퍼진다(호 양 끝에서는 나오지 않는다).
uniform bool sidesOnly;        // @param = false
// 빛이 나오는 쪽: 원의 안쪽 또는 바깥쪽.
uniform int side;              // @param inner|outer = outer
// 한쪽 빛이 옆으로 줄어드는 정도. 클수록 고른 쪽 정면으로만 좁게 나온다.
uniform float sideFalloff;     // @param 0.1..16 = 2

// 호 두께(기준 픽셀).
const float WIDTH = 1.0;

// 오실레이션이 켜져 있으면 lo..hi 사이를 period초 주기로 오가는 값, 꺼져 있으면 value 그대로.
// t=0에서 최소값으로 시작한다. lo, hi는 위 @param 범위와 같은 값을 넘겨야 한다(셰이더는 범위를 모른다).
float osc(float value, bool on, float period, float lo, float hi) {
  if (!on) return value;
  return mix(lo, hi, 0.5 - 0.5 * cos(6.2831853 * iTime / period));
}

// 원점 중심, 반지름 ra, 두께의 반 rb인 호까지의 거리(안쪽은 음수). 호는 +y 방향을 가운데로
// 좌우로 반각 ap만큼 벌어지고, sc = (sin ap, cos ap). (Inigo Quilez의 sdArc)
float sdArc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

// 픽셀마다 다른 0..1 값. 디더링용.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 이번 프레임에 쓸 빛의 세기. 범위는 uniform 선언의 @param 범위와 맞춘다.
  float k = osc(intensity, intensityOsc, intensityPeriod, 0.0, 20.0);

  // 화면 픽셀 하나가 기준 픽셀로 몇 개인지.
  float px = 1080.0 / min(iResolution.x, iResolution.y);
  // 화면 중심이 0인 기준 픽셀 좌표.
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  // 호 기준 좌표: 호를 rotation만큼 돌리는 대신 좌표를 반대로 돌린다.
  float rot = radians(rotation);
  p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;

  // 호의 반각(라디안)과 그 sin, cos.
  float ap = radians(0.5 * arcDegree);
  vec2 sc = vec2(sin(ap), cos(ap));

  // 호 가장자리까지의 거리(기준 픽셀).
  float d = sdArc(p, sc, radius, 0.5 * WIDTH);
  // 원 둘레로부터의 거리(바깥이 양수). sidesOnly의 거리로 쓴다.
  float r = length(p) - radius;

  // 한쪽 빛: 호 위에서 이 픽셀과 가장 가까운 점 c와 그 점의 바깥 법선 n을 구해, c에서 이 픽셀로 가는
  // 방향이 고른 쪽 법선과 이루는 각 θ에 따라 (0.5 + 0.5 cos θ)^sideFalloff만큼 빛을 둔다. 정반대 쪽에서만 0이다.
  // 원 둘레나 끝점의 접선에서 잘라 내면 그 경계(원 윤곽, 끝점 아래 그림자 띠)가 보이므로, 각도에 따라 부드럽게 줄인다.
  // 호는 y축에 대칭이므로 x를 접은 좌표에서 계산한다(내적은 접어도 같다).
  vec2 qa = vec2(abs(p.x), p.y);
  vec2 n = sc.y * qa.x > sc.x * qa.y ? sc : qa / max(length(qa), 1e-4);
  vec2 v = qa - n * radius;
  // 호 위(|v| < 1px)에서는 방향이 정해지지 않으므로 cos를 0으로 줄인다(그 자리는 흰 호가 덮는다).
  float cosT = (side == 1 ? 1.0 : -1.0) * dot(v, n) / max(length(v), px);
  float facing = pow(clamp(0.5 + 0.5 * cosT, 0.0, 1.0), sideFalloff);

  // 빛: 거리에 반비례. 가장자리(d=0)나 안쪽에서 무한대로 튀지 않게 0.5px 하한을 둔다.
  float glow;
  if (sidesOnly) {
    // 거리를 반지름 방향으로만 재고, 호가 차지하는 각도 안쪽(가장자리 1픽셀 안티앨리어싱)에만 빛을 둔다.
    // → 호와 같은 각도의 부채꼴 띠가 뻗는다. 각도 차를 그 반지름의 호 길이로 바꿔 픽셀과 비교한다.
    float ang = atan(abs(p.x), p.y); // +y에서 잰 각도, 0..π
    float inside = clamp(0.5 + (ap - ang) * length(p) / px, 0.0, 1.0);
    glow = k / max(abs(r) - 0.5 * WIDTH, 0.5) * inside * facing;
  } else {
    glow = k / max(d, 0.5) * facing;
  }

  // 톤매핑: 1을 넘는 밝기를 하얗게 잘라내지 않고 1에 부드럽게 다가가게 한다(RGB 채널마다 따로).
  vec3 color = 1.0 - exp(-glowColor * glow);
  // 호 자체: 화면 픽셀 한 칸 폭으로 안티앨리어싱한 흰 호.
  color = mix(color, vec3(1.0), clamp(0.5 - d / px, 0.0, 1.0));

  // 어두운 그라데이션의 계단(밴딩)을 감추는 ±0.5/255 노이즈.
  color += (hash(fragCoord) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
