import * as THREE from 'three';

const canvas = document.getElementById('hero-3d');
const wrap = canvas.closest('.orbit');
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

function faceMaterials(url, boxAspect, edgeColor) {
  const edge = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.85, metalness: 0.05 });
  const tex = new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    coverUV(t, boxAspect);
  });
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.05 });
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe11d2e, 0.5);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // center portrait — a real box with depth, not a flat plane
  const AVATAR_ASPECT = 311 / 414;
  const AVATAR_W = 2.4, AVATAR_H = 2.4 / AVATAR_ASPECT, AVATAR_D = 0.16;
  const avatar = new THREE.Mesh(
    new THREE.BoxGeometry(AVATAR_W, AVATAR_H, AVATAR_D),
    faceMaterials('assets/avatar-full-body.jpg', AVATAR_ASPECT, 0x111111)
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
    const mesh = new THREE.Mesh(cardGeo, faceMaterials(url, AVATAR_ASPECT, 0xfdfdfd));
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
  canvas.style.display = 'none';
  wrap.style.background = "url('assets/avatar-full-body.jpg') center / cover";
  wrap.style.borderRadius = '18px';
}
