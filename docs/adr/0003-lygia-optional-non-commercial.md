# lygia is optional, never vendored, and only a Sketch may include it

For now this playground is non-commercial only. lygia is mostly licensed under Prosperity 3.0.0: free for non-commercial use, and commercial use needs a Patron sponsorship after a 30-day trial. So lygia is not the default library. It is an optional external library: a pinned `lygia` devDependency read from `node_modules` through the `lygia/` include prefix. The project's own `lib/` is the default. Two rules follow, and neither is visible in the code: lygia files are never copied (vendored) into the repo, including into `lib/`, and `lib/` never includes `lygia/`. Together they mean a Sketch depends on lygia exactly when its own files contain `#include "lygia/..."`. A single grep then answers "which Sketches would need a Patron license (or a lygia strip) before commercial use?"

## Considered Options

- **lygia as the default library**: rejected. Every Sketch would inherit the non-commercial restriction, and the "anticipated commercial application" wording makes even future plans ambiguous.
- **No lygia at all, only `lib/`**: rejected for now. lygia is useful for hobby work, and the license allows that.
- **Vendoring lygia files or copying functions into `lib/`**: rejected. It triggers Prosperity's Notices obligation in a public repo, and it hides the dependency from the audit.

## Consequences

If the user ever commercialises a Sketch, they either become a lygia Patron or rewrite that Sketch's `lygia/` includes against `lib/` at that point. Nothing else in the repo needs to change.
