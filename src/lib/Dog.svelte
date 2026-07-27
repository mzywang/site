<script lang="ts">
	import { onMount } from 'svelte';

	const FRAME_A =
		'                           .-.\n   .=:                   .+%@#-\n   :%@=                 .#@@@@@-\n    :%@*.               :@@@@@@%=:\n     .#@#:             :*@@@@@@%+:\n      .#@=  .:--=--:..+@@@@@@@@=\n       .--+#%@@@@@@@%%@@@@@@%#=\n       .+@@@@@@@@@@@@@@@@@@+..\n       -@@@@@@@@@@@@@@@@@@@=\n        +@@@@@@@@@@@@@@%#*+:\n        --+%@@@@@@@@@#+=:\n       +@. ##::---:*@: *#\n      =@=  -@=    -@=  :@=\n      =+    +=    =+    +=';
	const FRAME_B =
		'                           .-.\n   .=:                   .+%@#-\n   :%@=                 .#@@@@@-\n    :%@*.               :@@@@@@%=:\n     .#@#:             :*@@@@@@%+:\n      .#@=  .:--=--:..+@@@@@@@@=\n       .--+#%@@@@@@@%%@@@@@@%#=\n       .+@@@@@@@@@@@@@@@@@@+..\n       -@@@@@@@@@@@@@@@@@@@=\n       .+%@@@@@@@@@@@@@%#*+:\n        :+*@%@@@@@@@@%*+.\n        =%##.::---:.=%##.\n        .%@-         #@=\n        .+#:         +#:';

	const MIN_SCALE = 0.55;
	const MAX_SCALE = 1.3;
	const BASE_SPEED = 90; // px/sec at scale 1

	let x = $state(0);
	let y = $state(0);
	let scale = $state(1);
	let facing = $state(1);
	let frame = $state(FRAME_A);
	let transitionMs = $state(0);

	let el: HTMLDivElement;
	let areaW = 0;
	let areaH = 0;
	let walkTimer: ReturnType<typeof setInterval> | undefined;

	function depthFor(newY: number) {
		return MIN_SCALE + (newY / areaH) * (MAX_SCALE - MIN_SCALE);
	}

	function stopWalking() {
		if (walkTimer) clearInterval(walkTimer);
		walkTimer = undefined;
	}

	function walkTo(tx: number, ty: number) {
		const dx = tx - x;
		const dy = ty - y;
		const dist = Math.hypot(dx, dy);
		if (dist < 1) {
			schedule();
			return;
		}
		facing = dx < 0 ? -1 : 1;
		const targetScale = depthFor(ty);
		const avgScale = (scale + targetScale) / 2;
		const durationSec = dist / (BASE_SPEED * avgScale);
		transitionMs = durationSec * 1000;

		let toggled = false;
		stopWalking();
		walkTimer = setInterval(() => {
			toggled = !toggled;
			frame = toggled ? FRAME_B : FRAME_A;
		}, 220);

		x = tx;
		y = ty;
		scale = targetScale;

		setTimeout(
			() => {
				stopWalking();
				frame = FRAME_A;
				schedule(600 + Math.random() * 2200);
			},
			Math.max(1, transitionMs)
		);
	}

	function schedule(delay = 800) {
		setTimeout(() => {
			const tx = Math.random() * (areaW - 1);
			const ty = Math.random() * (areaH - 1);
			transitionMs = 0;
			walkTo(tx, ty);
		}, delay);
	}

	onMount(() => {
		areaW = el.parentElement!.clientWidth - el.offsetWidth;
		areaH = el.parentElement!.clientHeight - el.offsetHeight;
		x = areaW * 0.5;
		y = areaH * 0.6;
		scale = depthFor(y);
		schedule(1000);
	});
</script>

<div
	class="dog"
	bind:this={el}
	style:left="{x}px"
	style:top="{y}px"
	style:transform="scaleX({facing * scale}) scaleY({scale})"
	style:transition="left {transitionMs}ms linear, top {transitionMs}ms linear, transform 300ms ease"
	style:z-index={Math.round(scale * 100)}
>
	{frame}
</div>

<style>
	.dog {
		position: absolute;
		white-space: pre;
		font-size: 9px;
		line-height: 1;
		transform-origin: center bottom;
		user-select: none;
	}
</style>
