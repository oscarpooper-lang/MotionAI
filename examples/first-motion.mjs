import {
	applyBehavior,
	deliberateReveal,
	render,
	sequence,
	tween,
} from "../dist/src/index.js";

const composition = {
	version: 1,
	duration: 2,
	layers: [{
		id: "logo",
		initial: { x: 0, y: 16, opacity: 0, scale: 1, rotation: 0 },
		tracks: [],
	}],
};

const entrance = sequence(
	tween({
		name: "confident-slide",
		intent: "confident",
		duration: 0.8,
		from: { x: 0 },
		to: { x: 100 },
		easing: "easeOut",
	}),
	deliberateReveal({ duration: 0.6 }),
);

const authoredComposition = applyBehavior(composition, "logo", entrance);
const frame = render(authoredComposition, 1.1);

console.log("Rendered frame:");
console.log(JSON.stringify(frame, (_, value) =>
	typeof value === "number" ? Number(value.toFixed(3)) : value,
2));
console.log("Behavior intent:", authoredComposition.layers[0].behaviors[0].intents);