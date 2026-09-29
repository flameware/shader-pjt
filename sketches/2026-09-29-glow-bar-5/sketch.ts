// sketch.ts: 이 Sketch의 Pass 구성.
import { defineSketch, prev } from 'playground';

export default defineSketch({
  title: 'Glow Bar 5',
  passes: {
    // trail: 막대와 그 흔적의 빛만 그린다. 자기 지난 프레임(prev)을 iChannel0으로 읽어 흔적을 이어 간다(Feedback).
    trail: { channels: [prev('trail')] },
    // main: 이번 프레임의 trail을 iChannel0으로 읽어 배경색 위에 입힌다.
    main: { channels: ['trail'] },
  },
});
