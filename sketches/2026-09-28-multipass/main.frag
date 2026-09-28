// Main pass(화면에 보이는 Pass). sketch.ts에서 channels: ['pixels']로 연결했기 때문에
// iChannel0으로 `pixels` Pass의 이번 프레임 결과(캔버스의 1/8 크기 텍스처)를 읽을 수 있다.
// 그 텍스처의 텍셀(텍스처 픽셀) 하나하나를 둥근 타일 하나로 그린다.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 텍스처를 읽을 때는 0..1 좌표(UV)를 쓴다. 픽셀 좌표를 화면 크기로 나눠 0..1로 만든다.
  vec2 uv = fragCoord / iResolution.xy;
  // pixels 버퍼에서 이 위치의 색을 읽는다. sketch.ts에서 filter: 'nearest'로 해 두었기 때문에
  // 텍셀 사이를 섞지 않고 가장 가까운 텍셀 색을 그대로 가져온다(각진 픽셀 느낌).
  vec3 color = texture(iChannel0, uv).rgb;

  // 지금 픽셀이 pixels 버퍼의 텍셀 하나 안에서 어디쯤인지를 -0.5..0.5로 구한다.
  // iChannelResolution[0].xy는 iChannel0 텍스처의 크기(픽셀). uv에 곱하면 "몇 번째 텍셀"이 되고,
  // fract()로 소수 부분만 남기면 텍셀 안에서의 위치(0..1), 0.5를 빼면 텍셀 중심이 0이 된다.
  vec2 cell = fract(uv * iChannelResolution[0].xy) - 0.5;
  // 둥근 사각형 모양의 마스크. abs(cell) - 0.25를 0 이상으로 자른 뒤 length를 재면
  // 가운데 정사각형 영역에서는 0, 모서리 쪽으로 갈수록 커진다(모서리가 둥글어지는 핵심).
  // 여기에 0.25를 더한 값이 0.4보다 작으면 1(타일 안), 0.5보다 크면 0(타일 사이 틈)이다.
  float tile = smoothstep(0.5, 0.4, length(max(abs(cell) - 0.25, 0.0)) + 0.25);

  // 텍셀 색에 타일 마스크를 곱해서, 타일 사이 틈은 검게 만든다.
  fragColor = vec4(color * tile, 1.0);
}
