// Every Parameter kind. Move the controls in the panel (top right); values survive a reload.
#include "common.glsl"

uniform int count;    // @param 1..20 = 5
uniform bool invert;  // @param = false
uniform vec3 tint;    // @param color = #ff8040
uniform vec4 bg;      // @param color = #00000080
uniform vec2 center;  // @param -1..1 = 0, 0
uniform int mode;     // @param circle|square|ring = circle

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  vec2 p = uv - center;
  float t = iTime * speed;

  // `count` shapes on a circle around `center`.
  float shapes = 0.0;
  for (int i = 0; i < count; i++) {
    float a = 6.2831853 * float(i) / float(count) + t;
    vec2 q = p - 0.5 * vec2(cos(a), sin(a));
    float d = mode == 0 ? length(q) - 0.12 : mode == 1 ? max(abs(q.x), abs(q.y)) - 0.1 : abs(length(q) - 0.1) - 0.02;
    shapes = max(shapes, smoothstep(0.01, 0.0, d));
  }

  vec3 field = texture(iChannel0, fragCoord / iResolution.xy).rgb;
  vec3 back = mix(field * 0.3, bg.rgb, bg.a);
  vec3 color = mix(back, tint, shapes);
  if (invert) color = 1.0 - color;
  fragColor = vec4(color, 1.0);
}
