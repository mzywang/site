<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	let container: HTMLDivElement;
	let disposed = false;

	const NEAR_Z = -4;
	const FAR_Z = 10;
	const MODEL_SCALE = 2.84;
	const ROOT_MOTION_SCALE = 0.03; // this rig's root-motion translation is authored in a much larger unit space than the mesh
	const FORWARD_OFFSET = Math.PI / 2;
	const EDGE_MARGIN = 0.98; // keep the model's own body width comfortably inside the frustum
	const ROAM_INSET = 0.5; // shrink random-walk targets inward so the fox never reaches the boundary line
	const CAMERA_FOV_DEG = 27; // a narrow fov + distant camera flattens the depth perspective
	const CAMERA_Z = 24;
	const CAMERA_Y = 3.6;
	const MAX_BLEND_ANGLE = Math.PI / 4; // steer blend range between straight Walk and WalkL/WalkR
	const TURN_RATE_PER_SEC = Math.PI / 4; // facing rotation rate at full steer

	const CLIP_NAMES = [
		'A3_Stand_Idle_01',
		'Loco_Walk',
		'WalkL',
		'WalkR',
		'Trans_Stand_to_Sitting',
		'Sitting_Idle_01',
		'Trans_Sitting_to_Stand',
		'Trans_Stand_to_Lying',
		'Lying_Idle_01',
		'Trans_Lying_to_Stand'
	] as const;
	type ClipName = (typeof CLIP_NAMES)[number];
	const LOCO_CLIPS = ['Loco_Walk', 'WalkL', 'WalkR'] as const;

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
		let moveElapsed = 0;

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

		let rootMotionNode: THREE.Object3D | undefined;
		const lastRootMotion = new THREE.Vector3();
		const rootRestQuat = new THREE.Quaternion();

		function extractRootMotionDelta() {
			if (!rootMotionNode) return { dx: 0, dz: 0 };
			const cur = rootMotionNode.position;
			let dx = cur.x - lastRootMotion.x;
			let dz = cur.z - lastRootMotion.z;
			if (dz < -0.01) {
				// the clip's own timeline looped back to its start - ignore the snap-back frame
				dx = 0;
				dz = 0;
			}
			lastRootMotion.set(cur.x, cur.y, cur.z);
			rootMotionNode.position.set(0, 0, 0);
			// WalkL/WalkR bake their own root rotation, which would fight with our own
			// facingAngle-driven rotation on the outer fox object - cancel it back to rest.
			rootMotionNode.quaternion.copy(rootRestQuat);
			return { dx, dz };
		}

		function setLocomotionWeights(steer: number) {
			const side = Math.abs(steer);
			actions['Loco_Walk']?.setEffectiveWeight(1 - side);
			actions['WalkL']?.setEffectiveWeight(steer > 0 ? side : 0);
			actions['WalkR']?.setEffectiveWeight(steer < 0 ? side : 0);
		}

		function startLocomotion() {
			lastRootMotion.set(0, 0, 0);
			rootMotionNode?.position.set(0, 0, 0);
			for (const name of LOCO_CLIPS) {
				const action = actions[name];
				if (!action) continue;
				action.reset();
				action.setLoop(THREE.LoopRepeat, Infinity);
				action.play();
			}
			setLocomotionWeights(0);
			currentAction?.fadeOut(0.25);
			currentAction = undefined;
		}

		function stopLocomotion() {
			for (const name of LOCO_CLIPS) {
				actions[name]?.fadeOut(0.25);
			}
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
			playOnce('Trans_Stand_to_Sitting', 0.3, () => {
				playLoop('Sitting_Idle_01', 0.2);
				setTimeout(
					() => {
						playOnce('Trans_Sitting_to_Stand', 0.3, () => {
							playLoop('A3_Stand_Idle_01', 0.2);
							scheduleRestDecision();
						});
					},
					3000 + Math.random() * 5000
				);
			});
		}

		function goLie() {
			playOnce('Trans_Stand_to_Lying', 0.3, () => {
				playLoop('Lying_Idle_01', 0.2);
				setTimeout(
					() => {
						playOnce('Trans_Lying_to_Stand', 0.3, () => {
							playLoop('A3_Stand_Idle_01', 0.2);
							scheduleRestDecision();
						});
					},
					12000 + Math.random() * 20000
				);
			});
		}

		function pickFreeRoamTarget(): { tx: number; tz: number } {
			const midZ = (NEAR_Z + FAR_Z) / 2;
			const halfDepth = (FAR_Z - NEAR_Z) / 2;
			const tx = (Math.random() * 2 - 1) * halfWidth * ROAM_INSET;
			const tz = midZ + (Math.random() * 2 - 1) * halfDepth * ROAM_INSET;
			return { tx, tz };
		}

		function beginWalk(explicitTarget?: { x: number; z: number }) {
			if (explicitTarget) {
				targetX = explicitTarget.x;
				targetZ = explicitTarget.z;
			} else {
				const MIN_WALK_DIST = 3; // avoid tiny walks that end before the Walk cycle really gets going
				let picked = pickFreeRoamTarget();
				let attempts = 0;
				while (Math.hypot(picked.tx - x, picked.tz - z) < MIN_WALK_DIST && attempts < 6) {
					picked = pickFreeRoamTarget();
					attempts++;
				}
				targetX = picked.tx;
				targetZ = picked.tz;
			}
			if (Math.hypot(targetX - x, targetZ - z) < 1.5) {
				scheduleRestDecision();
				return;
			}
			moving = true;
			moveElapsed = 0;
			startLocomotion();
		}

		function arrive() {
			moving = false;
			stopLocomotion();
			playLoop('A3_Stand_Idle_01', 0.25);
			scheduleRestDecision();
		}

		let headBone: THREE.Object3D | undefined;
		let tailBones: THREE.Object3D[] = [];
		let earBones: THREE.Object3D[] = [];
		const headRestQuat = new THREE.Quaternion();
		let tailRestQuats: THREE.Quaternion[] = [];
		let earRestQuats: THREE.Quaternion[] = [];

		let idleClock = 0;
		let nextHeadGlanceAt = 1.5 + Math.random() * 2;
		let headTargetYaw = 0;
		let headTargetPitch = 0;
		let headYaw = 0;
		let headPitch = 0;
		const earNextTwitchAt = [1 + Math.random() * 3, 1 + Math.random() * 3];
		const earTwitchProgress = [-1, -1];

		const TAIL_SWAY_SPEED = 2.2;
		const TAIL_SWAY_AMOUNT = THREE.MathUtils.degToRad(10);
		const EAR_TWITCH_DURATION = 0.3;
		const EAR_TWITCH_ANGLE = THREE.MathUtils.degToRad(18);
		const upAxis = new THREE.Vector3(0, 1, 0);
		const sideAxis = new THREE.Vector3(1, 0, 0);

		function applyIdleMotion(dt: number) {
			idleClock += dt;

			if (headBone) {
				if (idleClock > nextHeadGlanceAt) {
					headTargetYaw = (Math.random() * 2 - 1) * THREE.MathUtils.degToRad(22);
					headTargetPitch = (Math.random() * 2 - 1) * THREE.MathUtils.degToRad(10);
					nextHeadGlanceAt = idleClock + 2.5 + Math.random() * 4;
				}
				const ease = Math.min(1, dt * 2);
				headYaw += (headTargetYaw - headYaw) * ease;
				headPitch += (headTargetPitch - headPitch) * ease;
				headBone.quaternion
					.copy(headRestQuat)
					.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(headPitch, headYaw, 0)));
			}

			for (let i = 0; i < tailBones.length; i++) {
				const phase = idleClock * TAIL_SWAY_SPEED - i * 0.6;
				const angle = Math.sin(phase) * TAIL_SWAY_AMOUNT * (1 - i * 0.12);
				tailBones[i].quaternion
					.copy(tailRestQuats[i])
					.multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, angle));
			}

			for (let e = 0; e < earBones.length; e++) {
				if (earTwitchProgress[e] < 0 && idleClock > earNextTwitchAt[e]) {
					earTwitchProgress[e] = 0;
				}
				if (earTwitchProgress[e] >= 0) {
					earTwitchProgress[e] += dt / EAR_TWITCH_DURATION;
					const t = earTwitchProgress[e];
					const curve = t < 1 ? Math.sin(Math.min(t, 1) * Math.PI) : 0;
					earBones[e].quaternion
						.copy(earRestQuats[e])
						.multiply(new THREE.Quaternion().setFromAxisAngle(sideAxis, curve * EAR_TWITCH_ANGLE));
					if (t >= 1) {
						earTwitchProgress[e] = -1;
						earNextTwitchAt[e] = idleClock + 2 + Math.random() * 5;
					}
				} else {
					earBones[e].quaternion.copy(earRestQuats[e]);
				}
			}
		}

		const loader = new GLTFLoader();
		loader.load('/models/fox.glb', (gltf) => {
			if (disposed) return;
			fox = gltf.scene;
			fox.scale.setScalar(MODEL_SCALE);
			scene.add(fox);

			headBone = fox.getObjectByName('RigHead_020');
			tailBones = ['RigTail1_034', 'RigTail2_035', 'RigTail3_036', 'RigTail4_037', 'RigTail5_038']
				.map((name) => fox?.getObjectByName(name))
				.filter((b): b is THREE.Object3D => !!b);
			earBones = ['RigLEar1_025', 'RigREar1_027']
				.map((name) => fox?.getObjectByName(name))
				.filter((b): b is THREE.Object3D => !!b);
			rootMotionNode = fox.getObjectByName('RigRoot_01');

			if (headBone) headRestQuat.copy(headBone.quaternion);
			tailRestQuats = tailBones.map((b) => b.quaternion.clone());
			earRestQuats = earBones.map((b) => b.quaternion.clone());
			if (rootMotionNode) rootRestQuat.copy(rootMotionNode.quaternion);

			mixer = new THREE.AnimationMixer(fox);
			for (const name of CLIP_NAMES) {
				const clip = gltf.animations.find((a) => a.name === name);
				if (clip) actions[name] = mixer.clipAction(clip);
			}
			playLoop('A3_Stand_Idle_01', 0);
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
					// bearing-to-target steering is unstable once dx/dz get small (atan2 swings
					// toward +-90deg as the fox's position crosses the target's line) - freeze
					// heading correction for the final stretch and just finish straight instead
					// of chasing that unstable bearing into a spiral.
					let steer = 0;
					if (dist > 1.5) {
						const desiredHeading = Math.atan2(dz, dx);
						const angleErr = normalizeAngle(desiredHeading - facingAngle);
						steer = THREE.MathUtils.clamp(angleErr / MAX_BLEND_ANGLE, -1, 1);
						facingAngle = normalizeAngle(facingAngle + steer * TURN_RATE_PER_SEC * dt);
					}
					setLocomotionWeights(steer);
					moveElapsed += dt;
					if (dist < 0.6 || moveElapsed > 20) {
						arrive();
					}
				}

				fox.position.set(x, 0, z);
				fox.rotation.y = -facingAngle + FORWARD_OFFSET;

				mixer?.update(dt);

				const rootDelta = extractRootMotionDelta();
				if (rootDelta.dx !== 0 || rootDelta.dz !== 0) {
					const worldDelta = new THREE.Vector3(rootDelta.dx, 0, rootDelta.dz);
					worldDelta.applyAxisAngle(upAxis, -facingAngle + FORWARD_OFFSET);
					x += worldDelta.x * ROOT_MOTION_SCALE;
					z += worldDelta.z * ROOT_MOTION_SCALE;
				}

				applyIdleMotion(dt);
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
