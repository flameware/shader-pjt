# Shader Playground

A personal playground for writing GLSL shader sketches and viewing them live in the browser, in the spirit of Zach Lieberman's daily sketch practice.

## Language

**Sketch**:
One self-contained shader artwork — the unit of work in this playground. It may span several passes, including ones that read the previous frame.
_Avoid_: shader (for the whole piece), demo, experiment, piece

**Template**:
The starting contents a new sketch is created from. A new sketch starts either from a template or as a copy of an existing sketch; after that it has no link to where it came from.
_Avoid_: boilerplate, starter, preset

**Pass**:
One rendering step of a sketch. Its output is handed to other passes, or to the next frame.
_Avoid_: buffer (except for the stored output itself), tab

**Main pass**:
The pass whose output is what appears on screen; it always runs last.
_Avoid_: image pass, final pass

**Channel**:
One of the four input slots (`iChannel0..3`) through which a pass receives another pass's output.
_Avoid_: input, texture slot

**Feedback**:
A sketch reading its own previous frame as input, producing trails, flow, and accumulation effects.
_Avoid_: ping-pong (implementation term), history

**Parameter**:
A value exposed by a sketch that can be tuned live from a GUI while the sketch runs. It belongs to the sketch as a whole: every pass that names the same parameter sees the same value.
_Avoid_: control, knob, setting

**Capture**:
Saving the currently rendered frame of a sketch as an image.
_Avoid_: screenshot, export
