// Reads the `pixels` buffer through iChannel0 and draws each of its texels as a rounded tile.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 color = texture(iChannel0, uv).rgb;

  // Position inside the current buffer texel, -0.5..0.5 on each axis.
  vec2 cell = fract(uv * iChannelResolution[0].xy) - 0.5;
  float tile = smoothstep(0.5, 0.4, length(max(abs(cell) - 0.25, 0.0)) + 0.25);

  fragColor = vec4(color * tile, 1.0);
}
