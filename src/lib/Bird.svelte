<script lang="ts">
	import { onMount } from 'svelte';

	const ART =
		'　　　　 _,,_\n　　　-´・｡丶\n　　 　 l.ﾞ｀ (;;ﾐヽ､.＿__\n　 　 　 ｀ﾝ‐ｼ"ﾞ￣￣\n　 　 　 ´　´';

	let x = $state(40);
	let bottom = $state(-14);
	let facing = $state(1);
	let tilt = $state(0);
	let transitionMs = $state(350);

	let maxX = 0;
	let el: HTMLDivElement;

	function schedule(delay = 900) {
		setTimeout(next, delay);
	}

	function next() {
		const r = Math.random();
		const dir = Math.random() < 0.5 ? -1 : 1;
		if (r < 0.55) {
			schedule(1800 + Math.random() * 2500);
		} else if (r < 0.9) {
			hop(dir);
		} else {
			fly(dir);
		}
	}

	function hop(dir: number) {
		facing = dir;
		transitionMs = 300;
		bottom = -4;
		setTimeout(() => {
			x = Math.max(0, Math.min(maxX, x + dir * 24));
			setTimeout(() => {
				bottom = -14;
				schedule(900);
			}, 300);
		}, 30);
	}

	function fly(dir: number) {
		facing = dir;
		transitionMs = 1100;
		bottom = 60;
		tilt = dir * -6;
		setTimeout(() => {
			x = Math.random() * maxX;
		}, 30);
		setTimeout(() => {
			bottom = -14;
			tilt = 0;
		}, 700);
		setTimeout(() => {
			transitionMs = 350;
			schedule(900);
		}, 1150);
	}

	onMount(() => {
		maxX = el.parentElement!.clientWidth - el.offsetWidth;
		x = maxX * 0.4;
		schedule(1200);
	});
</script>

<div
	class="bird"
	bind:this={el}
	style:left="{x}px"
	style:bottom="{bottom}px"
	style:transform="scaleX({facing}) rotate({tilt}deg)"
	style:transition="left {transitionMs}ms ease, bottom {transitionMs}ms ease, transform {transitionMs}ms
	ease"
>
	{ART}
</div>

<style>
	.bird {
		position: absolute;
		white-space: pre;
		font-size: 15px;
		line-height: 1.1;
		transform-origin: center bottom;
		user-select: none;
	}
</style>
