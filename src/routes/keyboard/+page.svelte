<script lang="ts">
	import argos from './argos_config.json';
	import { ALT, CTL, GUI, SFT, char, decode, keyLabel, modsLabel } from '$lib/argos';
	import type { Action, Config } from '$lib/argos';

	// The keymap comes from the Argos configurator export next to this file.
	// It's for a Charybdis Nano: a 3x5 split with column stagger, three thumb
	// keys on the left and two on the right (the trackball takes the third).
	const config: Config = argos;

	// The pointer layer drives the trackball, which there's no use for here, so
	// its layer-tap keys just type their tap key.
	const skipped = new Set([config.layerNames.indexOf('pointer')]);
	const layers: Action[][] = config.keycodes.map((layer) =>
		layer.map((c): Action => {
			const a = decode(c, config);
			return a.type === 'dual' && 'layer' in a.hold && skipped.has(a.hold.layer)
				? { type: 'key', code: a.tap, mods: 0 }
				: a;
		})
	);

	// Shorter names for the layers whose full names don't fit under a key.
	const short: Record<string, string> = { navigation: 'nav', function: 'fn' };
	const layerName = (layer: number) => short[config.layerNames[layer]] ?? config.layerNames[layer];

	interface Key {
		// Index into each layer's keycodes: row * cols + col in the matrix.
		pos: number;
		// Position in key widths from the top left of the board.
		x: number;
		y: number;
	}

	// How far each column sits below the middle finger's, pinky column first.
	const stagger = [0.5, 0.125, 0, 0.125, 0.25];
	// Gap between the halves, in key widths.
	const split = 2;
	const width = 5 + split + 5;
	const thumbY = 3.5;
	const height = thumbY + 1;

	const at = (row: number, col: number) => row * config.cols + col;

	const keys: Key[] = [];
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 5; c++) {
			keys.push({ pos: at(r, c), x: c, y: r + stagger[c] });
			// Matrix rows 4-6 are the right half, wired from the pinky inwards,
			// so matrix column c sits at physical column 4 - c.
			keys.push({ pos: at(r + 4, c), x: 5 + split + (4 - c), y: r + stagger[c] });
		}
	}
	// Thumbs, which aren't wired in physical order. Left, outer to inner:
	// esc, space, tab. Right, inner to outer: ret, del.
	keys.push(
		{ pos: at(3, 2), x: 1.5, y: thumbY },
		{ pos: at(3, 3), x: 2.5, y: thumbY },
		{ pos: at(3, 0), x: 3.5, y: thumbY },
		{ pos: at(7, 0), x: width - 4.5, y: thumbY },
		{ pos: at(7, 2), x: width - 3.5, y: thumbY }
	);

	interface Held {
		pointer: number;
		pos: number;
		action: Action;
		start: number;
		// Dual-role keys stay undecided until they're tapped or held.
		state: 'undecided' | 'hold' | 'done';
	}

	// Pointers currently down. Each finger is its own pointer, so a layer key
	// can be held with one while tapping with another.
	let held = $state<Held[]>([]);

	function layerOf(h: Held): number | null {
		const a = h.action;
		if (a.type === 'layer') return a.layer;
		if (a.type === 'dual' && 'layer' in a.hold && h.state === 'hold') return a.hold.layer;
		return null;
	}

	// A layer key switches layers once it's a hold: after the tapping term, or
	// as soon as another key is pressed. Waiting keeps a quick tap from flashing
	// the layer. The highest active layer wins, as in QMK.
	let on = $derived(new Set([0, ...held.map(layerOf).filter((l) => l !== null)]));
	let active = $derived(Math.max(...on));

	let mods = $derived(
		held.reduce((m, h) => {
			const a = h.action;
			if (a.type === 'mod') return m | a.mods;
			if (a.type === 'dual' && 'mods' in a.hold && h.state === 'hold') return m | a.hold.mods;
			return m;
		}, 0)
	);

	// The action for a key on the active layer, falling through transparent
	// keys to the layers below it.
	function resolve(pos: number): Action {
		for (let l = active; l >= 0; l--) {
			if (!on.has(l)) continue;
			const a = layers[l][pos];
			if (a.type !== 'trans') return a;
		}
		return { type: 'none' };
	}

	// While shift is held the legends show what the keys would type, e.g. "A"
	// and "!" instead of "a" and "1".
	let shift = $derived(mods & SFT);
	// Only keys that print change; the rest, like arrows, keep their legend.
	const shiftFor = (code: number) => (char(code, true) ? shift : 0);

	function legend(pos: number): { main: string; sub?: string } {
		const a = resolve(pos);
		switch (a.type) {
			case 'key':
				return { main: keyLabel(a.code, a.mods | shiftFor(a.code)) };
			case 'dual':
				return {
					main: keyLabel(a.tap, shiftFor(a.tap)),
					sub: 'layer' in a.hold ? layerName(a.hold.layer) : modsLabel(a.hold.mods)
				};
			case 'mod':
				return { main: modsLabel(a.mods) };
			case 'layer':
				return { main: layerName(a.layer) };
			case 'other':
				return { main: a.label };
			default:
				return { main: '' };
		}
	}

	let output = $state('');
	let box: HTMLTextAreaElement;

	// Types a basic keycode into the box. Anything held with ctrl, alt or cmd
	// would be a shortcut, and keys that don't print (arrows, media...) do
	// nothing here.
	function emit(code: number, withMods: number) {
		if (withMods & (CTL | ALT | GUI)) return;
		if (code === 0x2a) {
			output = output.slice(0, -1);
		} else {
			const c = char(code, (withMods & SFT) !== 0);
			if (c) output += c;
		}
		// Keep the newest text in view once the box starts scrolling.
		requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
	}

	// pointerdown instead of click: fires on touch without waiting for release.
	function press(key: Key) {
		return (e: PointerEvent) => {
			e.preventDefault();
			const now = performance.now();
			// Another key going down settles any dual-role keys already held. A
			// layer key becomes a hold straight away; a mod-tap only once it's been
			// held for the tapping term, so rolling over home row keys still types.
			for (const h of held) {
				if (h.state !== 'undecided' || h.action.type !== 'dual') continue;
				if ('layer' in h.action.hold || now - h.start >= config.tappingTerm) {
					h.state = 'hold';
				} else {
					h.state = 'done';
					emit(h.action.tap, mods);
				}
			}

			const action = resolve(key.pos);
			if (action.type === 'key') emit(action.code, action.mods | mods);
			held.push({
				pointer: e.pointerId,
				pos: key.pos,
				action,
				start: now,
				state: action.type === 'dual' ? 'undecided' : 'hold'
			});
			// Held past the tapping term on its own: a hold, which for a layer key
			// shows its layer.
			if (action.type === 'dual') {
				const h = held[held.length - 1];
				setTimeout(() => {
					if (held.includes(h) && h.state === 'undecided') h.state = 'hold';
				}, config.tappingTerm);
			}
		};
	}

	function release(e: PointerEvent) {
		const i = held.findIndex((h) => h.pointer === e.pointerId);
		if (i < 0) return;
		const h = held[i];
		held.splice(i, 1);
		// Released on its own within the tapping term: a tap.
		if (
			h.action.type === 'dual' &&
			h.state === 'undecided' &&
			performance.now() - h.start < config.tappingTerm
		) {
			emit(h.action.tap, mods);
		}
	}

	function isDown(key: Key) {
		return held.some((h) => h.pos === key.pos);
	}
</script>

<svelte:head>
	<title>keyboard · mzywang.dev</title>
</svelte:head>

<!-- Spans the screen, not just the page column, so the keys are big enough to hit. -->
<div class="wide">
	<!-- readonly so tapping the box doesn't bring up the on-screen keyboard. -->
	<textarea bind:this={box} value={output} readonly rows="4" aria-label="output"></textarea>

	<div class="keyboard">
		<p class="layer" aria-live="polite">{layerName(active)}</p>
		<div class="board" style:--cols={width} style:--rows={height}>
			{#each keys as key (key.pos)}
				{@const l = legend(key.pos)}
				<button
					type="button"
					class="key"
					class:pressed={isDown(key)}
					class:small={[...l.main].length > 1}
					style:--x={key.x}
					style:--y={key.y}
					onpointerdown={press(key)}
					onpointerup={release}
					onpointercancel={release}
					onpointerleave={release}
				>
					{l.main}
					{#if l.sub}<span class="sub">{l.sub}</span>{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.wide {
		position: relative;
		left: 50%;
		transform: translateX(-50%);
		/* The whole screen, less the same 1.25rem side gutter as the page. */
		width: calc(100vw - 2.5rem);
	}

	textarea {
		display: block;
		width: 100%;
		resize: none;
		padding: 0.6rem 0.75rem;
		border: 1px dashed var(--ink-dim);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		tab-size: 4;
		overflow-wrap: anywhere;
	}

	textarea:focus {
		outline: none;
		border-color: var(--ink);
	}

	.keyboard {
		container-type: inline-size;
		margin-top: 1.25rem;
	}

	.layer {
		margin: 0 0 0.5rem;
		color: var(--ink-dim);
	}

	.board {
		/* One key width, including the gap around it. */
		--u: calc(100cqw / var(--cols));
		--gap: calc(var(--u) * 0.08);
		position: relative;
		height: calc(var(--u) * var(--rows));
	}

	.key {
		position: absolute;
		left: calc(var(--x) * var(--u) + var(--gap) / 2);
		top: calc(var(--y) * var(--u) + var(--gap) / 2);
		width: calc(var(--u) - var(--gap));
		height: calc(var(--u) - var(--gap));
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: calc(var(--u) * 0.4);
		line-height: 1;
	}

	/* What the key does when held, e.g. a layer or a modifier. */
	.sub {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(var(--u) * 0.08);
		color: var(--ink-dim);
		font-size: calc(var(--u) * 0.16);
	}

	button {
		cursor: pointer;
		/* No double-tap zoom, text selection or callout while tapping quickly. */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}

	button.small {
		font-size: calc(var(--u) * 0.22);
	}

	button.pressed {
		background: var(--ink);
		color: var(--paper);
	}

	button.pressed .sub {
		color: var(--paper);
	}
</style>
