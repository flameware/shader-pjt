# Recording advances time by fixed frame steps, not by the wall clock

While a Recording runs, the sketch's clock ignores how much real time passed between frames and advances `iTime` by exactly one video frame (× speed) per rendered frame. Each rendered frame becomes one video frame. Mouse movement and Parameter tweaks still apply live, as they happen. A heavy sketch at full Output size may play slowly on screen, but the video is always smooth at its frame rate.

## Considered Options

- **Record the screen in real time (MediaRecorder on the canvas)** — rejected: frames dropped by a slow render become stutter in the video, which is exactly the case (large Output size) where recording matters most; frame timing and quality are left to the browser's recorder.
- **Re-simulate offline from frame 0 at a fixed step** — rejected for the same reasons as ADR 0001: mouse movement and live Parameter tweaks cannot be replayed, so the result would diverge from what was performed on screen.

## Consequences

- While recording, on-screen motion can run slower than real time; that is expected, not a bug.
- The clock needs a mode where each tick advances a fixed step instead of the measured wall-clock delta.
- Like ADR 0001, a Recording keeps what was performed live, rather than reproducing a run deterministically.
- A Recording saves exactly what the engine renders. At a preset Output size it is only offered at full render scale, the same rule ADR 0001 sets for an Output-size Capture. Anything that changes the frame size (switching sketch, Output size or render scale) ends the Recording and saves what was recorded so far.
