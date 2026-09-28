import { defineSketch, prev } from 'playground';

export default defineSketch({
  passes: {
    main: { channels: [prev('main')] }, // iChannel0 = main's previous frame
  },
});
