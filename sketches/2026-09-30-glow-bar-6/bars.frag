// 막대마다 한 번, 밀도 이미지의 밝기에 비례하는 확률로 중심 위치를 뽑는다(rejection sampling).
// 출력 텍셀 i의 xy = 막대 i의 중심(캔버스 UV, 0..1). main.frag가 texelFetch로 읽는다.
// 막대 번호로만 정해지므로 count를 늘려도 이미 있던 막대는 그 자리에 그대로 있다.

// 밝기에 거듭제곱을 한다. 1보다 크면 밝은 곳에 더 몰리고, 1보다 작으면 고르게 퍼진다.
uniform float densityGamma;    // @param 0.1..8 = 1
// 켜면 어두운 곳에 막대가 몰린다.
uniform bool densityInvert;    // @param = false

// 막대 하나에 해볼 후보 위치 수. 모두 떨어지면 그중 가장 밝은 곳을 쓴다.
const int TRIES = 64;

// 정수 해시(PCG 3D). 0..1 값 3개.
vec3 pcg3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec3(v) / 4294967295.0;
}

// 캔버스 UV 위치의 밀도(0..1).
float density(vec2 uv) {
  vec3 c = texture(iChannel0, uv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (densityInvert) lum = 1.0 - lum;
  return pow(clamp(lum, 0.0, 1.0), densityGamma);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  uint bar = uint(fragCoord.x);
  vec2 best = vec2(0.5);
  float bestDensity = -1.0;
  for (int t = 0; t < TRIES; t++) {
    vec3 r = pcg3(uvec3(bar, uint(t), 7u));
    float d = density(r.xy);
    // 밀도 d인 곳은 확률 d로 받아들인다.
    if (r.z < d) {
      best = r.xy;
      break;
    }
    if (d > bestDensity) {
      bestDensity = d;
      best = r.xy;
    }
  }
  fragColor = vec4(best, 0.0, 1.0);
}
