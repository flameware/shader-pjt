import { defineSketch, prev } from 'playground';

// Feedback: main reads its own previous frame through iChannel0.
export default defineSketch({
  title: 'Trail',
  passes: {
    main: { channels: [prev('main')] },
  },
});
