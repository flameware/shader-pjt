# Shader Playground

A personal playground for writing GLSL shader sketches and viewing them live in the browser, in the spirit of Zach Lieberman's daily sketch practice.

## Language

**Sketch**:
One self-contained shader artwork — the unit of work in this playground. It may span several passes, including ones that read the previous frame.
_Avoid_: shader (for the whole piece), demo, experiment, piece

**Feedback**:
A sketch reading its own previous frame as input, producing trails, flow, and accumulation effects.
_Avoid_: ping-pong (implementation term), history

**Parameter**:
A value exposed by a sketch that can be tuned live from a GUI while the sketch runs.
_Avoid_: control, knob, setting

**Capture**:
Saving the currently rendered frame of a sketch as an image.
_Avoid_: screenshot, export
