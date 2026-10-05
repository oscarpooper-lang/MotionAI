import { assertFinite, validateDocument } from "./validation.js";

export * from "./behavior.js";
export * from "./validation.js";

export type TransformProperty = keyof Transform;

export interface Transform {
	x: number;
	y: number;
	opacity: number;
	scale: number;
	rotation: number;
}

export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export interface MotionSegment {
	start: number;
	duration: number;
	from: number;
	to: number;
	easing?: Easing;
}

export interface MotionTrack {
	property: TransformProperty;
	segments: MotionSegment[];
}

export interface MotionLayer {
	id: string;
	initial: Transform;
	tracks: MotionTrack[];
	behaviors?: AppliedBehavior[];
}

export interface AppliedBehavior {
	name: string;
	intents: string[];
	at: number;
	duration: number;
	tracks: MotionTrack[];
}

export interface MotionDocument {
	version: 1;
	duration: number;
	layers: MotionLayer[];
}

export interface RenderedLayer {
	id: string;
	transform: Transform;
}

export interface MotionFrame {
	time: number;
	layers: RenderedLayer[];
}

function ease(progress: number, easing: Easing = "linear"): number {
	switch (easing) {
		case "easeIn":
			return progress * progress;
		case "easeOut":
			return 1 - (1 - progress) ** 2;
		case "easeInOut":
			return progress < 0.5
				? 2 * progress * progress
				: 1 - (-2 * progress + 2) ** 2 / 2;
		default:
			return progress;
	}
}

function evaluateTrack(
	initialValue: number,
	segments: MotionSegment[],
	time: number,
): number {
	let value = initialValue;
	for (const segment of segments) {
		if (time < segment.start) {
			break;
		}

		const progress = Math.min(1, (time - segment.start) / segment.duration);
		const easedProgress = ease(progress, segment.easing);
		value = segment.from + (segment.to - segment.from) * easedProgress;
	}
	return value;
}

export function render(document: MotionDocument, time: number): MotionFrame {
	validateDocument(document);
	assertFinite(time, "time");
	if (time < 0 || time > document.duration) {
		throw new RangeError("time must be between 0 and document.duration");
	}

	return {
		time,
		layers: document.layers.map((layer) => {
			const transform = { ...layer.initial };
			for (const track of layer.tracks) {
				transform[track.property] = evaluateTrack(
					layer.initial[track.property],
					track.segments,
					time,
				);
			}
			return { id: layer.id, transform };
		}),
	};
}