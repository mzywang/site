<script lang="ts">
	import Dog from '$lib/Dog.svelte';
</script>

<svelte:head>
	<title>mzywang.dev</title>
</svelte:head>

<main>
	<h1>mzywang</h1>
	<hr />
	<ul>
		<li><a href="https://github.com/mzywang">github.com/mzywang</a></li>
		<li><a href="https://www.linkedin.com/in/mzywang">linkedin.com/in/mzywang</a></li>
	</ul>
</main>

<div class="roam-area">
	<Dog />
</div>

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

	hr {
		width: 100%;
		height: 0;
		border: none;
		border-top: 1px dashed var(--ink-dim);
		margin: 0.9rem 0 1.6rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li + li {
		margin-top: 0.35rem;
	}

	a {
		text-decoration: none;
		color: var(--ink-dim);
	}

	a:hover {
		color: var(--ink);
	}

	.roam-area {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: 50vh;
		overflow: hidden;
		pointer-events: none;
	}
</style>
