// This Sketch's own shared code (not Library code), so it may read the engine uniforms.
#include "lib/math/const.glsl"

// Aspect-corrected coordinates: the shorter side spans -1..1.
vec2 centered(vec2 fragCoord) {
  return (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
}

// Cosine palette (Inigo Quilez).
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}
