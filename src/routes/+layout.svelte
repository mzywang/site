<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	// Shown after "mzywang /" in the header on subpages.
	const sections: Record<string, string> = { '/log': 'eng log', '/keyboard': 'keyboard' };
	let section = $derived(page.route.id ? sections[page.route.id] : undefined);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- The header and rule live here, at one fixed width, so they don't shift between pages. -->
<main>
	<h1>
		{#if section}
			<a href={resolve('/')}>mzywang</a> / {section}
		{:else}
			mzywang
		{/if}
	</h1>
	<hr />
	{@render children()}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-height: 100svh;
		width: 100%;
		max-width: 24rem;
		margin: 0 auto;
		padding: 6rem 1.25rem;
	}

	h1 {
		font-size: 1.1rem;
		font-weight: 400;
		margin: 0;
	}

	h1 a {
		text-decoration: none;
		color: var(--ink);
	}

	h1 a:hover {
		color: var(--ink-dim);
	}

	hr {
		width: 100%;
		height: 0;
		border: none;
		border-top: 1px dashed var(--ink-dim);
		margin: 0.9rem 0 1.6rem;
	}
</style>
