# Feedback sketches are captured at Output size by rendering at it, not by re-simulating

A high-resolution Capture of a sketch without Feedback re-renders one frame off-screen at the Output size, using the exact `iTime`/`iFrame`/`iMouse`/Parameter values of the frame on screen. A sketch with Feedback cannot be re-rendered that way — its image is the product of every earlier frame — so instead of re-simulating from frame 0 at the capture size, or upscaling the current buffers, the user switches the sketch to render at full Output size while it runs, and Capture saves that frame as-is.

## Considered Options

- **Re-simulate from frame 0 at Output size** — rejected: mouse movement, live Parameter tweaks and variable frame times cannot be replayed, so the result silently diverges from what was on screen; long runs also take a long time to replay.
- **Upscale the current buffers** — rejected: blurry, which defeats the point of a high-resolution capture.
- **Always render at full Output size** — rejected as the default: large float buffers cost frame rate while sketching; it stays an opt-in.

## Consequences

- An Output-size Capture of a feedback sketch is only offered when it is rendering at full Output size; otherwise only the on-screen Capture is available.
- Changing the Output size or switching full-size rendering on/off reallocates the feedback buffers and resets the sketch.
