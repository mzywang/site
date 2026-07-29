<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	let container: HTMLDivElement;
	let disposed = false;

	const NEAR_Z = -4;
	const FAR_Z = 10;
	const MODEL_SCALE = 6.9;
	const SPEED = 0.61 * MODEL_SCALE; // world units / sec, calibrated to the Walk clip's stance-phase stride
	const FORWARD_OFFSET = Math.PI / 2;
	const EDGE_MARGIN = 0.98; // keep the model's own body width comfortably inside the frustum
	const ROAM_INSET = 0.72; // shrink random-walk targets inward so the fox never reaches the boundary line
	const CAMERA_FOV_DEG = 27; // a narrow fov + distant camera flattens the depth perspective
	const CAMERA_Z = 24;
	const CAMERA_Y = 3.6;

	const CLIP_NAMES = [
		'NeutralStand01',
		'Alert',
		'Walk',
		'WalkStart',
		'WalkStop',
		'TurnL90',
		'TurnR90',
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
		const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 2, 0.1, 60);
		camera.position.set(0, CAMERA_Y, CAMERA_Z);
		camera.lookAt(0, 1.6, (NEAR_Z + FAR_Z) / 2);

		let halfWidth = 9;
		function updateHalfWidth() {
			const closestDistance = camera.position.z - FAR_Z;
			const vFov = THREE.MathUtils.degToRad(camera.fov);
			const halfHeightAtDistance = Math.tan(vFov / 2) * closestDistance;
			halfWidth = halfHeightAtDistance * camera.aspect * EDGE_MARGIN;
		}

		let boundaryGroup: THREE.Group | undefined;
		const dashMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
		function addEdgeDashes(group: THREE.Group, x1: number, z1: number, x2: number, z2: number) {
			const dashLength = 0.35;
			const gap = 0.35;
			const step = dashLength + gap;
			const dx = x2 - x1;
			const dz = z2 - z1;
			const len = Math.hypot(dx, dz);
			const angle = Math.atan2(dz, dx);
			const count = Math.floor(len / step);
			for (let i = 0; i <= count; i++) {
				const t = i * step;
				if (t + dashLength > len) break;
				const cx = x1 + (dx / len) * (t + dashLength / 2);
				const cz = z1 + (dz / len) * (t + dashLength / 2);
				const dash = new THREE.Mesh(new THREE.BoxGeometry(dashLength, 0.05, 0.06), dashMaterial);
				dash.position.set(cx, 0.025, cz);
				dash.rotation.y = -angle;
				group.add(dash);
			}
		}
		function updateBoundary() {
			if (boundaryGroup) {
				scene.remove(boundaryGroup);
				for (const child of boundaryGroup.children) {
					if (child instanceof THREE.Mesh) child.geometry.dispose();
				}
			}
			const group = new THREE.Group();
			addEdgeDashes(group, -halfWidth, NEAR_Z, halfWidth, NEAR_Z);
			addEdgeDashes(group, halfWidth, NEAR_Z, halfWidth, FAR_Z);
			addEdgeDashes(group, halfWidth, FAR_Z, -halfWidth, FAR_Z);
			addEdgeDashes(group, -halfWidth, FAR_Z, -halfWidth, NEAR_Z);
			scene.add(group);
			boundaryGroup = group;
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
			updateBoundary();
		}
		resize();
		window.addEventListener('resize', resize);

		let x = 0;
		let z = (NEAR_Z + FAR_Z) / 2;
		let facingAngle = 0; // start facing screen-right
		let targetX = x;
		let targetZ = z;
		let moving = false;
		let busy = false;
		let turningTo: number | null = null;
		let onTurnComplete: (() => void) | null = null;
		let turnSegStart = 0;
		let turnSegTarget = 0;
		let turnSegElapsed = 0;
		let turnSegDuration = 0.5;

		const TURN_STEP = Math.PI / 2; // Fox_TurnL90 / Fox_TurnR90 each pivot exactly 90 degrees

		function normalizeAngle(a: number) {
			a = a % (Math.PI * 2);
			if (a < -Math.PI) a += Math.PI * 2;
			if (a > Math.PI) a -= Math.PI * 2;
			return a;
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
			if (currentAction && currentAction !== action) currentAction.fadeOut(fade);
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

		function startNextTurnSegment() {
			if (turningTo === null) return;
			const remaining = normalizeAngle(turningTo - facingAngle);
			if (Math.abs(remaining) < 0.05) {
				facingAngle = turningTo;
				turningTo = null;
				const done = onTurnComplete;
				onTurnComplete = null;
				done?.();
				return;
			}
			const dir = Math.sign(remaining);
			const step = Math.min(Math.abs(remaining), TURN_STEP);
			turnSegStart = facingAngle;
			turnSegTarget = facingAngle + dir * step;
			turnSegElapsed = 0;
			const clipName: ClipName = dir > 0 ? 'TurnR90' : 'TurnL90';
			const action = actions[clipName];
			turnSegDuration = action ? action.getClip().duration : 0.5;
			playOnce(clipName, 0.2, () => {
				facingAngle = normalizeAngle(turnSegTarget);
				startNextTurnSegment();
			});
		}

		function turnTo(target: number, onComplete?: () => void) {
			turningTo = target;
			onTurnComplete = onComplete ?? null;
			startNextTurnSegment();
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

		function pickFreeRoamTarget(): { angle: number; tx: number; tz: number } {
			const midZ = (NEAR_Z + FAR_Z) / 2;
			const halfDepth = (FAR_Z - NEAR_Z) / 2;
			const tx = (Math.random() * 2 - 1) * halfWidth * ROAM_INSET;
			const tz = midZ + (Math.random() * 2 - 1) * halfDepth * ROAM_INSET;
			return { angle: Math.atan2(tz - z, tx - x), tx, tz };
		}

		function beginWalk(explicitTarget?: { x: number; z: number }) {
			let angle: number;
			if (explicitTarget) {
				targetX = explicitTarget.x;
				targetZ = explicitTarget.z;
				angle = Math.atan2(targetZ - z, targetX - x);
			} else {
				const picked = pickFreeRoamTarget();
				targetX = picked.tx;
				targetZ = picked.tz;
				angle = picked.angle;
			}
			if (Math.hypot(targetX - x, targetZ - z) < 0.5) {
				scheduleRestDecision();
				return;
			}
			const startWalking = () => {
				moving = true;
				playOnce('WalkStart', 0.25, () => {
					if (moving) playLoop('Walk', 0.2);
				});
			};
			if (Math.abs(normalizeAngle(angle - facingAngle)) > 0.05) {
				turnTo(angle, startWalking);
			} else {
				startWalking();
			}
		}

		function arrive() {
			moving = false;
			playOnce('WalkStop', 0.25, () => {
				playLoop('NeutralStand01', 0.2);
				scheduleRestDecision();
			});
		}

		function greetVisitor() {
			playOnce('Alert', 0.3, () => {
				turnTo(Math.PI / 2, () => {
					beginWalk({ x: 0, z: FAR_Z - 1.5 });
				});
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

			setTimeout(greetVisitor, 2000 + Math.random() * 1500);
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
						const step = Math.min(SPEED * dt, dist);
						x += Math.cos(facingAngle) * step;
						z += Math.sin(facingAngle) * step;
					}
				} else if (turningTo !== null) {
					turnSegElapsed = Math.min(turnSegDuration, turnSegElapsed + dt);
					const t = turnSegDuration > 0 ? turnSegElapsed / turnSegDuration : 1;
					facingAngle = normalizeAngle(turnSegStart + (turnSegTarget - turnSegStart) * t);
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
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.fox-stage :global(table) {
		margin: 0;
		border-collapse: collapse;
		font-family: ui-monospace, Menlo, Consolas, monospace !important;
	}

	.fox-stage :global(td) {
		padding: 0;
		text-align: center;
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
