# MotionAI Agent Tools

The repository exposes its motion document and evaluator through an MCP stdio server built with the official TypeScript SDK.

- SDK: https://github.com/modelcontextprotocol/typescript-sdk
- MCP implementation guide: https://modelcontextprotocol.io/llms-full.txt
- Build before launching the configured server with `npm run build`.
- MCP stdio protocol traffic must remain on stdout; diagnostics belong on stderr.
- `capture_motion_frame` currently returns labeled transform proxies, not final artwork.
- `critique_motion` is deterministic structural analysis, not model-based visual or taste critique.