import { describe, expect, it } from "vitest";
import { applyBehavior, deliberateReveal, parallel, render, sequence, tween } from "./index.js";
import type { MotionDocument } from "./index.js";

const baseDocument: MotionDocument = {
	version: 1,
	duration: 2,
	layers: [{
		id: "logo",
		initial: { x: 0, y: 0, opacity: 0, scale: 1, rotation: 0 },
		tracks: [],
	}],
};

describe("behaviors", () => {
	it("sequences behaviors in local-time order and preserves intent tags", () => {
		const move = tween({
			name: "move",
			intent: "confident",
			duration: 1,
			from: { x: 0 },
			to: { x: 100 },
			easing: "easeOut",
		});
		const reveal = deliberateReveal({ duration: 0.5 });
		const behavior = sequence(move, reveal);
		const document = applyBehavior(baseDocument, "logo", behavior, 0.25);

		expect(behavior.duration).toBe(1.5);
		expect(behavior.intents).toEqual(["confident", "deliberate"]);
		expect(document.layers[0]?.behaviors?.[0]).toMatchObject({
			name: "move then deliberateReveal",
			intents: ["confident", "deliberate"],
			at: 0.25,
			duration: 1.5,
		});
		expect(render(document, 0.75).layers[0]?.transform.x).toBe(75);
		expect(render(document, 1.5).layers[0]?.transform.opacity).toBe(0.75);
		expect(render(document, 1.5).layers[0]?.transform.y).toBe(4);
		expect(render(document, 1.75).layers[0]?.transform.opacity).toBe(1);
		expect(render(document, 1.75).layers[0]?.transform.y).toBe(0);
	});

	it("runs independent behaviors in parallel", () => {
		const behavior = parallel(
			tween({ name: "slide", intent: "direct", duration: 1, from: { x: 0 }, to: { x: 20 } }),
			tween({ name: "fade", intent: "quiet", duration: 0.5, from: { opacity: 0 }, to: { opacity: 1 } }),
		);
		const document = applyBehavior(baseDocument, "logo", behavior);

		expect(behavior.duration).toBe(1);
		expect(render(document, 0.5).layers[0]?.transform).toEqual({
			x: 10,
			y: 0,
			opacity: 1,
			scale: 1,
			rotation: 0,
		});
	});

	it("rejects conflicting parallel tracks", () => {
		const first = tween({ name: "first", intent: "a", duration: 1, from: { x: 0 }, to: { x: 1 } });
		const second = tween({ name: "second", intent: "b", duration: 1, from: { x: 1 }, to: { x: 2 } });

		expect(() => parallel(first, second)).toThrow(RangeError);
	});

	it("does not mutate the source document", () => {
		const original = structuredClone(baseDocument);
		const behavior = deliberateReveal();

		applyBehavior(baseDocument, "logo", behavior);

		expect(baseDocument).toEqual(original);
	});

	it("rejects a behavior that extends beyond the document", () => {
		expect(() => applyBehavior(baseDocument, "logo", deliberateReveal(), 1.5)).toThrow(RangeError);
	});
});