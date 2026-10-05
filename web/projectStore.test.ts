import { describe, expect, it } from "vitest";
import type { MotionDocument } from "../src/index.js";
import {
	createProjectRecord,
	parseMotionProject,
	serializeProject,
} from "./projectStore.js";

describe("projectStore", () => {
	it("adds sensible defaults to a project record", () => {
		const document: MotionDocument = {
			version: 1,
			duration: 4,
			layers: [{
				id: "logo",
				initial: { x: 0, y: 24, opacity: 0, scale: 0.92, rotation: 0 },
				tracks: [],
			}],
		};

		const project = createProjectRecord("Hero reveal", document);

		expect(project.name).toBe("Hero reveal");
		expect(project.document).toMatchObject({ version: 1, duration: 4 });
		expect(project.createdAt).toBeTypeOf("string");
		expect(project.updatedAt).toBeTypeOf("string");
	});

	it("round-trips project JSON without losing document data", () => {
		const document: MotionDocument = {
			version: 1,
			duration: 2.5,
			layers: [{
				id: "badge",
				initial: { x: 10, y: 12, opacity: 1, scale: 1, rotation: 0 },
				tracks: [],
			}],
		};

		const project = createProjectRecord("Badge launch", document);
		const json = serializeProject(project);
		const restored = parseMotionProject(json);

		expect(restored.name).toBe("Badge launch");
		expect(restored.document).toEqual(document);
	});
});
