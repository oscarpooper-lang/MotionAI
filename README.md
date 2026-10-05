# MotionAI

Motion is a programming language. MotionAI is building its IDE, compiler, and AI co-author.

The goal is to make motion a first-class, semantic, composable data type: authored by people and AI together, then compiled to the runtimes and formats products need. The reusable unit is a behavior with intent, not a rendered file or a pile of keyframes.

## Product Thesis

Most motion tools focus on one part of the workflow: timeline authoring, procedural animation, portable playback, or code-driven rendering. MotionAI aims to connect those parts through a shared language for describing, evaluating, understanding, and compiling motion.

The initial go-to-market wedge is AI-assisted instructional videos for websites. The broader product is a motion IDE and portable runtime: one source can produce a video today and production motion code over time.

## Core Primitives

### Behaviors

A behavior is a parameterized, composable, time-indexed transform with semantic intent. Authors should be able to express concepts such as a confident entrance or hesitant reveal, compose those behaviors, and reuse them across projects.

The following `Behavior.springyEntrance` example sketches a future preset API; the initial behavior API is available below.

```ts
const entrance = Behavior.springyEntrance({
	stiffness: 0.7,
	overshoot: 0.15,
	intent: "confident",
});

comp.layer("logo").apply(entrance, { at: 0, duration: 1.2 });
```

### Semantic Motion

Motion should be inspectable and comparable by feel as well as by numeric parameters. A semantic representation can support searching behaviors, comparing a result with a reference, transferring a style, and testing that an edit has not changed the intended feel. Start with interpretable features; adopt learned embeddings when real usage and evaluation data justify them.

### Compilation

Keep one source of truth and add targets incrementally. The intended direction includes video, CSS and WAAPI, Lottie, web frameworks, native runtimes, and interactive playback. Each target must preserve the source behavior's timing and semantics as far as its runtime allows.

## Current Core

The initial TypeScript package defines a version-1 `MotionDocument` with a duration and layers. Each layer has an initial transform and non-overlapping numeric tracks for `x`, `y`, `opacity`, `scale`, and `rotation`. Segments specify start time, duration, endpoints, and optional easing (`linear`, `easeIn`, `easeOut`, or `easeInOut`).

`render(document, time)` returns a new frame snapshot without mutating the document. Time is measured in seconds and must be within the document. Values hold at the initial transform before a track starts, hold a segment's final value after it ends, and interpolate deterministically while it runs. Invalid timelines fail validation rather than resolving ambiguous overlaps.

The behavior API provides `tween` for tagged transform changes, `sequence` and `parallel` for composition, `deliberateReveal` as a starter preset, and `applyBehavior` to immutably add a behavior to a layer. Applied behavior names, intent tags, timing, and source tracks are retained in the layer's `behaviors` metadata.

```ts
import { applyBehavior, deliberateReveal, render, sequence, tween } from "./dist/src/index.js";

const move = tween({
	name: "move",
	intent: "confident",
	duration: 0.8,
	from: { x: 0 },
	to: { x: 100 },
	easing: "easeOut",
});
const entrance = sequence(move, deliberateReveal({ duration: 0.6 }));
const nextDocument = applyBehavior(document, "logo", entrance, 0);
const frame = render(nextDocument, 0.5);
```

This assumes `document` is a valid version-1 composition with a `logo` layer and duration of at least 1.4 seconds.

```sh
npm install
npm test
npm run typecheck
npm run build
```

## The Co-Author

The AI should work in the motion language, not merely operate editor controls or emit opaque files. The authoring loop is propose, render, inspect, critique, and revise. It should use the behavior vocabulary, see captured frames, explain semantic changes, offer alternatives, and retain explicit, user-controlled taste preferences.

## First 90 Days

1. **Implemented:** versioned document model, validation, and deterministic `render(comp, t)` evaluator.
2. **In progress:** expand the behavior vocabulary and composition rules; the initial `tween`, `sequence`, `parallel`, and `deliberateReveal` APIs are implemented. Add timeline visualization next.
3. **Video export:** render deterministic frames using controlled time and encode an MP4. Verify that exported timing matches preview timing.
4. **AI authoring loop:** expose behavior composition, frame capture, and critique. Demonstrate a complete propose-render-review-revise cycle.
5. **Semantic search v0:** index a project using measurable motion features and test whether queries retrieve relevant examples.
6. **Second compiler target:** add CSS and WAAPI after documenting which source constructs map faithfully and which do not.

Lottie and additional web, native, and live-runtime targets follow only after the source model and target capability boundaries are proven.

## Product Principles

- **Deterministic core:** evaluation is a pure function of composition and time wherever possible.
- **Semantic source:** intent and reusable behaviors remain available through editing, critique, and export.
- **Inspectable AI:** suggestions have understandable diffs and can be previewed before acceptance.
- **Portable by contract:** each compiler target declares its supported features and fidelity limits.
- **Taste with consent:** personal preferences are explicit, editable, and scoped to the author's projects unless shared deliberately.
- **Evidence before moat claims:** semantic search, taste adaptation, and network effects must earn trust through measurable usefulness.

## Early Success Criteria

- The same composition and timestamp produce repeatable rendered output.
- A behavior can be reused and adjusted without manually editing generated keyframes.
- A user can review an AI proposal as a semantic diff and accept or reject it.
- A website walkthrough can be authored from behaviors and exported as a correctly timed video.
- A second target can compile a supported subset of the same composition, with unsupported constructs reported rather than silently approximated.
