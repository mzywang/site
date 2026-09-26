<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>eng log · mzywang.dev</title>
</svelte:head>

{#if data.days.length === 0}
	<p class="empty">nothing here yet.</p>
{:else}
	{#each data.days as day (day.date)}
		<section>
			<h2><time datetime={day.date}>{day.date}</time></h2>
			<ul>
				{#each day.entries as entry, i (i)}
					<li>
						<span class="time">{entry.time ?? ''}</span>
						<p>{entry.text}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<style>
	.empty {
		color: var(--ink-dim);
		margin: 0;
	}

	section + section {
		margin-top: 2rem;
	}

	h2 {
		font-size: 1rem;
		font-weight: 400;
		margin: 0 0 0.6rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: 3.5rem 1fr;
		gap: 0.75rem;
	}

	li + li {
		margin-top: 0.35rem;
	}

	.time {
		color: var(--ink-dim);
	}

	p {
		margin: 0;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
