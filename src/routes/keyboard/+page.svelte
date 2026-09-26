<script lang="ts">
	// Colemak-DH as set up in the dotfiles' kanata config (builtin_cmd_tab.kbd):
	// ' on the p key and ; on the key right of l, on an ANSI-shaped board.
	type Special = 'bspc' | 'tab' | 'ret' | 'shift' | 'spc' | 'gap';
	type Key =
		| { id: string; kind: 'char'; base: string; shifted: string; w?: number }
		| { id: string; kind: Special; label?: string; w: number };

	// Pairs of unshifted/shifted characters, e.g. "1!" or "aA".
	function chars(pairs: string): Key[] {
		const keys: Key[] = [];
		for (let i = 0; i < pairs.length; i += 2) {
			keys.push({ id: pairs[i], kind: 'char', base: pairs[i], shifted: pairs[i + 1] });
		}
		return keys;
	}

	// Each row adds up to 15 key widths.
	const rows: Key[][] = [
		[...chars('`~1!2@3#4$5%6^7&8*9(0)-_=+'), { id: 'bspc', kind: 'bspc', label: 'del', w: 2 }],
		[
			{ id: 'tab', kind: 'tab', label: 'tab', w: 1.5 },
			...chars(`qQwWfFpPbBjJlLuUyY'"[{]}`),
			{ id: '\\', kind: 'char', base: '\\', shifted: '|', w: 1.5 }
		],
		[
			{ id: 'caps', kind: 'gap', w: 1.75 },
			...chars('aArRsStTgGmMnNeEiIoO;:'),
			{ id: 'ret', kind: 'ret', label: 'ret', w: 2.25 }
		],
		[
			{ id: 'lsft', kind: 'shift', label: 'shift', w: 2.25 },
			...chars('zZxXcCdDvVkKhH,<.>/?'),
			{ id: 'rsft', kind: 'shift', label: 'shift', w: 2.75 }
		],
		[
			{ id: 'gap-l', kind: 'gap', w: 4.375 },
			{ id: 'spc', kind: 'spc', w: 6.25 },
			{ id: 'gap-r', kind: 'gap', w: 4.375 }
		]
	];

	let output = $state('');
	let box: HTMLTextAreaElement;

	// Pointers currently down on each key. iOS Safari applies :active to only
	// one element at a time, so the pressed look is driven from this instead.
	let down = $state<Record<string, number[]>>({});
	let shift = $derived(!!(down.lsft?.length || down.rsft?.length));

	function isDown(key: Key) {
		return (down[key.id]?.length ?? 0) > 0 || (key.kind === 'shift' && shift);
	}

	function label(key: Key) {
		if (key.kind === 'char') return shift ? key.shifted : key.base;
		return key.label ?? '';
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
		{#each rows as row, r (r)}
			<div class="row">
				{#each row as key (key.id)}
					{#if key.kind === 'gap'}
						<span style:flex-grow={key.w}></span>
					{:else}
						<button
							type="button"
							style:flex-grow={key.w ?? 1}
							class:pressed={isDown(key)}
							class:mod={key.kind !== 'char'}
							aria-label={key.kind === 'spc' ? 'space' : undefined}
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
		{/each}
	</div>
</div>

<style>
	.wide {
		--gap: 0.35rem;
		position: relative;
		left: 50%;
		transform: translateX(-50%);
		width: min(calc(100vw - 2.5rem), 54rem);
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
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		margin-top: 1.25rem;
	}

	.row {
		display: flex;
		gap: var(--gap);
	}

	.row > * {
		flex-basis: 0;
		min-width: 0;
	}

	button {
		/* One key width: the row is 15 of them plus 14 gaps. */
		height: calc((100cqw - 14 * var(--gap)) / 15);
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: clamp(0.8rem, 3.2cqw, 1.4rem);
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
		font-size: clamp(0.6rem, 1.8cqw, 0.9rem);
	}

	button.pressed {
		background: var(--ink);
		color: var(--paper);
	}
</style>
