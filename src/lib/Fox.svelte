<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	let container: HTMLDivElement;
	let disposed = false;

	const NEAR_Z = -3;
	const FAR_Z = 9;
	const SPEED = 3.2; // world units / sec
	const MODEL_SCALE = 1.7;
	const FORWARD_OFFSET = Math.PI / 2;
	const EDGE_MARGIN = 0.82; // keep the model's own body width comfortably inside the frustum

	const CLIP_NAMES = [
		'NeutralStand01',
		'Walk',
		'WalkStart',
		'WalkStop',
		'Sitting01',
		'StandToSitting',
		'SittingToStand',
		'Lying01',
		'StandToLying',
		'LyingToStand'
	] as const;
	type ClipName = (typeof CLIP_NAMES)[number];

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);
		camera.position.set(0, 3.2, 15);
		camera.lookAt(0, 0.9, (NEAR_Z + FAR_Z) / 2);

		let halfWidth = 9;
		function updateHalfWidth() {
			const closestDistance = camera.position.z - FAR_Z;
			const vFov = THREE.MathUtils.degToRad(camera.fov);
			const halfHeightAtDistance = Math.tan(vFov / 2) * closestDistance;
			halfWidth = halfHeightAtDistance * camera.aspect * EDGE_MARGIN;
		}

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
			updateHalfWidth();
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
		let busy = false;

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

		let fox: THREE.Object3D | undefined;
		let mixer: THREE.AnimationMixer | undefined;
		let currentAction: THREE.AnimationAction | undefined;
		const actions: Partial<Record<ClipName, THREE.AnimationAction>> = {};

		function playLoop(name: ClipName, fade = 0.3) {
			const action = actions[name];
			if (!action || currentAction === action) return;
			action.reset();
			action.setLoop(THREE.LoopRepeat, Infinity);
			action.fadeIn(fade).play();
			currentAction?.fadeOut(fade);
			currentAction = action;
		}

		function playOnce(name: ClipName, fade: number, onDone: () => void) {
			const action = actions[name];
			if (!action || !mixer) {
				onDone();
				return;
			}
			busy = true;
			action.reset();
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
			action.fadeIn(fade).play();
			currentAction?.fadeOut(fade);
			currentAction = action;
			const mixerRef = mixer;
			const handler = (e: { action: THREE.AnimationAction }) => {
				if (e.action !== action) return;
				mixerRef.removeEventListener('finished', handler);
				busy = false;
				onDone();
			};
			mixerRef.addEventListener('finished', handler);
		}

		function scheduleRestDecision() {
			setTimeout(decideNext, 4000 + Math.random() * 7000);
		}

		function decideNext() {
			if (moving || busy) return;
			const r = Math.random();
			if (r < 0.45) {
				beginWalk();
			} else if (r < 0.75) {
				goSit();
			} else {
				goLie();
			}
		}

		function goSit() {
			playOnce('StandToSitting', 0.3, () => {
				playLoop('Sitting01', 0.2);
				setTimeout(
					() => {
						playOnce('SittingToStand', 0.3, () => {
							playLoop('NeutralStand01', 0.2);
							scheduleRestDecision();
						});
					},
					3000 + Math.random() * 5000
				);
			});
		}

		function goLie() {
			playOnce('StandToLying', 0.3, () => {
				playLoop('Lying01', 0.2);
				setTimeout(
					() => {
						playOnce('LyingToStand', 0.3, () => {
							playLoop('NeutralStand01', 0.2);
							scheduleRestDecision();
						});
					},
					5000 + Math.random() * 8000
				);
			});
		}

		function beginWalk() {
			targetX = (Math.random() * 2 - 1) * halfWidth;
			targetZ = NEAR_Z + Math.random() * (FAR_Z - NEAR_Z);
			if (Math.hypot(targetX - x, targetZ - z) < 0.5) {
				scheduleRestDecision();
				return;
			}
			moving = true;
			playOnce('WalkStart', 0.25, () => {
				if (moving) playLoop('Walk', 0.2);
			});
		}

		function arrive() {
			moving = false;
			playOnce('WalkStop', 0.25, () => {
				playLoop('NeutralStand01', 0.2);
				scheduleRestDecision();
			});
		}

		const loader = new GLTFLoader();
		loader.load('/models/fox.glb', (gltf) => {
			if (disposed) return;
			fox = gltf.scene;
			fox.scale.setScalar(MODEL_SCALE);
			scene.add(fox);

			mixer = new THREE.AnimationMixer(fox);
			for (const name of CLIP_NAMES) {
				const clip = gltf.animations.find((a) => a.name.endsWith('|Fox_' + name));
				if (clip) actions[name] = mixer.clipAction(clip);
			}
			playLoop('NeutralStand01', 0);
			currentAction?.play();

			setTimeout(scheduleRestDecision, 1000);
		});

		let last = performance.now();

		function tick(now: number) {
			if (disposed) return;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;

			if (fox) {
				if (moving) {
					const dx = targetX - x;
					const dz = targetZ - z;
					const dist = Math.hypot(dx, dz);
					if (dist < 0.15) {
						x = targetX;
						z = targetZ;
						arrive();
					} else {
						heading = Math.atan2(dz, dx);
						turnToward(heading, TURN_RATE * dt);
						const angleDiff = Math.abs(normalizeAngle(heading - facingAngle));
						const alignment = Math.max(0, Math.cos(angleDiff));
						const step = Math.min(SPEED * dt * alignment, dist);
						x += Math.cos(facingAngle) * step;
						z += Math.sin(facingAngle) * step;
					}
				}

				fox.position.set(x, 0, z);
				fox.rotation.y = -facingAngle + FORWARD_OFFSET;

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
<p class="credit">fox model &amp; animation: AnimalMesh 3D (CC BY 4.0)</p>

<style>
	.fox-stage {
		width: 100%;
		height: 100%;
	}

	.fox-stage :global(table) {
		margin: 0;
		border-collapse: collapse;
		font-family: ui-monospace, Menlo, Consolas, monospace !important;
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
