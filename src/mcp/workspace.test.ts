import { describe, expect, it } from "vitest";
import { MotionWorkspace } from "./workspace.js";
import { renderPreviewPng, renderPreviewSvg } from "./preview.js";

describe("MotionWorkspace", () => {
	it("adds semantic behavior and renders its evaluated frame", () => {
		const workspace = new MotionWorkspace();
		workspace.applyTween({
			layerId: "logo",
			name: "confident entrance",
			intent: "confident",
			at: 0,
			duration: 0.5,
			from: { x: -100 },
			to: { x: 0 },
			easing: "easeOut",
		});

		expect(workspace.renderAt(0.25).layers[0]?.transform.x).toBe(-25);
		expect(workspace.getDocument().layers[0]?.behaviors?.[0]?.intents).toEqual(["confident"]);
	});

	it("critiques structural motion risks without claiming visual taste", () => {
		const workspace = new MotionWorkspace();
		workspace.applyTween({
			layerId: "logo",
			name: "flash",
			intent: "urgent",
			at: 0,
			duration: 0.05,
			from: { opacity: 0 },
			to: { opacity: 1 },
			easing: "linear",
		});

		const critique = workspace.critique();
		expect(critique.findings[0]?.code).toBe("VERY_SHORT_BEHAVIOR");
		expect(critique.method).toContain("not a learned visual");
	});

	it("renders an escaped SVG transform preview", () => {
		const workspace = new MotionWorkspace();
		workspace.addLayer("<headline>");
		const svg = renderPreviewSvg(workspace.getDocument(), 0);

		expect(svg).toContain("&lt;headline&gt;");
		expect(svg).toContain("MOTION PREVIEW · 0.00s");
	});

	it("rasterizes the preview to a valid PNG frame", () => {
		const workspace = new MotionWorkspace();
		const png = renderPreviewPng(workspace.getDocument(), 0);

		expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		expect(png.length).toBeGreaterThan(1000);
	});
});