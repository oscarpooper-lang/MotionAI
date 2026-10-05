import type { MotionDocument } from "../src/index.js";
import type { BehaviorEntry } from "./coauthor.js";

export const PROJECT_STORAGE_KEY = "motionai.project.v1";
export const LEGACY_STORAGE_KEY = "motionai.studio.v1";

export interface MotionProject {
	id: string;
	name: string;
	entries: BehaviorEntry[];
	document: MotionDocument;
	createdAt: string;
	updatedAt: string;
}

export function createProjectRecord(
	name: string,
	document: MotionDocument,
	entries: BehaviorEntry[] = [],
): MotionProject {
	const timestamp = new Date().toISOString();
	return {
		id: `project-${timestamp}`,
		name: name.trim() || "Untitled composition",
		entries,
		document,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

export function serializeProject(project: MotionProject): string {
	return JSON.stringify(project, null, 2);
}

export function parseMotionProject(raw: string): MotionProject {
	const parsed = JSON.parse(raw) as Partial<MotionProject>;
	if (!parsed || typeof parsed !== "object") {
		throw new TypeError("Project file is not valid JSON");
	}
	if (!parsed.document || typeof parsed.document !== "object") {
		throw new TypeError("Project file is missing a motion document");
	}
	const document = parsed.document as MotionDocument;
	const entries = Array.isArray(parsed.entries) ? parsed.entries as BehaviorEntry[] : [];
	const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Untitled composition";
	const now = new Date().toISOString();
	return {
		id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : `project-${now}`,
		name,
		entries,
		document,
		createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : now,
		updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now,
	};
}
