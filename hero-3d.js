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

  // center portrait — a real box with depth, not a flat plane. it sits at the
  // origin, so it always projects to the middle of the canvas
  const AVATAR_ASPECT = 311 / 414;
  const AVATAR_W = 2.4, AVATAR_H = 2.4 / AVATAR_ASPECT, AVATAR_D = 0.16;
  const avatar = new THREE.Mesh(
    new THREE.BoxGeometry(AVATAR_W, AVATAR_H, AVATAR_D),
    faceMaterials('assets/avatar-full-body.jpg', AVATAR_ASPECT, 0x111111)
  );
  scene.add(avatar);

  // project cards, smaller than the portrait so it stays the subject
  const PROJECTS = [
    'assets/screenshots/offtrail.jpg',
    'assets/screenshots/my-flix.jpg',
    'assets/screenshots/wellbeing.jpg',
    'assets/screenshots/job-tracker.jpg',
  ];
  const CARD_SCALE = 0.55;
  const CARD_W = AVATAR_W * CARD_SCALE, CARD_H = AVATAR_H * CARD_SCALE;
  const cardGeo = new THREE.BoxGeometry(CARD_W, CARD_H, 0.1);

  // the path is a semicircle, not a full orbit: a card leaves the canvas on one
  // side, arcs away behind the portrait, and comes back on the other. both ends
  // of the arc sit off-screen, so the wrap back to the start is never seen and
  // nothing has to be faded out to hide it
  const ARC = Math.PI;
  const ARC_SPEED = 0.26;  // rad/s
  const DEPTH = 1.9;       // how far behind the portrait the middle of the arc sits
  const BEHIND_MARGIN = AVATAR_D / 2 + 0.3; // arc ends still clear the portrait's back face
  let radiusX = 2;         // lateral reach, refit in layout() to the canvas width

  const cards = PROJECTS.map((url, i) => {
    const mesh = new THREE.Mesh(cardGeo, faceMaterials(url, AVATAR_ASPECT, 0xfdfdfd));
    // evenly spaced along the arc, so one enters as another leaves
    mesh.userData.angle = (i / PROJECTS.length) * ARC;
    scene.add(mesh);
    return mesh;
  });

  const FILL = 0.86; // portrait height as a share of the frame

  function layout() {
    // clientWidth, not getBoundingClientRect: .orbit carries the .reveal rotateX
    // transform at load, and a transformed rect reports the wrong size
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

    // pull the camera in until the portrait fills FILL of the frame height,
    // then reach the arc out as far as the remaining width allows
    const visibleH = AVATAR_H / FILL;
    const dist = visibleH / 2 / Math.tan(camera.fov * Math.PI / 360);
    camera.position.z = dist;
    // reach the arc a full card past each edge, undoing the perspective shrink
    // at the depth the ends sit at, so a card is fully gone before it wraps
    const shrink = dist / (dist + BEHIND_MARGIN);
    radiusX = (visibleH * camera.aspect / 2) / shrink + CARD_W;
  }
  layout();
  // observe the canvas, not the window: the stage is flex-sized, so it can
  // change without a resize event (mobile browser chrome sliding away, for one)
  // and a stale buffer stretches the render
  new ResizeObserver(layout).observe(canvas);

  let targetX = 0, targetY = 0, curX = 0, curY = 0;
  if (!reduceMotion) {
    wrap.addEventListener('pointermove', e => {
      const r = wrap.getBoundingClientRect();
      targetX = (e.clientX - r.left) / r.width - 0.5;
      targetY = (e.clientY - r.top) / r.height - 0.5;
    });
    wrap.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  }

  let last = performance.now();

  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    curX += (targetX - curX) * 0.05;
    curY += (targetY - curY) * 0.05;

    avatar.rotation.y = curX * 0.5 + Math.sin(now * 0.00015) * 0.08;
    avatar.rotation.x = -curY * 0.3;

    cards.forEach(card => {
      card.userData.angle = (card.userData.angle + ARC_SPEED * dt) % ARC;
      const a = card.userData.angle;
      // angle 0 is one side, ARC is the other, and the middle is straight
      // behind — z never turns positive, so a card cannot cross the face
      card.position.set(
        Math.cos(a) * radiusX,
        Math.sin(a) * 0.35,
        -Math.sin(a) * DEPTH - BEHIND_MARGIN,
      );
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
