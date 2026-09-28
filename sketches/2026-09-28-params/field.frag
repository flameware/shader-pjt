// A moving stripe field that `main` reads through iChannel0.
#include "common.glsl"

uniform float grain; // @param 0..1 = 0.2 step 0.01

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float stripes = 0.5 + 0.5 * sin(uv.x * 40.0 + iTime * speed * 3.0);
  float noise = fract(sin(dot(fragCoord, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
  fragColor = vec4(vec3(mix(stripes, noise, grain)), 1.0);
}
