uniform float decay; // @param 0.8..1 = 0.96 step 0.001

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 st = fragCoord / iResolution.xy;  // 0..1, for reading the previous frame
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    vec3 prevCol = texture(iChannel0, st).rgb * decay;  // previous frame, fading

    vec2 p = 0.6 * vec2(cos(iTime), sin(iTime * 1.3));
    float d = smoothstep(0.05, 0.04, length(uv - p));

    fragColor = vec4(max(prevCol, vec3(d)), 1.0);  // max, not +: the trail never piles up past 1
}
