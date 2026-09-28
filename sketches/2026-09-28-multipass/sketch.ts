import { defineSketch } from 'playground';

// A buffer Pass feeding the Main pass: `pixels` renders at 1/8 of the canvas with nearest
// filtering, and `main` reads it through iChannel0.
export default defineSketch({
  title: 'Buffer → Main',
  passes: {
    pixels: { scale: 0.125, filter: 'nearest' },
    main: { channels: ['pixels'] },
  },
});
