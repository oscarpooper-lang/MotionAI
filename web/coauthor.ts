import type { Easing } from "../src/index.js";

export type Preset = "slide" | "reveal" | "scale";

export interface BehaviorEntry {
	id: string;
	preset: Preset;
	name: string;
	intent: string;
	at: number;
	duration: number;
	easing: Easing;
}

export interface MotionProposal {
	summary: string;
	rationale: string;
	note: string;
	behaviors: BehaviorEntry[];
}

const intentSignals: Array<[string, RegExp]> = [
	["confident", /\b(confident|bold|assured|strong)\b/],
	["hesitant", /\b(hesitant|uncertain|cautious|tentative)\b/],
	["playful", /\b(playful|fun|bouncy|elastic)\b/],
	["gentle", /\b(gentle|soft|quiet|calm|subtle)\b/],
	["urgent", /\b(urgent|fast|quick|snappy)\b/],
	["deliberate", /\b(deliberate|considered|intentional)\b/],
];

const presetSignals: Array<[Preset, RegExp]> = [
	["slide", /\b(entrance|enter|exit|leave|depart|slide|move|arrive|intro|bring in)\b/],
	["reveal", /\b(reveal|fade|appear|show|uncover)\b/],
	["scale", /\b(settle|spring|bounce|elastic|scale|pop)\b/],
];

function stableProposalId(preset: Preset, index: number, startAt: number): string {
	const bucket = Math.round(startAt * 100);
	return `proposal-${preset}-${index}-${bucket}`;
}

function easingFor(intent: string, prompt: string): Easing {
	if (/\b(slow|linger|float|gradual)\b/.test(prompt)) return "easeInOut";
	if (intent === "urgent") return "easeIn";
	if (["gentle", "hesitant", "deliberate"].includes(intent)) return "easeInOut";
	return "easeOut";
}

function labelFor(preset: Preset, intent: string): string {
	const adjective = intent.charAt(0).toUpperCase() + intent.slice(1);
	const noun = preset === "slide" ? "slide" : preset === "reveal" ? "reveal" : "settle";
	return `${adjective} ${noun}`;
}

export function draftMotionProposal(promptText: string, startAt: number): MotionProposal {
	const prompt = promptText.trim().toLowerCase();
	if (!prompt) {
		throw new TypeError("Describe the motion you want first");
	}
	if (!Number.isFinite(startAt) || startAt < 0) {
		throw new RangeError("proposal start time must be a finite, non-negative number");
	}

	const intent = intentSignals.find(([, signal]) => signal.test(prompt))?.[0] ?? "deliberate";
	let presets = presetSignals.filter(([, signal]) => signal.test(prompt)).map(([preset]) => preset);
	if (presets.length === 0) {
		presets = ["slide", "reveal"];
	}

	const duration = /\b(slow|linger|float|gradual)\b/.test(prompt)
		? 0.9
		: /\b(fast|quick|snappy)\b/.test(prompt) ? 0.4 : 0.65;
	const easing = easingFor(intent, prompt);
	const behaviors = presets.map((preset, index) => ({
		id: stableProposalId(preset, index, startAt),
		preset,
		name: labelFor(preset, intent),
		intent,
		at: startAt,
		duration,
		easing,
	}));
	const descriptions = presets.map((preset) => preset === "slide"
		? "a horizontal entrance"
		: preset === "reveal" ? "an opacity and position reveal" : "a scale settle");
	const rationale = `Matched “${intent}” as the motion intent and mapped the prompt to ${descriptions.join(" plus ")}.`;

	return {
		summary: `A ${intent} motion pass with ${descriptions.join(" and ")}.`,
		rationale,
		note: "Local prototype: this matches words to behavior templates. No language model is connected yet.",
		behaviors,
	};
}