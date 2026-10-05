import { Resvg } from "@resvg/resvg-js";
import { render, type MotionDocument } from "../index.js";

function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (character) => {
		switch (character) {
			case "<": return "&lt;";
			case ">": return "&gt;";
			case "&": return "&amp;";
			case '"': return "&quot;";
			default: return "&apos;";
		}
	});
}

export function renderPreviewSvg(document: MotionDocument, time: number): string {
	const width = 960;
	const height = 540;
	const frame = render(document, time);
	const layers = frame.layers.map(({ id, transform }, index) => {
		const x = width / 2 + transform.x;
		const y = height / 2 + transform.y + index * 112;
		return `<g transform="translate(${x} ${y}) rotate(${transform.rotation}) scale(${transform.scale})" opacity="${transform.opacity}">
			<rect x="-132" y="-40" width="264" height="80" rx="11" fill="#19221f"/>
			<rect x="-111" y="-19" width="38" height="38" rx="6" fill="#c7ef70"/>
			<path d="M-101 7v-14m9 14V-7m9 14v-9" stroke="#19221f" stroke-width="4" stroke-linecap="round"/>
			<text x="-58" y="3" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="700">${escapeXml(id)}</text>
			<text x="-58" y="21" fill="#c3cdc5" font-family="monospace" font-size="9">x ${transform.x.toFixed(1)} · y ${transform.y.toFixed(1)} · opacity ${transform.opacity.toFixed(2)}</text>
		</g>`;
	}).join("\n");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
		<rect width="100%" height="100%" fill="#f2f4ef"/>
		<path d="M0 0H${width}M0 ${height / 2}H${width}M0 ${height}H${width}M0 0V${height}M${width / 2} 0V${height}M${width} 0V${height}" stroke="#e0e5dd" stroke-width="1"/>
		<text x="24" y="30" fill="#758078" font-family="monospace" font-size="10">MOTION PREVIEW · ${time.toFixed(2)}s</text>
		${layers}
	</svg>`;
}

export function renderPreviewPng(document: MotionDocument, time: number): Buffer {
	const svg = renderPreviewSvg(document, time);
	const renderer = new Resvg(svg, {
		font: { loadSystemFonts: false },
		logLevel: "off",
	});
	return Buffer.from(renderer.render().asPng());
}