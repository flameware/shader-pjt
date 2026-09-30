// glow-bar-4의 막대를 이미지 밝기에 따라 뿌린다: 밝은 곳일수록 막대가 놓일 확률이 높다.
import { defineSketch } from 'playground';

export default defineSketch({
  title: 'Glow Bar 6',
  // sample_01.png(1080×1350)과 같은 비율이라 이미지가 잘리지 않는다.
  output: '4:5',
  passes: {
    // 막대 위치 표. 텍셀 i = 막대 i의 중심(캔버스 UV). 너비 512는 main.frag의 count 최대값과 같아야 한다.
    // iChannel0 = 밀도 이미지. 캔버스에 cover로 깔리므로 캔버스 UV로 읽으면 같은 자리의 밝기다.
    bars: { size: [512, 1], format: 'rgba32f', channels: ['./sample_01.png'] },
    // iChannel0 = 막대 위치 표.
    main: { channels: ['bars'] },
  },
});
