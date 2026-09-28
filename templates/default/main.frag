uniform float speed; // @param 0..2 = 1

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // centered, -1..1 on the short side
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * speed;

    vec3 col = 0.5 + 0.5 * cos(t + uv.xyx + vec3(0.0, 2.0, 4.0));

    fragColor = vec4(col, 1.0);
}
