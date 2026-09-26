<script lang="ts">
	// Colemak-DH as set up in the dotfiles' kanata config (builtin_cmd_tab.kbd),
	// laid out as a Corne-style split without the outer columns: 3x5 per half
	// with column stagger, plus thumb keys.
	type Kind = 'char' | 'esc' | 'spc' | 'tab' | 'ret' | 'bspc';
	interface Key {
		id: string;
		kind: Kind;
		char?: string;
		// Position in key widths from the top left of the board.
		x: number;
		y: number;
	}

	const left = ['qwfpb', 'arstg', 'zxcdv'];
	const right = [`jluy'`, 'mneio', 'kh,./'];

	// How far each column sits below the middle finger's, pinky column first.
	const stagger = [0.5, 0.125, 0, 0.125, 0.25];
	// Gap between the halves, in key widths.
	const split = 2;
	const width = 5 + split + 5;
	const thumbY = 3.5;
	const height = thumbY + 1;

	const labels: Record<Exclude<Kind, 'char'>, string> = {
		esc: 'esc',
		spc: 'space',
		tab: 'tab',
		ret: 'ret',
		bspc: 'del'
	};

	function half(rows: string[], x0: number, stag: number[]): Key[] {
		const out: Key[] = [];
		rows.forEach((row, r) => {
			[...row].forEach((char, c) => {
				out.push({ id: char, kind: 'char', char, x: x0 + c, y: r + stag[c] });
			});
		});
		return out;
	}

	function thumb(kind: Kind, x: number): Key {
		return { id: kind, kind, x, y: thumbY };
	}

	const keys: Key[] = [
		...half(left, 0, stagger),
		// The right half mirrors the left, so its stagger runs the other way.
		...half(right, 5 + split, [...stagger].reverse()),
		// Left to right: esc, space, tab | ret, del.
		thumb('esc', 2.5),
		thumb('spc', 3.5),
		thumb('tab', 4.5),
		thumb('ret', width - 5.5),
		thumb('bspc', width - 4.5)
	];

	let output = $state('');
	let box: HTMLTextAreaElement;

	// Pointers currently down on each key. iOS Safari applies :active to only
	// one element at a time, so the pressed look is driven from this instead.
	let down = $state<Record<string, number[]>>({});

	function isDown(key: Key) {
		return (down[key.id]?.length ?? 0) > 0;
	}

	function label(key: Key) {
		return key.kind === 'char' ? key.char : labels[key.kind];
	}

	function type(key: Key) {
		switch (key.kind) {
			case 'char':
				output += key.char;
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
	// and each finger is its own pointer, so several keys can be held at once.
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
