import * as THREE from 'three';
import { initConfigurator } from './configurator.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ?capture — static render mode for snapshot tests: no reveal animations, natural hero height
if (new URLSearchParams(location.search).has('capture')) {
  document.documentElement.classList.add('capture');
}

/* ═══════════════════════════════════════════════
   Ambient hero scene — fresnel core, rings, stars
   ═══════════════════════════════════════════════ */
function initHeroScene() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060f, 0.055);

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
  camera.position.set(0, 0.2, 8.5);

  /* — central hero object: icosahedron with fresnel gradient — */
  const heroGroup = new THREE.Group();
  scene.add(heroGroup);

  const fresnelUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uColorA: { value: new THREE.Color(0x16307f) },   // deep blue body
    uColorB: { value: new THREE.Color(0x3d5dff) },   // brand blue rim
    uColorC: { value: new THREE.Color(0x6fe8ff) },   // cyan hot edge
  };

  const fresnelMat = new THREE.ShaderMaterial({
    uniforms: fresnelUniforms,
    transparent: true,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 p = position;
        // gentle breathing along normals
        p += normal * 0.06 * sin(uTime * 0.8 + position.y * 2.2 + position.x * 1.7);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.0);
        vec3 col = mix(uColorA, uColorB, fres);
        col = mix(col, uColorC, pow(fres, 3.0));
        col += uColorB * 0.18 * (0.5 + 0.5 * vNormal.y);
        gl_FragColor = vec4(col, uOpacity * (0.8 + 0.2 * fres));
      }`,
  });

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 4), fresnelMat);
  heroGroup.add(core);

  // additive halo behind the core so it reads even on dark displays
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x2d4dff, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 32), haloMat);
  heroGroup.add(halo);

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x4de1ff, wireframe: true, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.92, 1), wireMat);
  heroGroup.add(shell);

  /* — orbit rings — */
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x5d7bff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.016, 8, 140), ringMat);
  ring1.rotation.x = Math.PI / 2.25;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.011, 8, 140), ringMat.clone());
  ring2.material.opacity = 0.3;
  ring2.rotation.x = Math.PI / 1.85;
  ring2.rotation.y = 0.5;
  heroGroup.add(ring1, ring2);

  /* — orbiting satellites — */
  const satGeo = new THREE.OctahedronGeometry(0.09, 0);
  const satMat = new THREE.MeshBasicMaterial({ color: 0x4de1ff, transparent: true, opacity: 0.9 });
  const sats = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(satGeo, satMat.clone());
    s.userData = { r: 2.7 + i * 0.28, speed: 0.25 + i * 0.11, phase: i * 2.1, tilt: i * 0.6 };
    heroGroup.add(s);
    sats.push(s);
  }

  /* — particle field (whole-page ambience) — */
  const starCount = 900;
  const pos = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 42;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
    sizes[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSize;
      uniform float uTime;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * (0.6 + aSize) + aSize * 40.0);
        vA = tw * smoothstep(-24.0, -2.0, mv.z);
        gl_PointSize = min((1.8 + aSize * 3.4) * tw * (140.0 / -mv.z), 9.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d) * vA;
        gl_FragColor = vec4(0.62, 0.75, 1.0, a * 0.95);
      }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* — pointer parallax + scroll choreography — */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
    mouse.ty = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
  }, { passive: true });

  let scrollP = 0; // 0 at top → 1 after one viewport
  const onScroll = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight || 720;
    scrollP = Math.min(window.scrollY / vh, 1.6);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* size from the canvas's CSS box (never inline styles) and self-heal:
     a load in a hidden/background tab can report 0×0 until first shown */
  let lastW = 0, lastH = 0;
  function ensureSize() {
    const w = canvas.clientWidth || window.innerWidth || document.documentElement.clientWidth || 1280;
    const h = canvas.clientHeight || window.innerHeight || document.documentElement.clientHeight || 720;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  ensureSize();
  window.addEventListener('resize', ensureSize);

  const clock = new THREE.Clock();

  function tick() {
    ensureSize();
    const t = clock.getElapsedTime();

    fresnelUniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;

    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;

    core.rotation.y = t * 0.14 + mouse.x * 0.3;
    core.rotation.x = Math.sin(t * 0.1) * 0.12 + mouse.y * 0.2;
    shell.rotation.y = -t * 0.06;
    shell.rotation.z = t * 0.04;
    ring1.rotation.z = t * 0.1;
    ring2.rotation.z = -t * 0.07;

    for (const s of sats) {
      const { r, speed, phase, tilt } = s.userData;
      const a = t * speed + phase;
      s.position.set(Math.cos(a) * r, Math.sin(a) * r * Math.sin(tilt) * 0.4, Math.sin(a) * r * 0.5);
      s.rotation.y = a * 2;
    }

    // scroll: hero object recedes and dims, stars drift
    const p = Math.min(scrollP, 1);
    heroGroup.position.y = 0.15 + p * 2.4;
    heroGroup.position.z = -p * 4.5;
    heroGroup.rotation.y = p * 0.9;
    const fade = 1 - THREE.MathUtils.smoothstep(p, 0.15, 0.85);
    fresnelUniforms.uOpacity.value = fade;
    haloMat.opacity = 0.16 * fade;
    wireMat.opacity = 0.16 * fade;
    ring1.material.opacity = 0.55 * fade;
    ring2.material.opacity = 0.3 * fade;
    for (const s of sats) s.material.opacity = 0.9 * fade;

    stars.rotation.y = t * 0.008 + scrollP * 0.18;
    stars.position.y = -scrollP * 1.4;

    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.03;
    camera.position.y += (0.2 - mouse.y * 0.35 - camera.position.y) * 0.03;
    camera.lookAt(0, 0.1, 0);

    renderer.render(scene, camera);
  }

  if (reducedMotion) {
    tick(); // single static frame
    window.addEventListener('resize', tick);
  } else {
    renderer.setAnimationLoop(tick); // pauses cleanly when the tab is hidden
    // keep frames coming for previews/background tabs where rAF is suspended
    setInterval(() => { if (document.hidden) tick(); }, 400);
  }

  window.__ctruhHero = { renderer, scene, camera, tick }; // debug/testing hook
}

/* ═══════════════════════════════════════════════
   UI wiring
   ═══════════════════════════════════════════════ */
function initUI() {
  /* nav scrolled state */
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }, { passive: true });

  /* mobile menu */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobileMenu');
  const closeMenu = () => { menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', closeMenu));

  /* reveal on scroll */
  if (!reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }

  /* animated counters */
  const counterIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      counterIO.unobserve(e.target);
      const target = +e.target.dataset.count;
      const dur = 1400;
      const start = performance.now();
      const step = (now) => {
        const k = Math.min((now - start) / dur, 1);
        e.target.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => counterIO.observe(el));

  /* studio module tabs */
  const modules = document.querySelectorAll('.module');
  modules.forEach((m) => m.addEventListener('click', () => {
    modules.forEach((x) => x.classList.remove('is-active'));
    m.classList.add('is-active');
    // tint the configurator accent to match the selected module
    window.dispatchEvent(new CustomEvent('ctruh:accent', { detail: m.dataset.color }));
  }));

  /* demo modal */
  const modal = document.getElementById('demoModal');
  const formWrap = document.getElementById('demoFormWrap');
  const success = document.getElementById('demoSuccess');
  const form = document.getElementById('demoForm');

  const openModal = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    formWrap.hidden = false;
    success.hidden = true;
    setTimeout(() => form.querySelector('input')?.focus(), 60);
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', openModal));
  modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll('input[required]').forEach((inp) => {
      const bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value));
      inp.classList.toggle('is-error', bad);
      if (bad) ok = false;
    });
    if (!ok) return;
    // NOTE: wire this to your CRM / lead endpoint (e.g. HubSpot, Slack webhook)
    formWrap.hidden = true;
    success.hidden = false;
  });
}

initUI();
initHeroScene();
initConfigurator(reducedMotion);
