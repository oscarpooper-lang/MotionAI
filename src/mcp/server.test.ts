import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("MotionAI MCP server", () => {
	const client = new Client({ name: "motionai-test-client", version: "1.0.0" });
	let transport: StdioClientTransport;

	beforeAll(async () => {
		transport = new StdioClientTransport({
			command: process.execPath,
			args: [resolve("dist/src/mcp/server.js")],
		});
		await client.connect(transport);
	});

	afterAll(async () => {
		await client.close();
	});

	it("lets an AI client inspect, author, capture, and critique motion", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
			"get_motion_document",
			"list_motion_vocabulary",
			"add_motion_layer",
				"replace_motion_document",
			"apply_motion_behavior",
			"capture_motion_frame",
			"critique_motion",
		]));

		const initial = await client.callTool({ name: "get_motion_document", arguments: {} });
		expect(initial.structuredContent).toMatchObject({
			document: { layers: [{ id: "logo" }] },
		});

		const loaded = await client.callTool({
			name: "replace_motion_document",
			arguments: {
				documentJson: JSON.stringify({
					version: 1,
					duration: 4,
					layers: [{
						id: "logo",
						initial: { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 },
						tracks: [],
					}],
				}),
			},
		});
		expect(loaded.isError, JSON.stringify(loaded)).not.toBe(true);

		const addedLayer = await client.callTool({
			name: "add_motion_layer",
			arguments: { id: "headline", x: 0, y: -40, opacity: 0 },
		});
		expect(addedLayer.isError, JSON.stringify(addedLayer)).not.toBe(true);

		const applied = await client.callTool({
			name: "apply_motion_behavior",
			arguments: {
				layerId: "headline",
				name: "confident entrance",
				intent: "confident",
				at: 0,
				duration: 0.5,
				from: { y: -40, opacity: 0 },
				to: { y: 0, opacity: 1 },
				easing: "easeOut",
			},
		});
		expect(applied.isError).not.toBe(true);

		const captured = await client.callTool({ name: "capture_motion_frame", arguments: { time: 0.25 } });
		const image = captured.content.find((item) => item.type === "image");
		expect(image?.type).toBe("image");
		if (image?.type === "image") {
			expect(image.mimeType).toBe("image/png");
			expect([...Buffer.from(image.data, "base64").subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		}
		expect(captured.structuredContent).toMatchObject({ frame: { layers: [{ id: "logo" }, { id: "headline" }] } });

		const critique = await client.callTool({ name: "critique_motion", arguments: {} });
		expect(critique.structuredContent).toMatchObject({
			metrics: { layers: 2, behaviors: 1 },
			method: expect.stringContaining("not a learned visual"),
		});
	});
});