import {
	applyBehavior,
	render,
	tween,
	validateDocument,
	type Easing,
	type MotionDocument,
	type Transform,
} from "../index.js";

export interface ApplyTweenInput {
	layerId: string;
	name: string;
	intent: string;
	at: number;
	duration: number;
	from: Partial<Transform>;
	to: Partial<Transform>;
	easing: Easing;
}

export interface MotionFinding {
	severity: "info" | "warning";
	code: string;
	message: string;
	layerId?: string;
}

export interface MotionCritique {
	summary: string;
	score: number;
	metrics: {
		layers: number;
		behaviors: number;
		tracks: number;
		duration: number;
	};
	findings: MotionFinding[];
	method: string;
}

const defaultTransform: Transform = {
	x: 0,
	y: 0,
	opacity: 1,
	scale: 1,
	rotation: 0,
};

export function createInitialDocument(): MotionDocument {
	return {
		version: 1,
		duration: 4,
		layers: [{ id: "logo", initial: { ...defaultTransform }, tracks: [] }],
	};
}

export class MotionWorkspace {
	#document: MotionDocument;

	constructor(document: MotionDocument = createInitialDocument()) {
		validateDocument(document);
		this.#document = structuredClone(document);
	}

	getDocument(): MotionDocument {
		return structuredClone(this.#document);
	}

	replaceDocument(document: MotionDocument): MotionDocument {
		validateDocument(document);
		this.#document = structuredClone(document);
		return this.getDocument();
	}

	addLayer(id: string, initial: Partial<Transform> = {}): MotionDocument {
		const providedTransform = Object.fromEntries(
			Object.entries(initial).filter(([, value]) => value !== undefined),
		) as Partial<Transform>;
		const layer = {
			id,
			initial: { ...defaultTransform, ...providedTransform },
			tracks: [],
		};
		const next = { ...this.#document, layers: [...this.#document.layers, layer] };
		validateDocument(next);
		this.#document = next;
		return this.getDocument();
	}

	applyTween(input: ApplyTweenInput): MotionDocument {
		const behavior = tween({
			name: input.name,
			intent: input.intent,
			duration: input.duration,
			from: input.from,
			to: input.to,
			easing: input.easing,
		});
		const next = applyBehavior(this.#document, input.layerId, behavior, input.at);
		this.#document = next;
		return this.getDocument();
	}

	renderAt(time: number) {
		return render(this.#document, time);
	}

	critique(): MotionCritique {
		validateDocument(this.#document);
		const findings: MotionFinding[] = [];
		const behaviors = this.#document.layers.flatMap((layer) =>
			(layer.behaviors ?? []).map((behavior) => ({ layerId: layer.id, ...behavior })),
		);
		const trackCount = this.#document.layers.reduce((count, layer) => count + layer.tracks.length, 0);

		if (behaviors.length === 0) {
			findings.push({
				severity: "info",
				code: "NO_BEHAVIORS",
				message: "This composition has no authored behaviors yet.",
			});
		}

		for (const behavior of behaviors) {
			if (behavior.duration < 0.12) {
				findings.push({
					severity: "warning",
					code: "VERY_SHORT_BEHAVIOR",
					message: `${behavior.name} lasts ${behavior.duration.toFixed(2)}s; confirm the quick timing is intentional.`,
					layerId: behavior.layerId,
				});
			}
			if (behavior.duration > 1.5) {
				findings.push({
					severity: "warning",
					code: "LONG_BEHAVIOR",
					message: `${behavior.name} lasts ${behavior.duration.toFixed(2)}s; consider whether the movement should be split or shortened.`,
					layerId: behavior.layerId,
				});
			}
			for (const track of behavior.tracks) {
				if (track.property === "opacity" && track.segments.some((segment) =>
					segment.from < 0 || segment.from > 1 || segment.to < 0 || segment.to > 1)) {
					findings.push({
						severity: "warning",
						code: "OPACITY_OUT_OF_RANGE",
						message: `${behavior.name} moves opacity outside the usual 0–1 range.`,
						layerId: behavior.layerId,
					});
				}
			}
		}

		const warnings = findings.filter((finding) => finding.severity === "warning").length;
		return {
			summary: warnings === 0
				? `${behaviors.length} behavior(s) checked; no timing or opacity warnings found.`
				: `${warnings} timing or opacity warning(s) found across ${behaviors.length} behavior(s).`,
			score: Math.max(0, 100 - warnings * 15),
			metrics: {
				layers: this.#document.layers.length,
				behaviors: behaviors.length,
				tracks: trackCount,
				duration: this.#document.duration,
			},
			findings,
			method: "Deterministic structural checks. This is not a learned visual or taste critique.",
		};
	}
}