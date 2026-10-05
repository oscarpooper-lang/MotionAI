import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import type { Easing, MotionDocument, Transform } from "../index.js";
import { renderPreviewPng } from "./preview.js";
import { MotionWorkspace } from "./workspace.js";

const transformSchema = z.object({
	x: z.number().optional(),
	y: z.number().optional(),
	opacity: z.number().optional(),
	scale: z.number().optional(),
	rotation: z.number().optional(),
}).strict();

function jsonResult(value: unknown) {
	const text = JSON.stringify(value, null, 2);
	return {
		content: [{ type: "text" as const, text }],
		structuredContent: value as Record<string, unknown>,
	};
}

function toolError(error: unknown) {
	return {
		isError: true,
		content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
	};
}

export function createMotionMcpServer(workspace = new MotionWorkspace()): McpServer {
	const server = new McpServer(
		{ name: "motionai-studio", version: "0.1.0" },
		{
			capabilities: { tools: {} },
		},
	);

	server.registerTool(
		"get_motion_document",
		{
			title: "Read motion document",
			description: "Read the current versioned motion composition, including layers, timing, tracks, and preserved behavior intent.",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async () => jsonResult({ document: workspace.getDocument() }),
	);

	server.registerTool(
		"list_motion_vocabulary",
		{
			title: "List motion vocabulary",
			description: "List supported transform properties, easings, semantic behavior examples, and current runtime limitations.",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async () => jsonResult({
			properties: ["x", "y", "opacity", "scale", "rotation"],
			easings: ["linear", "easeIn", "easeOut", "easeInOut"],
			behaviorExamples: [
				{ name: "confident entrance", intent: "confident", suggestion: "short easeOut position change" },
				{ name: "hesitant reveal", intent: "hesitant", suggestion: "gentle easeInOut opacity and position change" },
				{ name: "deliberate exit", intent: "deliberate", suggestion: "measured position or opacity change" },
			],
			limitations: [
				"The document currently models transforms, not imported visual assets or shape geometry.",
				"Frame capture shows labeled transform proxies, not final artwork.",
				"Critique is deterministic structural analysis, not learned visual taste analysis.",
			],
		}),
	);

	server.registerTool(
		"add_motion_layer",
		{
			title: "Add motion layer",
			description: "Add a uniquely named layer to the active composition. Initial values default to an identity transform.",
			inputSchema: z.object({
				id: z.string().trim().min(1).describe("Stable unique layer id"),
				x: z.number().optional(),
				y: z.number().optional(),
				opacity: z.number().optional(),
				scale: z.number().optional(),
				rotation: z.number().optional(),
			}),
		},
		async ({ id, x, y, opacity, scale, rotation }) => {
			try {
				const initial: Partial<Transform> = { x, y, opacity, scale, rotation };
				return jsonResult({ document: workspace.addLayer(id, initial) });
			} catch (error) {
				return toolError(error);
			}
		},
	);

	server.registerTool(
		"replace_motion_document",
		{
			title: "Load motion document",
			description: "Replace the in-memory MCP composition with a complete version-1 Motion JSON document. The document is validated before it becomes active.",
			inputSchema: z.object({ documentJson: z.string().max(1_000_000) }),
		},
		async ({ documentJson }) => {
			try {
				const document = JSON.parse(documentJson) as MotionDocument;
				return jsonResult({ document: workspace.replaceDocument(document) });
			} catch (error) {
				return toolError(error);
			}
		},
	);

	server.registerTool(
		"apply_motion_behavior",
		{
			title: "Apply semantic motion behavior",
			description: "Apply a time-indexed transform tween with an explicit semantic intent tag. from and to must contain the same non-empty set of transform properties; overlapping tracks are rejected.",
			inputSchema: z.object({
				layerId: z.string().trim().min(1),
				name: z.string().trim().min(1).describe("Human-readable behavior name"),
				intent: z.string().trim().min(1).describe("Why the motion should feel this way, e.g. confident, hesitant, deliberate"),
				at: z.number().min(0),
				duration: z.number().positive(),
				from: transformSchema,
				to: transformSchema,
				easing: z.enum(["linear", "easeIn", "easeOut", "easeInOut"]).default("easeOut"),
			}),
		},
		async ({ layerId, name, intent, at, duration, from, to, easing }) => {
			try {
				const fromKeys = Object.keys(from);
				const toKeys = Object.keys(to);
				if (fromKeys.length === 0 || fromKeys.length !== toKeys.length ||
					fromKeys.some((property) => !Object.hasOwn(to, property))) {
					throw new TypeError("from and to must define the same non-empty set of properties");
				}
				const document = workspace.applyTween({
					layerId,
					name,
					intent,
					at,
					duration,
					from,
					to,
					easing: easing as Easing,
				});
				return jsonResult({ document, applied: { name, intent, layerId, at, duration, easing } });
			} catch (error) {
				return toolError(error);
			}
		},
	);

	server.registerTool(
		"capture_motion_frame",
		{
			title: "Capture motion frame",
			description: "Render a deterministic PNG image at a time in seconds. The image uses labeled layer proxies while the document has no visual asset schema; structured frame values are returned too.",
			inputSchema: z.object({ time: z.number().min(0) }),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async ({ time }) => {
			try {
				const document = workspace.getDocument();
				const frame = workspace.renderAt(time);
				const png = renderPreviewPng(document, time);
				return {
					content: [
						{ type: "image" as const, data: png.toString("base64"), mimeType: "image/png" },
						{ type: "text" as const, text: `Transform proxy preview at ${time.toFixed(2)} seconds. This is not final artwork.\n${JSON.stringify(frame, null, 2)}` },
					],
					structuredContent: { frame },
				};
			} catch (error) {
				return toolError(error);
			}
		},
	);

	server.registerTool(
		"critique_motion",
		{
			title: "Critique motion structure",
			description: "Return deterministic checks for very short or long behaviors and opacity outside 0–1. This does not assess visual quality, brand taste, or image composition.",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async () => jsonResult(workspace.critique()),
	);

	return server;
}

async function main(): Promise<void> {
	const server = createMotionMcpServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("MotionAI MCP server connected over stdio");
}

main().catch((error: unknown) => {
	console.error("MotionAI MCP server failed to start:", error);
	process.exitCode = 1;
});