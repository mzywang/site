<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	let container: HTMLDivElement;
	let disposed = false;

	const HALF_WIDTH = 9;
	const NEAR_Z = -3;
	const FAR_Z = 9;
	const SPEED = 3.2; // world units / sec
	const MODEL_SCALE = 0.022;
	const FORWARD_OFFSET = Math.PI / 2; // model's rest pose faces +Z, not +X

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);
		camera.position.set(0, 3.2, 15);
		camera.lookAt(0, 0.9, (NEAR_Z + FAR_Z) / 2);

		scene.add(new THREE.HemisphereLight(0xffffff, 0xdadada, 0.6));
		const key = new THREE.DirectionalLight(0xffffff, 2.0);
		key.position.set(4, 8, 6);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xffffff, 0.5);
		fill.position.set(-4, 2, 5);
		scene.add(fill);

		const renderer = new THREE.WebGLRenderer();
		renderer.setPixelRatio(1);
		renderer.setClearColor(0xffffff, 1);

		const effect = new AsciiEffect(renderer, ' .:-=+*#%@', {
			resolution: 0.3,
			invert: false
		});
		effect.domElement.style.color = 'var(--ink)';
		effect.domElement.style.background = 'transparent';
		// eslint-disable-next-line svelte/no-dom-manipulating -- container is an empty mount point for the AsciiEffect's own DOM output, not Svelte-managed content
		container.appendChild(effect.domElement);

		function resize() {
			const w = container.clientWidth;
			const h = container.clientHeight;
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			effect.setSize(w, h);
		}
		resize();
		window.addEventListener('resize', resize);

		let x = 0;
		let z = (NEAR_Z + FAR_Z) / 2;
		let heading = 0;
		let facingAngle = 0;
		let targetX = x;
		let targetZ = z;
		let moving = false;

		const TURN_RATE = Math.PI * 1.6; // max radians/sec

		function normalizeAngle(a: number) {
			a = a % (Math.PI * 2);
			if (a < -Math.PI) a += Math.PI * 2;
			if (a > Math.PI) a -= Math.PI * 2;
			return a;
		}

		function turnToward(target: number, maxDelta: number) {
			const diff = normalizeAngle(target - facingAngle);
			if (Math.abs(diff) <= maxDelta) {
				facingAngle = normalizeAngle(target);
			} else {
				facingAngle = normalizeAngle(facingAngle + Math.sign(diff) * maxDelta);
			}
		}

		function pickTarget() {
			targetX = (Math.random() * 2 - 1) * HALF_WIDTH;
			targetZ = NEAR_Z + Math.random() * (FAR_Z - NEAR_Z);
			const dx = targetX - x;
			const dz = targetZ - z;
			if (Math.hypot(dx, dz) < 0.5) {
				moving = false;
				setTimeout(pickTarget, 400);
				return;
			}
			heading = Math.atan2(dz, dx);
			moving = true;
		}

		let fox: THREE.Object3D | undefined;
		let mixer: THREE.AnimationMixer | undefined;
		let walkAction: THREE.AnimationAction | undefined;
		let idleAction: THREE.AnimationAction | undefined;
		let currentAction: THREE.AnimationAction | undefined;

		function setAction(next: THREE.AnimationAction | undefined) {
			if (!next || currentAction === next) return;
			next.reset().fadeIn(0.35).play();
			currentAction?.fadeOut(0.35);
			currentAction = next;
		}

		const loader = new GLTFLoader();
		loader.load('/models/fox.glb', (gltf) => {
			if (disposed) return;
			fox = gltf.scene;
			fox.scale.setScalar(MODEL_SCALE);
			scene.add(fox);

			mixer = new THREE.AnimationMixer(fox);
			const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk');
			const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Survey');
			walkAction = walkClip ? mixer.clipAction(walkClip) : undefined;
			idleAction = idleClip ? mixer.clipAction(idleClip) : undefined;
			if (idleAction) {
				currentAction = idleAction;
				idleAction.play();
			}

			setTimeout(pickTarget, 800);
		});

		let last = performance.now();
		let pauseUntil = 0;

		function tick(now: number) {
			if (disposed) return;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;

			if (fox) {
				if (moving) {
					const dx = targetX - x;
					const dz = targetZ - z;
					const dist = Math.hypot(dx, dz);
					const step = SPEED * dt;
					if (step >= dist) {
						x = targetX;
						z = targetZ;
						moving = false;
						pauseUntil = now + 600 + Math.random() * 2200;
					} else {
						x += (dx / dist) * step;
						z += (dz / dist) * step;
					}
				} else if (now > pauseUntil && pauseUntil > 0) {
					pauseUntil = 0;
					pickTarget();
				}

				turnToward(heading, TURN_RATE * dt);
				fox.position.set(x, 0, z);
				fox.rotation.y = -facingAngle + FORWARD_OFFSET;

				setAction(moving ? walkAction : idleAction);
				mixer?.update(dt);
			}

			effect.render(scene, camera);
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);

		onDestroy(() => {
			disposed = true;
			window.removeEventListener('resize', resize);
			renderer.dispose();
		});
	});
</script>

<div class="fox-stage" bind:this={container}></div>
<p class="credit">
	fox model: PixelMannen (CC0) · rig &amp; animation: tomkranis (CC BY 4.0) · glTF: AsoboStudio
	&amp; scurest (CC BY 4.0)
</p>

<style>
	.fox-stage {
		width: 100%;
		height: 100%;
	}

	.fox-stage :global(table) {
		margin: 0;
		border-collapse: collapse;
		font-family: ui-monospace, Menlo, Consolas, monospace;
		font-size: 6px;
		line-height: 6px;
	}

	.fox-stage :global(td) {
		padding: 0;
	}

	.credit {
		position: absolute;
		right: 0.5rem;
		bottom: 0.35rem;
		margin: 0;
		font-size: 0.6rem;
		color: var(--ink-dim);
		opacity: 0.6;
	}
</style>
