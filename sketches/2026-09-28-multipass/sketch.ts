// sketch.ts는 Sketch의 Pass 구성(어떤 Pass가 어떤 Pass를 읽는지)과 버퍼 설정을 적는 파일이다.
// 없으면 main.frag 하나만 실행한다. 'playground'는 엔진이 제공하는 모듈 이름(Vite alias)이다.
import { defineSketch } from 'playground';

// Pass 두 개: `pixels`가 캔버스의 1/8 크기로 그리고, `main`이 그것을 iChannel0으로 읽는다.
// defineSketch는 설정 객체를 그대로 돌려주는 함수다. 에디터에서 타입 검사와 자동 완성을 받기 위해 쓴다.
export default defineSketch({
  // 브라우저 탭 제목. 없으면 폴더 이름이 쓰인다.
  title: 'Pixels → Main',
  // Pass별 설정. 키는 Pass 이름(= .frag 파일 이름에서 확장자를 뺀 것)이다.
  passes: {
    // pixels.frag의 출력 버퍼 설정.
    // scale: 0.125 → 작업 해상도의 1/8 크기로 그린다(가로세로 각각 1/8).
    // filter: 'nearest' → 이 버퍼를 읽을 때 텍셀 사이를 섞지 않는다(블록처럼 각진 픽셀).
    // format, wrap은 생략해서 기본값(rgba16f, clamp)을 쓴다.
    pixels: { scale: 0.125, filter: 'nearest' },
    // main.frag의 입력 연결. 배열 순서가 곧 iChannel 번호다: 0번째 = iChannel0 = pixels.
    // main이 pixels를 읽으므로 실행 순서는 pixels → main이 된다(엔진이 의존 관계로 정한다).
    main: { channels: ['pixels'] },
  },
});
