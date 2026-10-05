import { describe, expect, it } from "vitest";
import { render, type MotionDocument } from "./index.js";

const document: MotionDocument = {
	version: 1,
	duration: 2,
	layers: [
		{
			id: "logo",
			initial: { x: 0, y: 4, opacity: 0, scale: 1, rotation: 0 },
			tracks: [
				{
					property: "x",
					segments: [{ start: 0, duration: 1, from: 0, to: 100, easing: "easeOut" }],
				},
				{
					property: "opacity",
					segments: [{ start: 0.5, duration: 0.5, from: 0, to: 1 }],
				},
			],
		},
	],
};

describe("render", () => {
	it("evaluates eased transforms at an exact time", () => {
		expect(render(document, 0.5).layers[0]?.transform).toEqual({
			x: 75,
			y: 4,
			opacity: 0,
			scale: 1,
			rotation: 0,
		});
	});

	it("holds the initial value before a segment and its final value after it", () => {
		expect(render(document, 0.25).layers[0]?.transform.x).toBe(43.75);
		expect(render(document, 1.5).layers[0]?.transform.x).toBe(100);
		expect(render(document, 1.5).layers[0]?.transform.opacity).toBe(1);
	});

	it("returns repeatable frames without mutating the document", () => {
		const original = structuredClone(document);
		const first = render(document, 0.75);
		const second = render(document, 0.75);

		expect(first).toEqual(second);
		expect(document).toEqual(original);
	});

	it("rejects times outside the document", () => {
		expect(() => render(document, -0.1)).toThrow(RangeError);
		expect(() => render(document, 2.1)).toThrow(RangeError);
	});

	it("rejects overlapping segments on one track", () => {
		const invalidDocument: MotionDocument = {
			...document,
			layers: [
				{
					...document.layers[0]!,
					tracks: [
						{
							property: "x",
							segments: [
								{ start: 0, duration: 1, from: 0, to: 10 },
								{ start: 0.5, duration: 0.5, from: 10, to: 20 },
							],
						},
					],
				},
			],
		};

		expect(() => render(invalidDocument, 0.75)).toThrow(RangeError);
	});
});