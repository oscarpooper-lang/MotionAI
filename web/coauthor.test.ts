import { describe, expect, it } from "vitest";
import { draftMotionProposal } from "./coauthor.js";

describe("draftMotionProposal", () => {
	it("maps a confident entrance to a slide proposal", () => {
		const proposal = draftMotionProposal("Give it a confident entrance", 1.2);

		expect(proposal.behaviors).toHaveLength(1);
		expect(proposal.behaviors[0]).toMatchObject({
			preset: "slide",
			intent: "confident",
			at: 1.2,
			duration: 0.65,
			easing: "easeOut",
		});
	});

	it("composes multiple suggestions in parallel when the prompt asks for them", () => {
		const proposal = draftMotionProposal("A gentle fade with a soft settle", 0.5);

		expect(proposal.behaviors.map((behavior) => behavior.preset)).toEqual(["reveal", "scale"]);
		expect(proposal.behaviors.every((behavior) => behavior.at === 0.5)).toBe(true);
		expect(proposal.behaviors.every((behavior) => behavior.easing === "easeInOut")).toBe(true);
	});

	it("uses a fast duration for quick motion language", () => {
		const proposal = draftMotionProposal("Make a quick slide", 0);

		expect(proposal.behaviors[0]?.duration).toBe(0.4);
		expect(proposal.behaviors[0]?.intent).toBe("urgent");
	});

	it("provides a useful default for an open-ended prompt", () => {
		const proposal = draftMotionProposal("Make it feel more polished", 0);

		expect(proposal.behaviors.map((behavior) => behavior.preset)).toEqual(["slide", "reveal"]);
	});

	it("supports exit phrasing and stable proposal ids", () => {
		const proposal = draftMotionProposal("Exit the hero with a gentle fade away", 1.25);

		expect(proposal.behaviors.map((behavior) => behavior.preset)).toEqual(["slide", "reveal"]);
		expect(proposal.behaviors[0]?.id).toMatch(/^proposal-(slide|reveal)-/);
		expect(proposal.behaviors[1]?.id).toMatch(/^proposal-(slide|reveal)-/);
	});

	it("rejects empty prompts and invalid proposal times", () => {
		expect(() => draftMotionProposal("   ", 0)).toThrow(TypeError);
		expect(() => draftMotionProposal("fade in", -1)).toThrow(RangeError);
	});
});