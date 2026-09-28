// Pulls code in three ways: the project's lib/, lygia (optional and non-commercial, ADR-0003),
// and this Sketch's own common.glsl.
#include "lib/noise/valueNoise.glsl"
#include "lib/sdf/circle.glsl"
#include "lygia/generative/snoise.glsl"
#include "common.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = centered(fragCoord);
  float n = valueNoise(uv * 3.0 + iTime * 0.2);
  float wobble = snoise(vec3(uv * 1.5, iTime * 0.3));
  float d = circle(uv, 0.55 + 0.08 * wobble);
  float ring = smoothstep(0.02, 0.0, abs(d));
  vec3 bg = palette(n * 0.6 + iTime * 0.05);
  fragColor = vec4(mix(bg * 0.35, vec3(1.0), ring), 1.0);
}
