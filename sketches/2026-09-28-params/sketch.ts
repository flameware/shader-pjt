// sketch.ts: 이 Sketch의 Pass 구성. 'playground'는 엔진이 제공하는 모듈 이름(Vite alias)이다.
import { defineSketch } from 'playground';

// `field`와 `main` 두 Pass가 모두 common.glsl을 가져오므로, `speed` Parameter 하나를 함께 쓴다.
// Parameter는 여기가 아니라 셰이더 파일의 uniform 선언 주석으로 정한다.
export default defineSketch({
  // 브라우저 탭 제목.
  title: 'Parameters',
  passes: {
    // main이 field Pass의 이번 프레임 결과를 iChannel0으로 읽는다(배열 0번째 = iChannel0).
    // field는 따로 설정을 적지 않았으므로 기본값을 쓴다:
    // 캔버스와 같은 크기(scale 1), rgba16f, linear 필터, clamp.
    // 실행 순서는 의존 관계에 따라 field → main.
    main: { channels: ['field'] },
  },
});
