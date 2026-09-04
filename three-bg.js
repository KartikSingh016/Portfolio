import * as THREE from 'three';

const canvas = document.getElementById('bg-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const COUNT = 600;
const positions = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 60;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({ color: 0x111111, size: 0.12, transparent: true, opacity: 0.35 });
const points = new THREE.Points(geometry, material);
scene.add(points);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let mouseX = 0, mouseY = 0, camX = 0, camY = 0;
if (!reduceMotion) {
  addEventListener('pointermove', e => {
    mouseX = e.clientX / innerWidth - 0.5;
    mouseY = e.clientY / innerHeight - 0.5;
  });
}

function animate() {
  requestAnimationFrame(animate);
  points.rotation.y += 0.0006;
  points.rotation.x += 0.0002;
  camX += (mouseX * 6 - camX) * 0.03;
  camY += (-mouseY * 6 - camY) * 0.03;
  camera.position.x = camX;
  camera.position.y = camY;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

if (reduceMotion) {
  renderer.render(scene, camera);
} else {
  animate();
}
