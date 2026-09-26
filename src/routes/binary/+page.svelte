<script lang="ts">
	let output = $state('');
	let box: HTMLTextAreaElement;

	// pointerdown instead of click: fires on touch without waiting for release,
	// and each finger is its own pointer, so both keys can be pressed at once.
	function press(bit: '0' | '1') {
		return (e: PointerEvent) => {
			e.preventDefault();
			output += bit;
			// Keep the newest bits in view once the box starts scrolling.
			requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
		};
	}
</script>

<svelte:head>
	<title>binary · mzywang.dev</title>
</svelte:head>

<!-- readonly so tapping the box doesn't bring up the on-screen keyboard. -->
<textarea bind:this={box} value={output} readonly rows="4" aria-label="output"></textarea>

<div class="keys">
	<button type="button" onpointerdown={press('0')}>0</button>
	<button type="button" onpointerdown={press('1')}>1</button>
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

	button:active {
		background: var(--ink);
		color: var(--paper);
	}
</style>
