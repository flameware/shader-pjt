import { defineSketch } from 'playground';

// One Pass feeding the Main pass: `pixels` renders at 1/8 of the canvas with nearest
// filtering, and `main` reads it through iChannel0.
export default defineSketch({
  title: 'Pixels → Main',
  passes: {
    pixels: { scale: 0.125, filter: 'nearest' },
    main: { channels: ['pixels'] },
  },
});
