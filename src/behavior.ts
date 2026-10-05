import { assertFinite, validateDocument } from "./validation.js";
import type {
	Easing,
	MotionDocument,
	MotionLayer,
	MotionSegment,
	MotionTrack,
	Transform,
	TransformProperty,
} from "./index.js";

export interface Behavior {
	name: string;
	intents: string[];
	duration: number;
	tracks: MotionTrack[];
}

export interface TweenOptions {
	name: string;
	intent: string | string[];
	duration: number;
	from: Partial<Transform>;
	to: Partial<Transform>;
	easing?: Easing;
}

export interface DeliberateRevealOptions {
	duration?: number;
	distance?: number;
	intent?: string;
}

const emptyTransform: Transform = {
	x: 0,
	y: 0,
	opacity: 0,
	scale: 1,
	rotation: 0,
};

function normalizeIntents(intent: string | string[]): string[] {
	const intents = typeof intent === "string" ? [intent] : intent;
	if (!Array.isArray(intents) || intents.length === 0 || intents.some((tag) => !tag.trim())) {
		throw new TypeError("behavior intent must contain at least one non-empty tag");
	}
	return [...new Set(intents)];
}

function validateBehavior(behavior: Behavior): void {
	if (!behavior.name.trim()) {
		throw new TypeError("behavior name must not be empty");
	}
	if (behavior.tracks.length === 0) {
		throw new TypeError("behavior must animate at least one transform property");
	}
	validateDocument({
		version: 1,
		duration: behavior.duration,
		layers: [{ id: "behavior", initial: emptyTransform, tracks: behavior.tracks }],
	});
}

function makeBehavior(
	name: string,
	intents: string[],
	duration: number,
	tracks: MotionTrack[],
): Behavior {
	const behavior = { name, intents: [...new Set(intents)], duration, tracks };
	validateBehavior(behavior);
	return behavior;
}

export function tween(options: TweenOptions): Behavior {
	if (!options.name.trim()) {
		throw new TypeError("behavior name must not be empty");
	}
	assertFinite(options.duration, "behavior.duration");
	if (options.duration <= 0) {
		throw new RangeError("behavior.duration must be greater than 0");
	}

	const fromProperties = Object.keys(options.from);
	const toProperties = Object.keys(options.to);
	if (fromProperties.length === 0 || fromProperties.length !== toProperties.length ||
		fromProperties.some((property) => !Object.hasOwn(options.to, property))) {
		throw new TypeError("tween from and to must define the same transform properties");
	}

	const tracks = fromProperties.map((property) => ({
		property: property as TransformProperty,
		segments: [{
			start: 0,
			duration: options.duration,
			from: options.from[property as TransformProperty] as number,
			to: options.to[property as TransformProperty] as number,
			easing: options.easing,
		}],
	}));
	return makeBehavior(options.name, normalizeIntents(options.intent), options.duration, tracks);
}

export function deliberateReveal(options: DeliberateRevealOptions = {}): Behavior {
	const duration = options.duration ?? 0.6;
	const distance = options.distance ?? 16;
	return tween({
		name: "deliberateReveal",
		intent: options.intent ?? "deliberate",
		duration,
		from: { y: distance, opacity: 0 },
		to: { y: 0, opacity: 1 },
		easing: "easeOut",
	});
}

function compose(mode: "sequence" | "parallel", behaviors: Behavior[]): Behavior {
	if (behaviors.length === 0) {
		throw new TypeError(`${mode} requires at least one behavior`);
	}
	for (const behavior of behaviors) {
		validateBehavior(behavior);
	}

	const tracksByProperty = new Map<TransformProperty, MotionSegment[]>();
	let offset = 0;
	let duration = 0;
	for (const behavior of behaviors) {
		for (const track of behavior.tracks) {
			const segments = tracksByProperty.get(track.property) ?? [];
			segments.push(...track.segments.map((segment) => ({
				...segment,
				start: segment.start + (mode === "sequence" ? offset : 0),
			})));
			tracksByProperty.set(track.property, segments);
		}
		if (mode === "sequence") {
			offset += behavior.duration;
			duration = offset;
		} else {
			duration = Math.max(duration, behavior.duration);
		}
	}

	const tracks = [...tracksByProperty].map(([property, segments]) => ({
		property,
		segments: segments.sort((left, right) => left.start - right.start),
	}));
	const name = behaviors.map((behavior) => behavior.name).join(mode === "sequence" ? " then " : " + ");
	const intents = behaviors.flatMap((behavior) => behavior.intents);
	return makeBehavior(name, intents, duration, tracks);
}

export function sequence(...behaviors: Behavior[]): Behavior {
	return compose("sequence", behaviors);
}

export function parallel(...behaviors: Behavior[]): Behavior {
	return compose("parallel", behaviors);
}

export function applyBehavior(
	document: MotionDocument,
	layerId: string,
	behavior: Behavior,
	at = 0,
): MotionDocument {
	validateDocument(document);
	validateBehavior(behavior);
	assertFinite(at, "behavior start time");
	if (at < 0 || at + behavior.duration > document.duration) {
		throw new RangeError("behavior must fit within document.duration");
	}

	let foundLayer = false;
	const layers = document.layers.map((layer): MotionLayer => {
		if (layer.id !== layerId) {
			return layer;
		}
		foundLayer = true;
		const tracks = new Map<TransformProperty, MotionSegment[]>();
		for (const track of layer.tracks) {
			tracks.set(track.property, track.segments.map((segment) => ({ ...segment })));
		}
		for (const track of behavior.tracks) {
			const segments = tracks.get(track.property) ?? [];
			segments.push(...track.segments.map((segment) => ({
				...segment,
				start: segment.start + at,
			})));
			segments.sort((left, right) => left.start - right.start);
			tracks.set(track.property, segments);
		}
		return {
			...layer,
			tracks: [...tracks].map(([property, segments]) => ({ property, segments })),
			behaviors: [
				...(layer.behaviors ?? []),
				{
					name: behavior.name,
					intents: [...behavior.intents],
					at,
					duration: behavior.duration,
					tracks: behavior.tracks.map((track) => ({
						property: track.property,
						segments: track.segments.map((segment) => ({ ...segment })),
					})),
				},
			],
		};
	});
	if (!foundLayer) {
		throw new RangeError(`layer not found: ${layerId}`);
	}

	const result = { ...document, layers };
	validateDocument(result);
	return result;
}