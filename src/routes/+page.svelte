<svelte:head>
	<title>mzywang.dev</title>
</svelte:head>

<main>
	<div class="frame">
		<div class="titlebar">
			<span>[ mzywang.dev ]</span>
		</div>

		<section>
			<p class="line"><span class="prompt">$</span> whoami</p>
			<p class="output">mzywang<span class="cursor">_</span></p>
		</section>

		<section>
			<p class="line"><span class="prompt">$</span> links --list</p>
			<ul class="output links">
				<li><span class="arrow">→</span> <a href="https://github.com/mzywang">github.com/mzywang</a></li>
				<li>
					<span class="arrow">→</span>
					<a href="https://www.linkedin.com/in/mzywang">linkedin.com/in/mzywang</a>
				</li>
			</ul>
		</section>
	</div>
</main>

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		min-height: 100svh;
		padding: 4rem 1.25rem;
	}

	.frame {
		width: 100%;
		max-width: 30rem;
		border: 1px solid var(--rule);
	}

	.titlebar {
		border-bottom: 1px solid var(--rule);
		padding: 0.6rem 1rem;
		font-weight: 600;
	}

	section {
		padding: 1.1rem 1.25rem;
	}

	section + section {
		border-top: 1px dashed var(--ink-dim);
	}

	.line {
		margin: 0 0 0.4rem;
		color: var(--ink-dim);
	}

	.prompt {
		color: var(--ink);
		font-weight: 600;
	}

	.output {
		margin: 0;
		padding-left: 1.2rem;
	}

	.cursor {
		display: inline-block;
		animation: blink 1s step-start infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.links {
		list-style: none;
	}

	.links li {
		margin: 0.2rem 0;
	}

	.arrow {
		color: var(--ink-dim);
	}

	.links a {
		text-decoration: none;
		border-bottom: 1px solid var(--ink-dim);
	}

	.links a:hover {
		border-color: var(--ink);
	}
</style>
