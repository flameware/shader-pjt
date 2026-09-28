// Aspect-corrected coordinates: the shorter side spans -1..1, so circles stay round.
// Drag to move the ring's center; the fill flashes while the button is held.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

  vec2 center = vec2(0.0);
  if (iMouse.x > 0.0 || iMouse.y > 0.0) {
    center = (2.0 * iMouse.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
  }

  float d = length(uv - center);
  float ring = smoothstep(0.02, 0.0, abs(d - 0.4 - 0.1 * sin(iTime * 2.0)));
  vec3 bg = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
  vec3 color = mix(bg * 0.35, vec3(1.0), ring);
  if (iMouse.z > 0.0) color += 0.15;

  fragColor = vec4(color, 1.0);
}
