<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';

	let container: HTMLDivElement;
	let disposed = false;

	const HALF_WIDTH = 9;
	const NEAR_Z = -3;
	const FAR_Z = 9;
	const SPEED = 3.2; // world units / sec

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);
		camera.position.set(0, 3.2, 15);
		camera.lookAt(0, 0.9, (NEAR_Z + FAR_Z) / 2);

		scene.add(new THREE.AmbientLight(0xffffff, 0.2));
		const key = new THREE.DirectionalLight(0xffffff, 2.2);
		key.position.set(4, 8, 6);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0xffffff, 0.5);
		rim.position.set(-5, 3, -4);
		scene.add(rim);

		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });

		const dog = new THREE.Group();

		const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.5, 8, 16), mat);
		body.rotation.z = Math.PI / 2;
		body.position.set(0, 1.05, 0);
		dog.add(body);

		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.55, 16), mat);
		neck.position.set(1.1, 1.55, 0);
		neck.rotation.z = -0.6;
		dog.add(neck);

		const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), mat);
		head.position.set(1.55, 1.95, 0);
		dog.add(head);

		const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32), mat);
		snout.position.set(1.95, 1.85, 0);
		dog.add(snout);

		for (const side of [1, -1]) {
			const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 12), mat);
			ear.position.set(1.6, 2.28, side * 0.2);
			ear.rotation.x = side * 0.3;
			ear.rotation.z = 0.25;
			dog.add(ear);
		}

		const tailBase = new THREE.Group();
		tailBase.position.set(-1.15, 1.3, 0);
		const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 12), mat);
		tail.position.set(0, 0.4, 0);
		tail.rotation.z = 0.5;
		tailBase.add(tail);
		dog.add(tailBase);

		const legDefs = [
			{ name: 'fl', x: 0.85, z: 0.35 },
			{ name: 'fr', x: 0.85, z: -0.35 },
			{ name: 'bl', x: -0.85, z: 0.35 },
			{ name: 'br', x: -0.85, z: -0.35 }
		];
		const legPivots: Record<string, THREE.Group> = {};
		for (const def of legDefs) {
			const pivot = new THREE.Group();
			pivot.position.set(def.x, 1.05, def.z);
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 1.0, 12), mat);
			leg.position.set(0, -0.5, 0);
			pivot.add(leg);
			dog.add(pivot);
			legPivots[def.name] = pivot;
		}

		dog.scale.setScalar(1.7);
		scene.add(dog);

		const renderer = new THREE.WebGLRenderer();
		renderer.setPixelRatio(1);
		renderer.setClearColor(0xffffff, 1);

		const effect = new AsciiEffect(renderer, ' .:-=+*#%@', {
			resolution: 0.28,
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
		let walkPhase = 0;

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

		setTimeout(pickTarget, 800);

		let last = performance.now();
		let pauseUntil = 0;

		function tick(now: number) {
			if (disposed) return;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;

			if (moving) {
				const dx = targetX - x;
				const dz = targetZ - z;
				const dist = Math.hypot(dx, dz);
				const step = SPEED * dt;
				if (step >= dist) {
					x = targetX;
					z = targetZ;
					moving = false;
					walkPhase = 0;
					pauseUntil = now + 600 + Math.random() * 2200;
				} else {
					x += (dx / dist) * step;
					z += (dz / dist) * step;
					walkPhase += dt * 9;
				}
			} else if (now > pauseUntil && pauseUntil > 0) {
				pauseUntil = 0;
				pickTarget();
			}

			turnToward(heading, TURN_RATE * dt);
			dog.position.set(x, 0, z);
			dog.rotation.y = -facingAngle;

			const swing = moving ? Math.sin(walkPhase) * 0.5 : 0;
			legPivots.fl.rotation.x = swing;
			legPivots.br.rotation.x = swing;
			legPivots.fr.rotation.x = -swing;
			legPivots.bl.rotation.x = -swing;

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

<div class="dog-stage" bind:this={container}></div>

<style>
	.dog-stage {
		width: 100%;
		height: 100%;
	}

	.dog-stage :global(table) {
		margin: 0;
		border-collapse: collapse;
		font-family: ui-monospace, Menlo, Consolas, monospace;
		font-size: 6px;
		line-height: 6px;
	}

	.dog-stage :global(td) {
		padding: 0;
	}
</style>
