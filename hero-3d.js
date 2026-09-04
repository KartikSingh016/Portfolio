import * as THREE from 'three';

const canvas = document.getElementById('hero-3d');
// the canvas is sized by CSS, so measure it directly and use it as the pointer target
const wrap = canvas;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// crop a texture to a target box aspect like CSS object-fit:cover
function coverUV(tex, boxAspect) {
  const imgAspect = tex.image.width / tex.image.height;
  if (imgAspect > boxAspect) {
    tex.repeat.set(boxAspect / imgAspect, 1);
    tex.offset.set((1 - boxAspect / imgAspect) / 2, 0);
  } else {
    tex.repeat.set(1, imgAspect / boxAspect);
    tex.offset.set(0, (1 - imgAspect / boxAspect) / 2);
  }
}

// tint multiplies the texture — used to sit bright screenshots down into the dark page
function faceMaterials(url, boxAspect, edgeColor, tint = 0xffffff) {
  const edge = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.85, metalness: 0.05 });
  const tex = new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    coverUV(t, boxAspect);
  });
  const front = new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.7, metalness: 0.05 });
  // BoxGeometry face order: +x -x +y -y +z -z — photo goes on the +z (front) face
  return [edge, edge, edge, edge, front, edge];
}

try {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe11d2e, 0.45);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // center portrait — a real box with depth, not a flat plane
  const AVATAR_ASPECT = 311 / 414;
  const AVATAR_W = 2.4, AVATAR_H = 2.4 / AVATAR_ASPECT, AVATAR_D = 0.16;
  const avatar = new THREE.Mesh(
    new THREE.BoxGeometry(AVATAR_W, AVATAR_H, AVATAR_D),
    faceMaterials('assets/avatar-full-body.jpg', AVATAR_ASPECT, 0x1c1c1c)
  );
  scene.add(avatar);

  // orbiting project cards — same length + width as the avatar model itself
  const PROJECTS = [
    'assets/screenshots/offtrail.jpg',
    'assets/screenshots/my-flix.jpg',
    'assets/screenshots/wellbeing.jpg',
    'assets/screenshots/job-tracker.jpg',
  ];
  const cardGeo = new THREE.BoxGeometry(AVATAR_W, AVATAR_H, 0.12);
  const RADIUS_X = 3.3;   // lateral swing — clears the avatar's sides
  const RADIUS_Z = 1.4;   // depth swing, entirely behind the avatar
  const BEHIND_MARGIN = AVATAR_D / 2 + 0.3; // keeps every point strictly behind the avatar's back face
  const cards = PROJECTS.map((url, i) => {
    const mesh = new THREE.Mesh(cardGeo, faceMaterials(url, AVATAR_ASPECT, 0x141414, 0x8f8f8f));
    mesh.userData.angle = (i / PROJECTS.length) * Math.PI * 2;
    scene.add(mesh);
    return mesh;
  });

  function layout() {
    const { width: w, height: h } = wrap.getBoundingClientRect();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  layout();
  addEventListener('resize', layout);

  let targetX = 0, targetY = 0, curX = 0, curY = 0;
  if (!reduceMotion) {
    wrap.addEventListener('pointermove', e => {
      const r = wrap.getBoundingClientRect();
      targetX = (e.clientX - r.left) / r.width - 0.5;
      targetY = (e.clientY - r.top) / r.height - 0.5;
    });
    wrap.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  }

  const ORBIT_SPEED = 0.18; // rad/s
  let last = performance.now();

  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    curX += (targetX - curX) * 0.05;
    curY += (targetY - curY) * 0.05;

    avatar.rotation.y = curX * 0.5 + Math.sin(now * 0.00015) * 0.08;
    avatar.rotation.x = -curY * 0.3;

    cards.forEach((card, i) => {
      card.userData.angle += ORBIT_SPEED * dt;
      const a = card.userData.angle;
      // z stays negative always: cards revolve left-right-behind but never come
      // closer to the camera than the avatar's back face, so they never cover it
      const z = (Math.cos(a) - 1) * RADIUS_Z - BEHIND_MARGIN;
      card.position.set(Math.sin(a) * RADIUS_X, Math.sin(a * 0.6 + i) * 0.35, z);
      card.lookAt(camera.position);
    });

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(render);
  }

  if (reduceMotion) {
    render(performance.now());
  } else {
    requestAnimationFrame(render);
  }
} catch (err) {
  console.warn('3D hero unavailable, falling back to a static portrait.', err);
  const img = document.createElement('img');
  img.src = 'assets/avatar-full-body.jpg';
  img.alt = 'Kartik Singh';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
  canvas.replaceWith(img);
}
