import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════
   Live 3D Configurator demo — a "VersaAI-generated"
   swivel chair. Drag to spin, swatches recolour it live.
   ═══════════════════════════════════════════════════════ */
export function initConfigurator(reducedMotion) {
  const canvas = document.getElementById('configurator');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 50);
  camera.position.set(0, 1.55, 4.6);
  camera.lookAt(0, 0.72, 0);

  /* — lights — */
  scene.add(new THREE.AmbientLight(0x8a9bff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 15;
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  scene.add(key);
  const rim = new THREE.PointLight(0x4de1ff, 12, 12);
  rim.position.set(-3, 2.2, -2.5);
  scene.add(rim);
  const accent = new THREE.PointLight(0x2d4dff, 8, 10);
  accent.position.set(2.5, 0.6, -2);
  scene.add(accent);

  /* — materials — */
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2d4dff, roughness: 0.72, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c2d8, roughness: 0.28, metalness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2036, roughness: 0.5, metalness: 0.6 });

  /* — chair group — */
  const chair = new THREE.Group();
  scene.add(chair);

  const addMesh = (geo, mat, parent = chair) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // 5-star base with casters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = addMesh(new THREE.BoxGeometry(0.68, 0.055, 0.09), dark);
    leg.position.set(Math.cos(a) * 0.34, 0.09, Math.sin(a) * 0.34);
    leg.rotation.order = 'YXZ';
    leg.rotation.y = -a;
    leg.rotation.z = 0.12; // legs slope gently down toward the casters
    const caster = addMesh(new THREE.SphereGeometry(0.055, 16, 16), dark);
    caster.position.set(Math.cos(a) * 0.66, 0.05, Math.sin(a) * 0.66);
  }

  // gas lift column
  const col1 = addMesh(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 20), metal);
  col1.position.y = 0.36;
  const col2 = addMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.16, 20), dark);
  col2.position.y = 0.16;

  // seat
  const seat = addMesh(new THREE.CylinderGeometry(0.46, 0.42, 0.15, 28), fabric);
  seat.position.y = 0.68;
  seat.scale.z = 0.94;
  const seatTrim = addMesh(new THREE.TorusGeometry(0.43, 0.028, 12, 40), dark);
  seatTrim.rotation.x = Math.PI / 2;
  seatTrim.position.y = 0.62;

  // backrest support
  const support = addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 14), metal);
  support.position.set(0, 0.92, -0.42);
  support.rotation.x = -0.22;

  // backrest cushion
  const back = addMesh(new THREE.CylinderGeometry(0.42, 0.38, 0.1, 28), fabric);
  back.position.set(0, 1.28, -0.5);
  back.rotation.x = Math.PI / 2 - 0.18;
  back.scale.z = 1.25; // taller pad

  // armrests
  for (const side of [-1, 1]) {
    const post = addMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.26, 12), dark);
    post.position.set(side * 0.44, 0.83, 0.02);
    const pad = addMesh(new THREE.CapsuleGeometry(0.045, 0.3, 6, 12), dark);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(side * 0.44, 0.97, 0.0);
  }

  /* — pedestal: glossy disc + glowing accent ring — */
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.42, 0.07, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0f22, roughness: 0.25, metalness: 0.75 })
  );
  disc.position.y = -0.045;
  disc.receiveShadow = true;
  scene.add(disc);

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.39, 0.018, 12, 90),
    new THREE.MeshBasicMaterial({ color: 0x2d4dff, transparent: true, opacity: 0.9 })
  );
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = -0.02;
  scene.add(glowRing);

  // soft radial glow under the disc
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(45,77,255,0.5)');
    grad.addColorStop(1, 'rgba(45,77,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false })
  );
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = -0.09;
  scene.add(glowPlane);

  /* — drag to rotate, with inertia — */
  const hint = document.getElementById('demoHint');
  let dragging = false;
  let lastX = 0;
  let velocity = 0;
  let idleTimer = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    hint?.classList.add('is-hidden');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    chair.rotation.y += dx * 0.012;
    velocity = dx * 0.012;
    idleTimer = 0;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* — colour swatches — */
  const targetColor = new THREE.Color(0x2d4dff);
  const swatches = document.querySelectorAll('#swatches .swatch');
  swatches.forEach((s) => s.addEventListener('click', () => {
    swatches.forEach((x) => x.classList.remove('is-active'));
    s.classList.add('is-active');
    targetColor.set(s.dataset.c);
  }));

  /* module tabs tint the accent ring */
  const ringTarget = new THREE.Color(0x2d4dff);
  window.addEventListener('ctruh:accent', (e) => ringTarget.set(e.detail));

  /* — resize to container (self-healing: 0×0 while hidden, real size later) — */
  const stage = canvas.parentElement;
  let lastW = 0, lastH = 0;
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  /* — render only while in view — */
  let visible = false;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) clock.getDelta(); // swallow the pause so dt stays sane
    if (visible && reducedMotion) renderer.render(scene, camera);
  }, { threshold: 0.05 }).observe(canvas);

  const clock = new THREE.Clock();
  function tick() {
    if (!visible && !document.hidden) return; // hidden: IO may not fire, render anyway
    resize();

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    if (!dragging) {
      chair.rotation.y += velocity;
      velocity *= 0.94;
      idleTimer += dt;
      if (idleTimer > 2.5) chair.rotation.y += dt * 0.35; // autorotate when idle
    }

    // breathe colors toward targets
    fabric.color.lerp(targetColor, 0.08);
    glowRing.material.color.lerp(ringTarget, 0.08);
    accent.color.lerp(ringTarget, 0.08);

    chair.position.y = Math.sin(t * 1.2) * 0.012; // subtle hover
    glowRing.material.opacity = 0.7 + Math.sin(t * 2) * 0.2;

    renderer.render(scene, camera);
  }

  if (!reducedMotion) {
    renderer.setAnimationLoop(tick);
    setInterval(() => { if (document.hidden) tick(); }, 400);
  }

  window.__ctruhConfig = { renderer, scene, camera, chair, fabric, tick }; // debug/testing hook
}
