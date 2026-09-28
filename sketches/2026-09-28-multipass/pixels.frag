// A low-resolution plasma. iResolution here is this buffer's size (1/8 of the canvas).
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float v = sin(uv.x * 3.0 + iTime) + sin(uv.y * 4.0 - iTime * 1.3) + sin(length(uv) * 6.0 - iTime * 2.0);
  vec3 color = 0.5 + 0.5 * cos(v + iTime * 0.5 + vec3(0.0, 2.0, 4.0));
  fragColor = vec4(color, 1.0);
}
