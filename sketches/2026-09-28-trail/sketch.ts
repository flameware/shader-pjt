// sketch.ts: 이 Sketch의 Pass 구성. prev()는 "지난 프레임의 결과"를 가리킬 때 쓰는 함수다.
import { defineSketch, prev } from 'playground';

// Feedback: main이 자기 자신의 지난 프레임을 iChannel0으로 읽는다.
// 어느 Pass든 prev()로 읽히면 Feedback Sketch가 된다. 이런 Sketch는 결과가 지난 프레임들에
// 쌓여 있어서, Output size Capture를 `full`일 때만 할 수 있다(다시 시뮬레이션할 수 없기 때문).
export default defineSketch({
  // 브라우저 탭 제목.
  title: 'Trail',
  passes: {
    // prev('main') → main이 지난 프레임에 그린 결과. 처음 프레임에서는 검정(0)이다.
    // 엔진은 이 Pass에 버퍼 두 개를 번갈아 쓴다(한쪽을 읽는 동안 다른 쪽에 그린다).
    // 이 경우 main은 화면에 바로 그리지 않고 float(16F) 버퍼에 그린 뒤 화면에 보여 준다.
    main: { channels: [prev('main')] },
  },
});
