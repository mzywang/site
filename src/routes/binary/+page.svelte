<script lang="ts">
	type Bit = '0' | '1';
	const bits: Bit[] = ['0', '1'];

	let output = $state('');
	let box: HTMLTextAreaElement;

	// Pointers currently down on each key. iOS Safari applies :active to only
	// one element at a time, so the pressed look is driven from this instead.
	let down = $state<Record<Bit, number[]>>({ '0': [], '1': [] });

	// pointerdown instead of click: fires on touch without waiting for release,
	// and each finger is its own pointer, so both keys can be pressed at once.
	function press(bit: Bit) {
		return (e: PointerEvent) => {
			e.preventDefault();
			down[bit].push(e.pointerId);
			output += bit;
			// Keep the newest bits in view once the box starts scrolling.
			requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
		};
	}

	function release(bit: Bit) {
		return (e: PointerEvent) => {
			down[bit] = down[bit].filter((id) => id !== e.pointerId);
		};
	}
</script>

<svelte:head>
	<title>binary · mzywang.dev</title>
</svelte:head>

<!-- readonly so tapping the box doesn't bring up the on-screen keyboard. -->
<textarea bind:this={box} value={output} readonly rows="4" aria-label="output"></textarea>

<div class="keys">
	{#each bits as bit (bit)}
		<button
			type="button"
			class:pressed={down[bit].length > 0}
			onpointerdown={press(bit)}
			onpointerup={release(bit)}
			onpointercancel={release(bit)}
			onpointerleave={release(bit)}>{bit}</button
		>
	{/each}
</div>

<style>
	textarea {
		width: 100%;
		resize: none;
		padding: 0.6rem 0.75rem;
		border: 1px dashed var(--ink-dim);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		overflow-wrap: anywhere;
	}

	textarea:focus {
		outline: none;
		border-color: var(--ink);
	}

	.keys {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		width: 100%;
		margin-top: 1.25rem;
	}

	button {
		aspect-ratio: 1;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 2.5rem;
		cursor: pointer;
		/* No double-tap zoom, text selection or callout while tapping quickly. */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}

	button.pressed {
		background: var(--ink);
		color: var(--paper);
	}
</style>
