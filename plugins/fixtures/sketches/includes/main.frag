#include "lib/math/halve.glsl"
#include "common.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(halve(tint()), 1.0);
}
