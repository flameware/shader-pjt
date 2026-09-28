// 저해상도 플라즈마 무늬를 그리는 Pass. 파일 이름(pixels)이 곧 Pass 이름이다.
// sketch.ts에서 scale: 0.125로 했기 때문에 이 Pass는 캔버스의 1/8 크기 버퍼에 그려진다.
// 그래서 이 Pass 안에서 iResolution은 캔버스가 아니라 이 버퍼의 크기다.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 버퍼 중심이 0, 짧은 변이 -1..1인 좌표(hello 예제의 uv와 같은 방식).
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  // 플라즈마: 서로 다른 방향·속도의 sin 물결 세 개를 더한다.
  // 첫째는 가로 방향, 둘째는 세로 방향, 셋째는 중심에서 퍼지는 동심원(length(uv)).
  // 각 항에 iTime을 다른 속도로 넣어서 물결들이 따로 움직이며 겹친다. 결과는 대략 -3..3.
  float v = sin(uv.x * 3.0 + iTime) + sin(uv.y * 4.0 - iTime * 1.3) + sin(length(uv) * 6.0 - iTime * 2.0);
  // 물결 값 v를 cos 팔레트(RGB 위상 0, 2, 4)로 색으로 바꾼다. iTime*0.5로 색 전체가 천천히 돈다.
  vec3 color = 0.5 + 0.5 * cos(v + iTime * 0.5 + vec3(0.0, 2.0, 4.0));
  // 이 결과는 화면에 바로 나가지 않고 버퍼에 저장되며, main.frag가 iChannel0으로 읽는다.
  fragColor = vec4(color, 1.0);
}
