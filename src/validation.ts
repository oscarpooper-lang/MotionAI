import type { Easing, MotionDocument, TransformProperty } from "./index.js";

const transformProperties: TransformProperty[] = [
	"x",
	"y",
	"opacity",
	"scale",
	"rotation",
];

const easings: Easing[] = ["linear", "easeIn", "easeOut", "easeInOut"];

export function assertFinite(value: number, label: string): void {
	if (!Number.isFinite(value)) {
		throw new TypeError(`${label} must be a finite number`);
	}
}

export function validateDocument(document: MotionDocument): void {
	if (document.version !== 1) {
		throw new TypeError("document.version must be 1");
	}
	assertFinite(document.duration, "document.duration");
	if (document.duration <= 0) {
		throw new RangeError("document.duration must be greater than 0");
	}
	if (!Array.isArray(document.layers)) {
		throw new TypeError("document.layers must be an array");
	}

	const layerIds = new Set<string>();
	for (const layer of document.layers) {
		if (!layer.id || layerIds.has(layer.id)) {
			throw new TypeError("layer ids must be non-empty and unique");
		}
		layerIds.add(layer.id);
		if (!Array.isArray(layer.tracks)) {
			throw new TypeError(`layer ${layer.id} tracks must be an array`);
		}

		for (const property of transformProperties) {
			assertFinite(layer.initial[property], `layer ${layer.id} initial.${property}`);
		}

		const trackedProperties = new Set<TransformProperty>();
		for (const track of layer.tracks) {
			if (!transformProperties.includes(track.property)) {
				throw new TypeError(`layer ${layer.id} has an unsupported transform property`);
			}
			if (trackedProperties.has(track.property)) {
				throw new TypeError(`layer ${layer.id} has multiple tracks for ${track.property}`);
			}
			trackedProperties.add(track.property);
			if (!Array.isArray(track.segments) || track.segments.length === 0) {
				throw new TypeError(`track ${track.property} must contain at least one segment`);
			}

			let previousEnd = 0;
			for (const segment of track.segments) {
				assertFinite(segment.start, "segment.start");
				assertFinite(segment.duration, "segment.duration");
				assertFinite(segment.from, "segment.from");
				assertFinite(segment.to, "segment.to");
				if (segment.start < previousEnd) {
					throw new RangeError(`track ${track.property} segments must be ordered and non-overlapping`);
				}
				if (segment.duration <= 0) {
					throw new RangeError("segment.duration must be greater than 0");
				}
				const end = segment.start + segment.duration;
				if (end > document.duration) {
					throw new RangeError("segment must end within document.duration");
				}
				if (segment.easing !== undefined && !easings.includes(segment.easing)) {
					throw new TypeError(`unsupported easing: ${segment.easing}`);
				}
				previousEnd = end;
			}
		}

		if (layer.behaviors !== undefined) {
			if (!Array.isArray(layer.behaviors)) {
				throw new TypeError(`layer ${layer.id} behaviors must be an array`);
			}
			for (const behavior of layer.behaviors) {
				if (!behavior.name.trim() || !Array.isArray(behavior.intents) ||
					behavior.intents.length === 0 ||
					behavior.intents.some((intent) => typeof intent !== "string" || !intent.trim())) {
					throw new TypeError(`layer ${layer.id} has invalid behavior metadata`);
				}
				assertFinite(behavior.at, "behavior.at");
				assertFinite(behavior.duration, "behavior.duration");
				if (behavior.at < 0 || behavior.duration <= 0 ||
					behavior.at + behavior.duration > document.duration) {
					throw new RangeError(`behavior ${behavior.name} must fit within document.duration`);
				}
				validateDocument({
					version: 1,
					duration: behavior.duration,
					layers: [{ id: behavior.name, initial: layer.initial, tracks: behavior.tracks }],
				});
			}
		}
	}
}