<script lang="ts">
	import { onMount } from 'svelte';

	const IDLE = '~o>';
	const HOP_UP = '~O>';
	const FLY_A = '^o^';
	const FLY_B = '-o-';

	let glyph = $state(IDLE);
	let x = $state(40);
	let bottom = $state(-7);
	let facing = $state(1);
	let transitionMs = $state(350);

	let wireWidth = 0;
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
		transitionMs = 350;
		glyph = HOP_UP;
		bottom = 4;
		setTimeout(() => {
			x = Math.max(0, Math.min(wireWidth, x + dir * 22));
			setTimeout(() => {
				bottom = -7;
				glyph = IDLE;
				schedule(900);
			}, 350);
		}, 30);
	}

	function fly(dir: number) {
		facing = dir;
		transitionMs = 1100;
		bottom = 46;
		glyph = FLY_A;
		let flap = 0;
		const flapTimer = setInterval(() => {
			flap = 1 - flap;
			glyph = flap ? FLY_A : FLY_B;
		}, 150);
		setTimeout(() => {
			x = Math.random() * wireWidth;
		}, 30);
		setTimeout(() => {
			bottom = -7;
		}, 700);
		setTimeout(() => {
			clearInterval(flapTimer);
			transitionMs = 350;
			glyph = IDLE;
			schedule(900);
		}, 1150);
	}

	onMount(() => {
		wireWidth = el.parentElement!.clientWidth - 24;
		x = wireWidth * 0.4;
		schedule(1200);
	});
</script>

<div
	class="bird"
	bind:this={el}
	style:left="{x}px"
	style:bottom="{bottom}px"
	style:transform="scaleX({facing})"
	style:transition="left {transitionMs}ms ease, bottom {transitionMs}ms ease, transform 0.35s ease"
>
	{glyph}
</div>

<style>
	.bird {
		position: absolute;
		white-space: pre;
		font-size: 19px;
		font-weight: 700;
		line-height: 1;
		transform-origin: center bottom;
		user-select: none;
	}
</style>
