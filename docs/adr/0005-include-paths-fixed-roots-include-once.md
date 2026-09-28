# `#include` paths: two fixed prefixes, relative paths that cannot leave their root, include-once

An `#include "path"` resolves one way only, decided by the path's first segment: `lib/...` is the project's `lib/` folder, `lygia/...` is `node_modules/lygia/`, and anything else is relative to the including file. A relative path may not leave its root (the Sketch folder, `lib/`, or lygia's package folder), so a Sketch cannot include another Sketch's files and cannot reach `lib/` by `../../lib`. Inside lygia's own files the prefixes are not applied; lygia includes only relative paths. Each resolved file is expanded at most once per Pass, and a second include of it expands to nothing, even when the first include sits in an `#if` branch the GLSL preprocessor later drops.

## Considered Options

- **Relative paths only (`../../lib/noise/valueNoise.glsl`)**: rejected. Every include would depend on where the Sketch folder sits, and "uses lib" / "uses lygia" would no longer be a plain grep, which ADR-0003's audit relies on.
- **A search path (try relative, then `lib/`, then lygia)**: rejected. The same line could resolve to different files as files are added, and a Sketch could depend on lygia without the `lygia/` text in its source, breaking ADR-0003.
- **Allowing `../` out of the Sketch folder**: rejected. A Sketch is self-contained and has no link to other Sketches; code worth sharing moves to `lib/`.
- **Relying on `#ifndef` guards instead of include-once**: rejected. It forces a guard into every `lib/` and Sketch-local file, and the expanded source and line table grow with duplicates. The cost of include-once is one rare trap: a file first included inside a dropped `#if` branch is missing later (seen in lygia's `color/lut.glsl`). The fix is to include that file unconditionally earlier, and the symptom is an ordinary "undeclared identifier" error.

## Consequences

- A Sketch-local folder named `lib` or `lygia` is unreachable by relative include. Those two names are reserved.
- `lib/` never contains `#include` inside `#if`, so the include-once trap can only come from lygia.
