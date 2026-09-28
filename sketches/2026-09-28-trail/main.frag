// A dot that leaves a fading trail. iChannel0 is this Pass's own previous frame (prev('main')),
// which starts black and is kept in a float buffer, so the slow fade doesn't get stuck.
// Drag to lead the dot with the mouse.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  vec3 last = texture(iChannel0, fragCoord / iResolution.xy).rgb;

  vec2 center = vec2(cos(iTime * 1.3), sin(iTime * 2.1)) * 0.6;
  if (iMouse.z > 0.0) center = (2.0 * iMouse.xy - iResolution.xy) / min(iResolution.x, iResolution.y);

  float spot = smoothstep(0.08, 0.0, length(uv - center));
  vec3 color = (0.5 + 0.5 * cos(iTime + vec3(0.0, 2.0, 4.0))) * spot;

  fragColor = vec4(max(last * 0.985, color), 1.0);
}
