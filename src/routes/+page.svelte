<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>mzywang.dev</title>
</svelte:head>

<ul>
	<li><a href={resolve('/log')}>eng log</a></li>
	<li><a href={resolve('/keyboard')}>keyboard</a></li>
	<li><a href="https://github.com/mzywang">github.com/mzywang</a></li>
	<li><a href="https://www.linkedin.com/in/mzywang">linkedin.com/in/mzywang</a></li>
</ul>

<style>
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
</style>
