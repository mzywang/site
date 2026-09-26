<script lang="ts">
	// Colemak-DH as set up in the dotfiles' kanata config (builtin_cmd_tab.kbd):
	// ' on the p key and ; on the key right of l, laid out as a Corne-style
	// split: 3x6 per half with column stagger, plus a thumb cluster.
	type Kind = 'char' | 'shift' | 'esc' | 'spc' | 'tab' | 'ret' | 'bspc' | 'blank';
	interface Key {
		id: string;
		kind: Kind;
		base?: string;
		shifted?: string;
		label?: string;
		// Position in key widths from the top left of the board.
		x: number;
		y: number;
	}

	// A cell is an unshifted/shifted pair like "aA", a special key's name, or
	// '' for a blank position.
	const left = [
		['', 'qQ', 'wW', 'fF', 'pP', 'bB'],
		['', 'aA', 'rR', 'sS', 'tT', 'gG'],
		['shift', 'zZ', 'xX', 'cC', 'dD', 'vV']
	];
	const right = [
		['jJ', 'lL', 'uU', 'yY', `'"`, '[{'],
		['mM', 'nN', 'eE', 'iI', 'oO', ';:'],
		['kK', 'hH', ',<', '.>', '/?', 'shift']
	];

	// How far each column sits below the middle finger's, outer column first.
	const stagger = [0.5, 0.5, 0.125, 0, 0.125, 0.25];
	// Gap between the halves, in key widths.
	const split = 2;
	const width = 6 + split + 6;
	const thumbY = 3.5;
	const height = thumbY + 1;

	const labels: Partial<Record<Kind, string>> = {
		shift: 'shift',
		esc: 'esc',
		spc: 'space',
		tab: 'tab',
		ret: 'ret',
		bspc: 'del'
	};

	function cell(id: string, text: string, x: number, y: number): Key {
		if (text === '') return { id, kind: 'blank', x, y };
		if (text.length === 2) return { id, kind: 'char', base: text[0], shifted: text[1], x, y };
		return { id, kind: text as Kind, x, y };
	}

	function thumb(kind: Kind, x: number): Key {
		return { id: kind, kind, x, y: thumbY };
	}

	function half(side: string, rows: string[][], x0: number, stag: number[]): Key[] {
		const out: Key[] = [];
		rows.forEach((row, r) => {
			row.forEach((text, c) => out.push(cell(`${side}${r}${c}`, text, x0 + c, r + stag[c])));
		});
		return out;
	}

	const keys: Key[] = [
		...half('l', left, 0, stagger),
		// The right half mirrors the left, so its stagger runs the other way.
		...half('r', right, 6 + split, [...stagger].reverse()),
		// Left to right: esc, space, tab | ret, del.
		thumb('esc', 3.5),
		thumb('spc', 4.5),
		thumb('tab', 5.5),
		thumb('ret', width - 6.5),
		thumb('bspc', width - 5.5)
	];

	let output = $state('');
	let box: HTMLTextAreaElement;

	// Pointers currently down on each key. iOS Safari applies :active to only
	// one element at a time, so the pressed look is driven from this instead.
	let down = $state<Record<string, number[]>>({});
	let shift = $derived(keys.some((k) => k.kind === 'shift' && down[k.id]?.length));

	function isDown(key: Key) {
		return (down[key.id]?.length ?? 0) > 0 || (key.kind === 'shift' && shift);
	}

	function label(key: Key) {
		if (key.kind === 'char') return shift ? key.shifted : key.base;
		return labels[key.kind] ?? '';
	}

	function type(key: Key) {
		switch (key.kind) {
			case 'char':
				output += shift ? key.shifted : key.base;
				break;
			case 'bspc':
				output = output.slice(0, -1);
				break;
			case 'tab':
				output += '\t';
				break;
			case 'ret':
				output += '\n';
				break;
			case 'spc':
				output += ' ';
				break;
		}
	}

	// pointerdown instead of click: fires on touch without waiting for release,
	// and each finger is its own pointer, so shift can be held while typing.
	function press(key: Key) {
		return (e: PointerEvent) => {
			e.preventDefault();
			down[key.id] = [...(down[key.id] ?? []), e.pointerId];
			type(key);
			// Keep the newest text in view once the box starts scrolling.
			requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
		};
	}

	function release(key: Key) {
		return (e: PointerEvent) => {
			down[key.id] = (down[key.id] ?? []).filter((id) => id !== e.pointerId);
		};
	}
</script>

<svelte:head>
	<title>keyboard · mzywang.dev</title>
</svelte:head>

<!-- Wider than the page column so the keys are big enough to hit. -->
<div class="wide">
	<!-- readonly so tapping the box doesn't bring up the on-screen keyboard. -->
	<textarea bind:this={box} value={output} readonly rows="4" aria-label="output"></textarea>

	<div class="keyboard">
		<div class="board" style:--cols={width} style:--rows={height}>
			{#each keys as key (key.id)}
				{#if key.kind === 'blank'}
					<span class="key blank" style:--x={key.x} style:--y={key.y}></span>
				{:else}
					<button
						type="button"
						class="key"
						class:pressed={isDown(key)}
						class:mod={key.kind !== 'char'}
						style:--x={key.x}
						style:--y={key.y}
						onpointerdown={press(key)}
						onpointerup={release(key)}
						onpointercancel={release(key)}
						onpointerleave={release(key)}
					>
						{label(key)}
					</button>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.wide {
		position: relative;
		left: 50%;
		transform: translateX(-50%);
		width: min(calc(100vw - 2.5rem), 60rem);
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
	}

	.blank {
		border: 1px dashed var(--ink-dim);
		opacity: 0.5;
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

	button.mod {
		color: var(--ink-dim);
		font-size: calc(var(--u) * 0.22);
	}

	button.pressed {
		background: var(--ink);
		color: var(--paper);
	}
</style>
