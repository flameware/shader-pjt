// 움직이는 점이 서서히 사라지는 꼬리를 남기는 Feedback 예제.
// sketch.ts에서 channels: [prev('main')]로 연결했기 때문에, iChannel0은 이 Pass 자신이
// "지난 프레임에" 그린 결과다. 처음에는 검정으로 시작한다.
// 드래그하면 점이 마우스를 따라간다.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // 화면 중심 0, 짧은 변 -1..1인 좌표.
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  // 같은 픽셀의 지난 프레임 색. 텍스처는 0..1 좌표로 읽으므로 픽셀 좌표를 화면 크기로 나눈다.
  vec3 last = texture(iChannel0, fragCoord / iResolution.xy).rgb;

  // 점의 위치: x와 y를 서로 다른 속도(1.3, 2.1)의 cos/sin으로 움직이면
  // 리사주 곡선을 그리며 돌아다닌다. 0.6을 곱해 화면 안쪽에 머물게 한다.
  vec2 center = vec2(cos(iTime * 1.3), sin(iTime * 2.1)) * 0.6;
  // 마우스 버튼을 누르고 있는 동안(iMouse.z > 0)은 마우스 위치를 점의 위치로 쓴다.
  if (iMouse.z > 0.0) center = (2.0 * iMouse.xy - iResolution.xy) / min(iResolution.x, iResolution.y);

  // 점: 중심에서 거리 0이면 1, 0.08 이상이면 0인 부드러운 원(반지름 약 0.08).
  float spot = smoothstep(0.08, 0.0, length(uv - center));
  // 점의 색: 시간에 따라 바뀌는 cos 팔레트 색에 spot을 곱해서, 점 바깥은 검정(0)이 된다.
  vec3 color = (0.5 + 0.5 * cos(iTime + vec3(0.0, 2.0, 4.0))) * spot;

  // Feedback의 핵심 줄.
  // last * 0.985: 지난 프레임 색을 매 프레임 1.5%씩 어둡게 한다 → 꼬리가 서서히 사라진다.
  // max(..., color): 지금 점이 있는 곳은 새 점 색과 사라지는 꼬리 중 밝은 쪽을 남긴다.
  // 이 결과가 다음 프레임의 iChannel0(last)이 된다.
  // 참고: 이 버퍼는 float(16F)라 아주 작은 값까지 표현된다. 8비트 버퍼였다면 0.985를 곱해도
  // 반올림 때문에 값이 줄지 않아 꼬리가 희미하게 남아 버린다.
  fragColor = vec4(max(last * 0.985, color), 1.0);
}
