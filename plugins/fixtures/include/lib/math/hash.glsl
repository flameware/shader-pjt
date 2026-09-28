#include "../math/const.glsl"
float hash(float x) { return fract(sin(x * PI) * 43758.5453); }
