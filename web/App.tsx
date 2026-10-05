import { useEffect, useRef, useState } from "react";
import {
	Activity,
	Check,
	ChevronDown,
	Clock3,
	Download,
	Layers3,
	Pause,
	Play,
	Plus,
	Sparkles,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import {
	applyBehavior,
	render,
	tween,
	type MotionDocument,
	type MotionFrame,
} from "../src/index.js";
import { draftMotionProposal, type BehaviorEntry, type MotionProposal, type Preset } from "./coauthor.js";

const PROJECT_DURATION = 4;
const STORAGE_KEY = "motionai.studio.v1";

const starterEntries: BehaviorEntry[] = [
	{ id: "slide-1", preset: "slide", name: "Confident slide", intent: "confident", at: 0, duration: 0.8, easing: "easeOut" },
	{ id: "reveal-1", preset: "reveal", name: "Deliberate reveal", intent: "deliberate", at: 0.12, duration: 0.7, easing: "easeOut" },
	{ id: "scale-1", preset: "scale", name: "Scale settle", intent: "settled", at: 0.35, duration: 0.55, easing: "easeOut" },
];

const emptyDocument: MotionDocument = {
	version: 1,
	duration: PROJECT_DURATION,
	layers: [{
		id: "brand-mark",
		initial: { x: 0, y: 24, opacity: 0, scale: 0.92, rotation: 0 },
		tracks: [],
	}],
};

function createBehavior(entry: BehaviorEntry) {
	switch (entry.preset) {
		case "slide":
			return tween({
				name: entry.name,
				intent: entry.intent,
				duration: entry.duration,
				from: { x: -144 },
				to: { x: 0 },
				easing: entry.easing,
			});
		case "reveal":
			return tween({
				name: entry.name,
				intent: entry.intent,
				duration: entry.duration,
				from: { y: 24, opacity: 0 },
				to: { y: 0, opacity: 1 },
				easing: entry.easing,
			});
		case "scale":
			return tween({
				name: entry.name,
				intent: entry.intent,
				duration: entry.duration,
				from: { scale: 0.84 },
				to: { scale: 1 },
				easing: entry.easing,
			});
	}
}

function buildDocument(entries: BehaviorEntry[]): MotionDocument {
	return entries.reduce(
		(document, entry) => applyBehavior(document, "brand-mark", createBehavior(entry), entry.at),
		emptyDocument,
	);
}

function loadEntries(): BehaviorEntry[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as Array<Omit<BehaviorEntry, "easing"> & { easing?: BehaviorEntry["easing"] }>;
			const normalized = parsed.map((entry) => ({ ...entry, easing: entry.easing ?? "easeOut" }));
			buildDocument(normalized);
			return normalized;
		}
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
	return starterEntries;
}

function formatTime(time: number): string {
	return `${time.toFixed(2)}s`;
}

function describePreset(preset: Preset): string {
	switch (preset) {
		case "slide": return "Horizontal entrance";
		case "reveal": return "Y + opacity reveal";
		case "scale": return "Scale transition";
	}
}

function App() {
	const [entries, setEntries] = useState(loadEntries);
	const [selectedId, setSelectedId] = useState(starterEntries[1]!.id);
	const [manualMode, setManualMode] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [proposal, setProposal] = useState<MotionProposal | null>(null);
	const [presetToAdd, setPresetToAdd] = useState<Preset>("slide");
	const [playhead, setPlayhead] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [buildError, setBuildError] = useState("");
	const playheadRef = useRef(0);

	const displayedEntries = proposal ? [...entries, ...proposal.behaviors] : entries;
	let document = emptyDocument;
	let savedDocument = emptyDocument;
	let errorMessage = "";
	try {
		savedDocument = buildDocument(entries);
		document = buildDocument(displayedEntries);
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : "Could not evaluate this composition";
	}
	const frame: MotionFrame = render(document, Math.min(playhead, PROJECT_DURATION));
	const activeLayer = frame.layers.find((layer) => layer.id === "brand-mark");
	const selected = displayedEntries.find((entry) => entry.id === selectedId) ?? null;

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
			setBuildError("");
		} catch (error) {
			setBuildError(error instanceof Error ? error.message : "Could not save locally");
		}
	}, [entries]);

	useEffect(() => {
		if (!playing || errorMessage) return;
		let requestId = 0;
		let previousTimestamp: number | undefined;
		const tick = (timestamp: number) => {
			if (previousTimestamp !== undefined) {
				const nextTime = playheadRef.current + (timestamp - previousTimestamp) / 1000;
				if (nextTime >= PROJECT_DURATION) {
					playheadRef.current = 0;
					setPlayhead(0);
					setPlaying(false);
					return;
				}
				playheadRef.current = nextTime;
				setPlayhead(nextTime);
			}
			previousTimestamp = timestamp;
			requestId = requestAnimationFrame(tick);
		};
		requestId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(requestId);
	}, [playing, errorMessage]);

	function seek(time: number) {
		playheadRef.current = time;
		setPlayhead(time);
	}

	function updateSelected(changes: Partial<BehaviorEntry>) {
		if (!selected) return;
		if (proposal?.behaviors.some((entry) => entry.id === selected.id)) {
			setProposal((current) => current && ({
				...current,
				behaviors: current.behaviors.map((entry) =>
					entry.id === selected.id ? { ...entry, ...changes } : entry,
				),
			}));
			return;
		}
		setEntries((current) => current.map((entry) =>
			entry.id === selected.id ? { ...entry, ...changes } : entry,
		));
	}

	function generateProposal() {
		try {
			const startAt = entries.reduce((end, entry) => Math.max(end, entry.at + entry.duration), 0);
			const nextProposal = draftMotionProposal(prompt, startAt);
			if (startAt + Math.max(...nextProposal.behaviors.map((entry) => entry.duration)) > PROJECT_DURATION) {
				throw new RangeError("There is not enough room at the end of this timeline for that proposal.");
			}
			buildDocument([...entries, ...nextProposal.behaviors]);
			setProposal(nextProposal);
			setManualMode(false);
			setSelectedId(nextProposal.behaviors[0]!.id);
			setBuildError("");
			setPlaying(false);
			seek(startAt);
		} catch (error) {
			setBuildError(error instanceof Error ? error.message : "Could not draft a motion proposal");
		}
	}

	function acceptProposal() {
		if (!proposal) return;
		setEntries((current) => [...current, ...proposal.behaviors]);
		setSelectedId(proposal.behaviors[0]?.id ?? "");
		setProposal(null);
		setManualMode(false);
	}

	function discardProposal() {
		setProposal(null);
		setSelectedId(entries.at(-1)?.id ?? "");
		setManualMode(false);
	}

	function addBehavior() {
		const lastEnd = displayedEntries.reduce((end, entry) => Math.max(end, entry.at + entry.duration), 0);
		const duration = 0.6;
		if (lastEnd + duration > PROJECT_DURATION) {
			setBuildError("The timeline is full. Shorten or remove a behavior to make room.");
			return;
		}
		const name = presetToAdd === "slide" ? "Confident slide" : presetToAdd === "reveal" ? "Deliberate reveal" : "Scale settle";
		const entry: BehaviorEntry = {
			id: `behavior-${Date.now()}`,
			preset: presetToAdd,
			name,
			intent: presetToAdd === "slide" ? "confident" : presetToAdd === "reveal" ? "deliberate" : "settled",
			at: lastEnd,
			duration,
			easing: "easeOut",
		};
		setEntries((current) => [...current, entry]);
		setSelectedId(entry.id);
	}

	function removeSelected() {
		if (!selected) return;
		if (proposal?.behaviors.some((entry) => entry.id === selected.id)) {
			setProposal((current) => current && ({
				...current,
				behaviors: current.behaviors.filter((entry) => entry.id !== selected.id),
			}));
			setSelectedId(entries.at(-1)?.id ?? "");
			return;
		}
		const remaining = entries.filter((entry) => entry.id !== selected.id);
		setEntries(remaining);
		setSelectedId(remaining[0]?.id ?? "");
	}

	function exportDocument() {
		const blob = new Blob([JSON.stringify(savedDocument, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = window.document.createElement("a");
		link.href = url;
		link.download = "motionai-composition.json";
		link.click();
		URL.revokeObjectURL(url);
	}

	function togglePlayback() {
		if (!playing && playhead >= PROJECT_DURATION) seek(0);
		setPlaying((current) => !current);
	}

	const transform = activeLayer?.transform ?? emptyDocument.layers[0]!.initial;
	const playheadPercent = (playhead / PROJECT_DURATION) * 100;

	return (
		<div className="studio">
			<header className="topbar">
				<div className="brand-lockup">
					<div className="brand-mark"><Activity size={17} strokeWidth={2.4} /></div>
					<span className="brand-name">motion<span>ai</span></span>
					<span className="topbar-divider" />
					<span className="workspace-label">STUDIO</span>
				</div>
				<div className="project-title">
					<strong>Untitled composition</strong>
					<span className="save-state"><span className="save-dot" />Saved locally</span>
				</div>
				<button className="export-button" onClick={exportDocument} title="Export composition JSON">
					<Download size={15} /> <span>Export JSON</span>
				</button>
			</header>

			<div className="studio-grid">
				<aside className="sidebar">
					<div className="side-heading"><span>PROJECT</span><ChevronDown size={14} /></div>
					<div className="project-row"><div className="project-swatch">M</div><div><strong>Untitled composition</strong><small>4.00 seconds</small></div></div>
					<div className="side-heading layer-heading"><span>LAYERS</span><button title="Add layer" aria-label="Add layer"><Plus size={14} /></button></div>
					<button className="layer-row selected-layer">
						<Layers3 size={15} /><span>Brand mark</span><span className="layer-visible">●</span>
					</button>
					<div className="sidebar-bottom">
						<div className="engine-status"><span className="engine-pulse" /><div><strong>Motion engine</strong><small>Deterministic · v1</small></div></div>
					</div>
				</aside>

				<main className="workspace">
					<div className="workspace-toolbar">
						<div className="breadcrumb"><span>Composition</span><span className="breadcrumb-slash">/</span><strong>Brand mark</strong></div>
						<div className={`canvas-meta ${proposal ? "proposal-meta" : ""}`}><span className="canvas-live-dot" />{proposal ? "PROPOSAL PREVIEW" : "LIVE PREVIEW"} <span className="meta-divider" /> 60 FPS</div>
					</div>

					<section className="stage-wrap" aria-label="Motion preview">
						<div className="stage-topline"><span>PREVIEW CANVAS</span><span>1920 × 1080</span></div>
						<div className="stage">
							<div className="stage-safe-area" />
							<div className="motion-object" style={{
								transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
								opacity: transform.opacity,
							}}>
								<div className="motion-object-symbol"><span /><span /><span /></div>
								<div className="motion-object-word">MOTION<span>AI</span></div>
								<div className="motion-object-caption">Ideas in motion.</div>
							</div>
							<div className="stage-corner stage-corner-tl" /><div className="stage-corner stage-corner-tr" />
							<div className="stage-corner stage-corner-bl" /><div className="stage-corner stage-corner-br" />
							<div className="stage-timecode">{formatTime(playhead)} <span>/</span> 4.00s</div>
						</div>
						{errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
					</section>

					<section className="timeline-panel" aria-label="Timeline">
						<div className="timeline-toolbar">
							<div className="transport-controls">
								<button className="transport-button primary" onClick={togglePlayback} disabled={Boolean(errorMessage)} title={playing ? "Pause" : "Play"} aria-label={playing ? "Pause" : "Play"}>
									{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
								</button>
								<span className="time-readout">{formatTime(playhead)}</span>
								<span className="duration-readout">/ 4.00s</span>
							</div>
							<div className="timeline-heading"><Clock3 size={14} /><span>BEHAVIOR TIMELINE</span></div>
							<button className="add-behavior-button" onClick={() => setManualMode(true)}><SlidersHorizontal size={13} /> Manual edit</button>
						</div>
						<div className="timeline-scroller">
							<div className="timeline-ruler">
								<div className="ruler-label">TIME</div>
								<div className="ruler-track">{Array.from({ length: 9 }, (_, index) => (
									<div className="ruler-tick" key={index} style={{ left: `${index * 12.5}%` }}><i />{(index * 0.5).toFixed(1)}s</div>
								))}</div>
							</div>
							<div className="behavior-lanes">
								<div className="lane-label"><Sparkles size={13} /><span>BEHAVIORS</span></div>
								<div className="lane-track">
									<div className="lane-grid-lines" />
									{displayedEntries.map((entry, index) => (
										<button
											className={`behavior-clip ${entry.preset} ${selectedId === entry.id ? "active" : ""} ${proposal?.behaviors.some((draft) => draft.id === entry.id) ? "proposal-clip" : ""}`}
											key={entry.id}
											style={{ left: `${entry.at / PROJECT_DURATION * 100}%`, width: `${entry.duration / PROJECT_DURATION * 100}%`, top: `${11 + (index % 2) * 28}px` }}
											onClick={() => setSelectedId(entry.id)}
											title={`${entry.name} · ${formatTime(entry.at)} · ${formatTime(entry.duration)}`}
										>
											<span className="clip-grip">⠿</span><span className="clip-name">{entry.name}</span>
										</button>
									))}
									<div className="playhead-line" style={{ left: `${playheadPercent}%` }}><span /></div>
								</div>
							</div>
							<div className="scrubber-row">
								<div className="ruler-label">SCRUB</div>
								<input aria-label="Scrub timeline" type="range" min="0" max={PROJECT_DURATION} step="0.01" value={playhead} onChange={(event) => seek(Number(event.target.value))} />
							</div>
						</div>
					</section>
				</main>

				<aside className="inspector">
					<div className="inspector-tabs" role="tablist" aria-label="Authoring mode">
						<button className={`inspector-tab ${manualMode ? "" : "active"}`} onClick={() => setManualMode(false)} role="tab" aria-selected={!manualMode}><Sparkles size={14} /> Co-author</button>
						<button className={`inspector-tab ${manualMode ? "active" : ""}`} onClick={() => setManualMode(true)} role="tab" aria-selected={manualMode}><SlidersHorizontal size={14} /> Manual</button>
					</div>
					<div className="inspector-content">
						{manualMode ? <>
						<div className="inspector-title-row"><div><div className="eyebrow">MOTION DESIGN</div><h1>Behaviors</h1></div><div className="inspector-count">{entries.length.toString().padStart(2, "0")}</div></div>
						<p className="inspector-description">Adjust timing and semantic intent directly. Your edits update the preview.</p>
						{proposal && <div className="manual-draft-note"><Sparkles size={13} /><span>Editing a draft. Return to Co-author to accept it.</span></div>}

						<div className="add-section">
							<label className="field-label" htmlFor="preset-select">ADD A BEHAVIOR</label>
							<div className="select-wrap"><select id="preset-select" value={presetToAdd} onChange={(event) => setPresetToAdd(event.target.value as Preset)}>
								<option value="slide">Confident slide</option><option value="reveal">Deliberate reveal</option><option value="scale">Scale settle</option>
							</select><ChevronDown size={14} /></div>
							<button className="add-full-button" onClick={addBehavior}><Plus size={15} /> Add to timeline</button>
						</div>

						<div className="section-divider" />
						{selected ? <>
							<div className="selected-behavior-heading"><div className={`behavior-icon ${selected.preset}`}><Sparkles size={15} /></div><div className="selected-behavior-title"><strong>{selected.name}</strong><span>{describePreset(selected.preset)}</span></div><button className="icon-button danger" onClick={removeSelected} title="Remove behavior" aria-label="Remove behavior"><Trash2 size={15} /></button></div>
							<div className="field-group">
								<label className="field-label" htmlFor="intent-field">INTENT TAG</label>
								<input id="intent-field" className="text-input" value={selected.intent} onChange={(event) => updateSelected({ intent: event.target.value })} />
							</div>
							<div className="field-grid">
								<div className="field-group"><label className="field-label" htmlFor="start-field">START</label><div className="number-input-wrap"><input id="start-field" type="number" min="0" max="3.99" step="0.05" value={selected.at} onChange={(event) => updateSelected({ at: Number(event.target.value) })} /><span>s</span></div></div>
								<div className="field-group"><label className="field-label" htmlFor="duration-field">DURATION</label><div className="number-input-wrap"><input id="duration-field" type="number" min="0.05" max="4" step="0.05" value={selected.duration} onChange={(event) => updateSelected({ duration: Number(event.target.value) })} /><span>s</span></div></div>
							</div>
							<div className="behavior-intent-note"><Sparkles size={14} /><span>Intent is stored with this behavior in the motion document.</span></div>
						</> : <div className="empty-inspector"><Sparkles size={20} /><strong>No behavior selected</strong><span>Add a behavior to begin composing motion.</span></div>}

						{(errorMessage || buildError) && <div className="inspector-error" role="alert">{errorMessage || buildError}</div>}

						<div className="section-divider output-divider" />
						<div className="output-summary"><div className="field-label">COMPOSITION</div><div className="summary-row"><span>Duration</span><strong>4.00s</strong></div><div className="summary-row"><span>Layers</span><strong>01</strong></div><div className="summary-row"><span>Output</span><strong>Motion JSON</strong></div></div>
						</> : <>
							<div className="inspector-title-row"><div><div className="eyebrow">MOTION CO-AUTHOR</div><h1>Describe it</h1></div><div className="inspector-count"><Sparkles size={13} /></div></div>
							<p className="inspector-description">Start with the feeling. Review a motion draft, then adjust it yourself if needed.</p>
							<div className="provider-status"><Sparkles size={14} /><div><strong>Local prototype</strong><span>Prompt matching only · no model connected</span></div></div>
							<label className="field-label prompt-label" htmlFor="motion-prompt">YOUR MOTION BRIEF</label>
							<textarea id="motion-prompt" className="prompt-input" rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Give the mark a confident entrance, then let it settle gently…" />
							<div className="prompt-examples"><span>TRY</span><button onClick={() => setPrompt("Give it a confident entrance")}>Confident entrance</button><button onClick={() => setPrompt("A gentle reveal and soft settle")}>Gentle reveal</button></div>
							<button className="draft-button" disabled={!prompt.trim()} onClick={generateProposal}><Sparkles size={15} /> Draft motion proposal</button>
							{proposal ? <div className="proposal-card">
								<div className="proposal-card-heading"><div><span className="eyebrow">REVIEW BEFORE APPLYING</span><strong>Co-author proposal</strong></div><button className="icon-button" onClick={discardProposal} title="Discard proposal" aria-label="Discard proposal"><X size={15} /></button></div>
								<p className="proposal-summary">{proposal.summary}</p>
								<div className="proposal-items">{proposal.behaviors.map((entry) => <div className="proposal-item" key={entry.id}><span className={`proposal-swatch ${entry.preset}`} /><div><strong>{entry.name}</strong><small>{formatTime(entry.at)} · {formatTime(entry.duration)} · {entry.easing}</small></div></div>)}</div>
								<p className="proposal-rationale">{proposal.rationale}</p>
								<p className="proposal-note">{proposal.note}</p>
								<button className="accept-proposal-button" onClick={acceptProposal} disabled={!proposal.behaviors.length || Boolean(errorMessage)}><Check size={15} /> Apply proposal</button>
							</div> : <div className="proposal-empty"><Sparkles size={16} /><span>Your draft will appear here for review before it changes the composition.</span></div>}
							{(errorMessage || buildError) && <div className="inspector-error" role="alert">{errorMessage || buildError}</div>}
							<button className="manual-link" onClick={() => setManualMode(true)}><SlidersHorizontal size={13} /> Prefer direct control? Open manual edits</button>
							<div className="section-divider output-divider" />
							<div className="output-summary"><div className="field-label">COMPOSITION</div><div className="summary-row"><span>Duration</span><strong>4.00s</strong></div><div className="summary-row"><span>Behaviors</span><strong>{displayedEntries.length.toString().padStart(2, "0")}</strong></div><div className="summary-row"><span>Output</span><strong>Motion JSON</strong></div></div>
						</>}
					</div>
					<div className="inspector-footer"><Check size={14} /><span>Changes saved in this browser</span></div>
				</aside>
			</div>
		</div>
	);
}

export default App;