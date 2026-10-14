import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CONFIG, CREDIT_TEXT } from './config.js';

// ===========================================================================
// The monitor screen: a real HTML page (CSS3DObject) locked to the display
// quad. The world matrix is built from the 4 quad corners with makeBasis
// (right/up/normal), so it is never derived from lookAt() or a normal-only
// rotation. A matching depth-only plane ("hole") is written into the WebGL
// scene: the DOM layer sits BENEATH the transparent WebGL canvas, the hole
// writes depth slightly in front of the monitor's own display panel, so the
// canvas is transparent over the glass (the HTML shows through) while the
// frame, chair and keyboard correctly occlude the screen.
//
// Because CSS3DRenderer works in CSS-pixel space while this is a metre-scale
// scene, the CSS3DObject lives under a group scaled by CSS_SCALE_K and is
// viewed by a clone of the WebGL camera moved to camera.position * K. The
// projection is scale-invariant, so it matches the WebGL camera exactly.
// ===========================================================================

const DEG = Math.PI / 180;
const INITIAL_APP = 'whoami';
// World metre -> CSS pixel factor for CSS3DRenderer. Arbitrary, cancels out.
const CSS_SCALE_K = 1000;
const TXT_ICON = `<svg viewBox="0 0 54 64" aria-hidden="true" focusable="false">
  <path class="txt-page" d="M7 2h27l13 13v45a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/>
  <path class="txt-fold" d="M34 2v11a2 2 0 0 0 2 2h11Z"/>
  <path class="txt-lines" d="M13 26h27M13 33h27M13 40h27M13 47h20"/>
</svg>`;

// ------------------------------------------------------------------ pages
const PAGES = {
  home: () => `
    <div class="page page-home" data-name="home">
      <div class="desktop-icons" aria-label="Desktop files">
        <button type="button" class="desktop-file" data-page="whoami"><span class="file-icon">${TXT_ICON}</span><span>whoami.txt</span></button>
        <button type="button" class="desktop-file" data-page="skills"><span class="file-icon">${TXT_ICON}</span><span>skills.txt</span></button>
        <button type="button" class="desktop-file" data-page="projects"><span class="file-icon">${TXT_ICON}</span><span>projects.txt</span></button>
        <button type="button" class="desktop-file" data-page="contact"><span class="file-icon">${TXT_ICON}</span><span>contact.txt</span></button>
      </div>
    </div>`,

  whoami: () => `
    <div class="page page-whoami" data-name="whoami">
      <h1 class="name">Muhammad Rizal Fadhillah</h1>
      <p class="role">DevSecOps &amp; Student</p>
      <p class="tagline">secure &middot; automated &middot; cloud-native</p>
    </div>`,

  skills: () => `
    <div class="page page-skills" data-name="skills">
      <div class="line"><span class="comment"># technical stack &amp; strategic insights</span></div>
      <p class="dim">Architecting secure, resilient infrastructure.</p>
      <div class="sect">
        <div class="h">&gt; SECURITY</div>
        <div class="tool-row">
          <b>DAST/SAST</b>
          <div class="brand-list" aria-label="DAST and SAST tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/zap" alt="" loading="lazy">OWASP ZAP</span>
            <span class="brand-chip"><img class="nuclei-logo" src="https://docs.projectdiscovery.io/logo/ProjectDiscovery-Logo-OnLight.svg" alt="" loading="lazy">Nuclei</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/trivy/D40000" alt="" loading="lazy">Trivy</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/sonarqubeserver/126ED3" alt="" loading="lazy">SonarQube</span>
          </div>
        </div>
        <div class="tool-row">
          <b>Pentesting</b>
          <div class="brand-list" aria-label="Pentesting tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/kalilinux/557C94" alt="" loading="lazy">Kali Linux</span>
          </div>
        </div>
        <div class="tool-row">
          <b>SIEM/SOC</b>
          <div class="brand-list" aria-label="SIEM and SOC tools">
            <span class="brand-chip"><img src="https://wazuh.com/uploads/2022/05/WAZUH.png" alt="" loading="lazy">Wazuh</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/elastic/005571" alt="" loading="lazy">ELK Stack</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/splunk/000000" alt="" loading="lazy">Splunk</span>
          </div>
        </div>
      </div>
      <div class="sect">
        <div class="h">&gt; CLOUD</div>
        <div class="kv"><span class="skill-brand"><img class="brand-aws" src="https://zonalogo.com/assets/aws-logo-png-svg.webp" alt=""><b>AWS</b></span><span class="warn">Learning</span></div>
        <div class="kv"><span class="skill-brand"><img class="brand-azure" src="https://zonalogo.com/assets/azure-logo-png-svg.webp" alt=""><b>Azure</b></span><span class="warn">Learning</span></div>
        <div class="kv"><span class="skill-brand"><img src="https://cdn.simpleicons.org/googlecloud/4285F4" alt="" loading="lazy"><b>GCP</b></span><span class="dim">Planned</span></div>
      </div>
      <div class="sect">
        <div class="h">&gt; DEVOPS</div>
        <div class="tool-row">
          <b>IaC</b>
          <div class="brand-list" aria-label="Infrastructure as code tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/terraform/844FBA" alt="" loading="lazy">Terraform</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/ansible/EE0000" alt="" loading="lazy">Ansible</span>
          </div>
        </div>
        <div class="tool-row">
          <b>CI/CD</b>
          <div class="brand-list" aria-label="CI/CD tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/jenkins/D24939" alt="" loading="lazy">Jenkins</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/githubactions/2088FF" alt="" loading="lazy">GitHub Actions</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/gitlab/FC6D26" alt="" loading="lazy">GitLab</span>
          </div>
        </div>
        <div class="tool-row">
          <b>GitOps</b>
          <div class="brand-list" aria-label="GitOps">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/argo" alt="" loading="lazy">Argo CD</span>
          </div>
        </div>
        <div class="tool-row">
          <b>Containers</b>
          <div class="brand-list" aria-label="Container tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/docker/2496ED" alt="" loading="lazy">Docker</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/kubernetes/326CE5" alt="" loading="lazy">Kubernetes</span>
          </div>
        </div>
        <div class="tool-row">
          <b>Observability &amp; Logging</b>
          <div class="brand-list" aria-label="Observability and logging tools">
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/grafana/F46800" alt="" loading="lazy">Grafana</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/elasticsearch/005571" alt="" loading="lazy">Elasticsearch</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/logstash/005571" alt="" loading="lazy">Logstash</span>
            <span class="brand-chip"><img src="https://cdn.simpleicons.org/kibana/E8478B" alt="" loading="lazy">Kibana</span>
          </div>
        </div>
      </div>
    </div>`,

  projects: () => `
    <div class="page page-projects" data-name="projects">
      <div class="line"><span class="comment"># engineered infrastructure &amp; defensive systems</span></div>
      <p class="dim">A compilation of DevOps write-ups &amp; pipeline implementations.</p>
      <div class="proj">
        <div class="pt"><span class="n">[1]</span> Python CI/CD Pipeline: Errors, False Positives &amp; Lessons Learned</div>
        <p>Environment drift, dependency management and scanner false positives.</p>
        <div class="pl">&rarr; <a href="https://medium.com/@zalfd/building-a-python-ci-cd-pipeline-errors-false-positives-and-lessons-learned-f75743c833bb" target="_blank" rel="noopener noreferrer">Medium</a></div>
      </div>
      <div class="proj">
        <div class="pt"><span class="n">[2]</span> Centralized Logging with ELK Stack &amp; Docker on Minimal Hardware</div>
        <p>Resource-efficient Elasticsearch, Logstash, Kibana via Docker-Compose.</p>
        <div class="pl">&rarr; <a href="https://medium.com/@zalfd/building-a-centralized-logging-system-with-elk-stack-docker-on-minimal-hardware-72ee2b960ccb" target="_blank" rel="noopener noreferrer">Medium</a></div>
      </div>
      <div class="proj">
        <div class="pt"><span class="n">[3]</span> Blocking SSH Brute Force with Active Response in Wazuh</div>
        <p>Detect SSH brute-force attacks and block host IPs in real time.</p>
        <div class="pl">&rarr; <a href="https://medium.com/@zalfd/blocking-ssh-brute-force-with-active-response-in-wazuh-a8aadac34251" target="_blank" rel="noopener noreferrer">Medium</a></div>
      </div>
      <div class="proj">
        <div class="pt"><span class="n">[4]</span> Automated Threat Response: Apache Log to Firewall Block</div>
        <p>SOC home lab: Wazuh + n8n + VirusTotal + iptables.</p>
        <div class="pl">&rarr; <a href="https://github.com/zalf179/SOC_Home_Lab" target="_blank" rel="noopener noreferrer">GitHub</a></div>
      </div>
      <div class="proj">
        <div class="pt"><span class="n">[5]</span> Enterprise-Grade DevSecOps &amp; GitOps Pipeline with ArgoCD</div>
        <p>Code to monitoring: SonarQube, Gitleaks, Trivy, ArgoCD, Prometheus.</p>
        <div class="pl">&rarr;
          <a href="https://medium.com/@zalfd/building-an-enterprise-grade-devsecops-gitops-pipeline-from-code-to-monitoring-with-argocd-78204a02bf25" target="_blank" rel="noopener noreferrer">Medium</a>
          <a href="https://github.com/flazel/learn_ci-cd" target="_blank" rel="noopener noreferrer">app repo</a>
          <a href="https://github.com/flazel/learn_ci-cd-gitops" target="_blank" rel="noopener noreferrer">gitops repo</a>
        </div>
      </div>
    </div>`,

  contact: () => `
    <div class="page page-contact" data-name="contact">
      <div class="rows">
        <div class="row"><span class="plus">[+]</span><b>GitHub</b><a href="https://github.com/zalf179" target="_blank" rel="noopener noreferrer">github.com/zalf179</a></div>
        <div class="row"><span class="plus">[+]</span><b>LinkedIn</b><a href="https://www.linkedin.com/in/rizalfadh/" target="_blank" rel="noopener noreferrer">linkedin.com/in/rizalfadh</a></div>
        <div class="row"><span class="plus">[+]</span><b>Medium</b><a href="https://medium.com/@zalfd" target="_blank" rel="noopener noreferrer">medium.com/@zalfd</a></div>
        <div class="row"><span class="plus">[+]</span><b>Resume</b><a href="Resume.pdf" target="_blank" rel="noopener noreferrer">Resume.pdf</a></div>
        <div class="row"><span class="plus">[+]</span><b>Email</b><a href="mailto:muhammadrizalfadhillah@gmail.com">muhammadrizalfadhillah@gmail.com</a></div>
      </div>
      <div class="cta">Ready to Secure Your Velocity?</div>
      <p class="dim">Still growing in DevSecOps and open to learning opportunities, collaboration, and junior roles.</p>
      <p class="status"><span class="dot">&#9679;</span> [STATUS] Ready for encrypted communications.</p>
      <footer class="credit${CONFIG.credit.placeholder ? ' placeholder' : ''}">3D model credit: ${escapeHtml(CREDIT_TEXT)}</footer>
    </div>`,
};

const TITLES = { home: '', whoami: 'whoami.txt', skills: 'skills.txt', projects: 'projects.txt', contact: 'contact.txt' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function appWindow(id, content) {
  return `<section class="app-window" data-window="${id}" aria-label="${TITLES[id]}"${id === INITIAL_APP ? '' : ' hidden'}>` +
    `<header class="app-titlebar"><span class="app-title-icon">▤</span><span class="app-title">${TITLES[id]}</span>` +
      `<div class="window-actions">` +
        `<button type="button" data-window-action="minimize" aria-label="Minimize">&#x2212;</button>` +
        `<button type="button" data-window-action="maximize" aria-label="Maximize">&#x25A1;</button>` +
        `<button type="button" data-window-action="close" aria-label="Close">&#x2715;</button>` +
      `</div>` +
    `</header><div class="app-content">${content}</div><div class="resize-corner" aria-hidden="true"></div></section>`;
}

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ------------------------------------------------------------ geometry/basis
// Derive the display quad basis straight from the 4 corners: right = top edge
// (TR-TL), up = left edge (TL-BL), normal = right x up. Flip right+normal if
// the normal points away from the viewer so the content is never mirrored.
function deriveGeometry(S) {
  const c = S.corners;
  const TL = v3(c.tl), TR = v3(c.tr), BL = v3(c.bl), BR = v3(c.br);
  const fullW = TR.distanceTo(TL);
  const fullH = TL.distanceTo(BL);
  const center = new THREE.Vector3()
    .add(TL).add(TR).add(BL).add(BR).multiplyScalar(0.25);
  const right = new THREE.Vector3().subVectors(TR, TL).normalize();
  const up = new THREE.Vector3().subVectors(TL, BL).normalize();
  const normal = new THREE.Vector3().crossVectors(right, up).normalize();
  const flipped = normal.z < 0;
  if (flipped) { right.negate(); normal.negate(); }
  return { TL, TR, BL, BR, fullW, fullH, center, right, up, normal, flipped };
}

// Working copy of the calibration knobs; initialised from CONFIG.screen so the
// persisted values are applied at startup.
function initialParams(S) {
  return {
    inset: { ...S.inset },
    offset: [...S.offset],
    scale: S.scale,
    rotationOffset: { ...S.rotationOffset },
  };
}

// Full transform for the display content, including inset, nudge, scale and
// local rotation offset.
function computeTransform(S, params, geo) {
  const { left, right: r, top, bottom } = params.inset;
  const dispW = geo.fullW * (1 - left - r);
  const dispH = geo.fullH * (1 - top - bottom);
  const center = geo.center.clone()
    .addScaledVector(geo.right, ((left - r) / 2) * geo.fullW + params.offset[0])
    .addScaledVector(geo.up, ((bottom - top) / 2) * geo.fullH + params.offset[1])
    .addScaledVector(geo.normal, params.offset[2]);
  const scaleX = (dispW / S.pageWidth) * params.scale;
  const scaleY = (dispH / S.pageHeight) * params.scale;
  const scaleObj = Math.min(scaleX, scaleY);
  const basisQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(geo.right, geo.up, geo.normal),
  );
  const ro = params.rotationOffset;
  const rotQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(ro.pitch * DEG, ro.yaw * DEG, ro.roll * DEG, 'YXZ'),
  );
  const quaternion = basisQuat.multiply(rotQuat);
  return {
    center,
    quaternion,
    scaleObj,
    scaleX,
    scaleY,
    dispW,
    dispH,
    contentW: S.pageWidth * scaleX,
    contentH: S.pageHeight * scaleY,
    basisQuat,
    flipped: geo.flipped,
  };
}

// ------------------------------------------------------------- factory
export function createScreen({ webglScene, camera, onNeedsRender }) {
  const S = CONFIG.screen;
  const layer = document.getElementById('css3d-layer');
  const geo = deriveGeometry(S);
  const params = initialParams(S);

  // ---- CSS3D layer (beneath the transparent WebGL canvas) ----
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  const cssDom = cssRenderer.domElement;
  cssDom.style.position = 'absolute';
  cssDom.style.top = '0';
  cssDom.style.left = '0';
  cssDom.style.pointerEvents = 'none';
  layer.appendChild(cssDom);

  const cssScene = new THREE.Scene();
  // Metre-scale world is mapped into CSS-pixel space by this root scale.
  const cssRoot = new THREE.Group();
  cssRoot.scale.setScalar(CSS_SCALE_K);
  cssScene.add(cssRoot);

  // Clone of the WebGL camera used by CSS3DRenderer (kept in sync every frame).
  const cssCamera = new THREE.PerspectiveCamera();

  // The screen element (real HTML).
  const el = document.createElement('div');
  el.className = 'screen';
  el.setAttribute('data-active', INITIAL_APP);
  el.style.width = S.pageWidth + 'px';
  el.style.height = S.pageHeight + 'px';
  el.innerHTML =
    `<div class="inner">` +
      `<div class="body">${PAGES.home()}` +
        `${Object.entries(PAGES).filter(([id]) => id !== 'home').map(([id, fn]) => appWindow(id, fn())).join('')}` +
      `</div>` +
      `<div class="start-menu" hidden><div class="start-heading">START</div>` +
        `<button type="button" data-page="whoami">▤ &nbsp; whoami.txt</button>` +
        `<button type="button" data-page="skills">▤ &nbsp; skills.txt</button>` +
        `<button type="button" data-page="projects">▤ &nbsp; projects.txt</button>` +
        `<button type="button" data-page="contact">▤ &nbsp; contact.txt</button>` +
      `</div>` +
      `<nav class="taskbar">` +
        `<button type="button" class="start-button" data-start aria-label="Open Start menu" aria-expanded="false"><span></span><span></span><span></span><span></span></button>` +
        `<button type="button" class="task-app" data-window-restore><span class="task-app-icon">▤</span><span class="task-app-label">${TITLES[INITIAL_APP]}</span></button>` +
        `<span class="taskbar-spacer"></span>` +
        `<button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch to dark mode" title="Switch theme">` +
          `<svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>` +
          `<svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/></svg>` +
        `</button>` +
        `<span class="system-tray" role="img" aria-label="Wi-Fi connected, internet access" title="Wi-Fi · Internet access">` +
          `<svg class="tray-network-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 8.8a14.5 14.5 0 0 1 19 0M5.8 12.2a9.5 9.5 0 0 1 12.4 0M9.2 15.7a4.5 4.5 0 0 1 5.6 0M12 19.2h.01"/></svg>` +
        `</span>` +
        `<time class="task-clock"><span class="clock-time"></span><span class="clock-date"></span></time>` +
      `</nav>` +
      `<div class="wipe" aria-hidden="true"></div>` +
      `<div class="scan" aria-hidden="true"></div>` +
      `<div class="glass" aria-hidden="true"></div>` +
    `</div>`;
  el.style.pointerEvents = 'none'; // CSS3DObject enables it; we toggle it by state
  const obj = new CSS3DObject(el);
  cssRoot.add(obj);

  // Invisible depth-only plane matching the HTML footprint. Rendered first and
  // slightly in front of the monitor's own display panel, it writes depth so
  // the panel is not painted there and the transparent canvas reveals the DOM.
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: true, depthTest: true,
      transparent: false, side: THREE.DoubleSide,
    }),
  );
  hole.name = 'screen-hole';
  hole.renderOrder = -1;
  webglScene.add(hole);

  // ---- calibration debug: magenta quad outline + right/up/normal arrows ----
  const dbg = new THREE.Group();
  dbg.visible = false;
  webglScene.add(dbg);
  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8), 3));
  const outline = new THREE.LineLoop(
    outlineGeo, new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false }),
  );
  outline.renderOrder = 999;
  dbg.add(outline);
  const arrows = [
    new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.0001, 0xff4444, 0.0001, 0.0001),
    new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.0001, 0x44ff44, 0.0001, 0.0001),
    new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.0001, 0x4488ff, 0.0001, 0.0001),
  ];
  arrows.forEach((a) => dbg.add(a));

  // ------------------------------------------------------------- apply
  let current = null;
  function apply() {
    const t = computeTransform(S, params, geo);
    current = t;
    // CSS3DObject (under cssRoot, with separate inset-derived width/height scales).
    obj.position.copy(t.center);
    obj.quaternion.copy(t.quaternion);
    obj.scale.set(t.scaleX, t.scaleY, t.scaleObj);
    // Hole matches the HTML footprint exactly.
    hole.scale.set(t.contentW, t.contentH, 1);
    hole.position.copy(t.center).addScaledVector(geo.normal, S.holeOffset);
    hole.quaternion.copy(t.quaternion);
    // Debug outline + axis arrows.
    const hw = t.contentW / 2, hh = t.contentH / 2;
    const pos = outlineGeo.attributes.position;
    pos.setXYZ(0, -hw, -hh, 0); pos.setXYZ(1, hw, -hh, 0);
    pos.setXYZ(2, hw, hh, 0); pos.setXYZ(3, -hw, hh, 0);
    pos.needsUpdate = true;
    outlineGeo.computeBoundingSphere();
    dbg.position.copy(t.center);
    dbg.quaternion.copy(t.quaternion);
    const L = Math.max(t.contentW, 0.2) * 0.6;
    const dirs = [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1),
    ];
    arrows.forEach((a, i) => {
      a.setDirection(dirs[i]);
      a.setLength(L, L * 0.22, L * 0.12);
    });
    onNeedsRender && onNeedsRender();
  }
  apply();

  // ------------------------------------------------------------- state
  let active = INITIAL_APP;
  let switching = false;
  let switchUntil = 0;
  let onExit = null;

  function setActive(id) {
    if (!PAGES[id] || id === 'home') return;
    const win = el.querySelector(`[data-window="${id}"]`);
    if (!win) return;
    active = id;
    el.querySelectorAll('.app-window').forEach((app) => { app.hidden = app !== win; });
    win.classList.remove('minimized');
    win.style.zIndex = String(++windowZ);
    el.querySelector('[data-window-restore]').hidden = false;
    el.classList.remove('start-open');
    const startButton = el.querySelector('[data-start]');
    if (startButton) startButton.setAttribute('aria-expanded', 'false');
    switching = true;
    switchUntil = performance.now() + 360;
    el.setAttribute('data-active', id);
    el.querySelector('.task-app-label').textContent = TITLES[id] || id;
    el.querySelectorAll('[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === id));
    el.classList.add('switching');
    window.setTimeout(() => el.classList.remove('switching'), 360);
    onNeedsRender && onNeedsRender();
  }

  let windowZ = 1;
  function minimizeWindow(win) {
    win.hidden = true;
    win.classList.add('minimized');
    onNeedsRender && onNeedsRender();
  }
  function closeWindow(win) {
    win.hidden = true;
    win.classList.remove('minimized', 'is-maximized');
    if (active === win.dataset.window) {
      active = 'home';
      el.setAttribute('data-active', 'home');
      el.querySelector('[data-window-restore]').hidden = true;
      el.querySelector('.task-app-label').textContent = '';
    }
    onNeedsRender && onNeedsRender();
  }

  function setVisible() { /* always visible; kept for API compatibility */ }

  function setInteractive(v) {
    layer.classList.toggle('is-active', !!v);
    layer.setAttribute('aria-hidden', String(!v));
    el.classList.toggle('interactive', !!v);
    el.style.pointerEvents = v ? 'auto' : 'none';
    if (!v) el.querySelector('.body').scrollTop = 0;
  }

  // Fade the whole panel 0..1 (used by the camera transition).
  function setBrightness(v) {
    const inner = el.querySelector('.inner');
    if (inner) inner.style.opacity = String(Math.max(0, Math.min(1, v)));
  }

  function boot() {
    el.classList.remove('off');
    el.classList.add('booted');
    window.setTimeout(() => el.classList.remove('booted'), 620);
  }
  function powerOff() {
    el.classList.add('off');
    window.setTimeout(() => { el.classList.remove('off'); onNeedsRender && onNeedsRender(); }, 300);
  }

  // In-screen navigation + exit.
  el.querySelectorAll('[data-page]').forEach((b) =>
    b.addEventListener('click', () => setActive(b.dataset.page)));
  const taskApp = el.querySelector('[data-window-restore]');
  taskApp.addEventListener('click', () => {
    const win = el.querySelector(`[data-window="${active}"]`);
    if (!win) return;
    if (win.hidden) {
      win.hidden = false;
      win.classList.remove('minimized');
      win.style.zIndex = String(++windowZ);
    } else {
      minimizeWindow(win);
    }
    onNeedsRender && onNeedsRender();
  });
  el.querySelectorAll('.app-window').forEach((win) => {
    const titlebar = win.querySelector('.app-titlebar');
    titlebar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.window-actions')) return;
      const rect = win.getBoundingClientRect();
      const scale = rect.width / win.offsetWidth || 1;
      const drag = { x: event.clientX, y: event.clientY, left: win.offsetLeft, top: win.offsetTop, scale };
      titlebar.setPointerCapture(event.pointerId);
      const move = (e) => {
        if (!titlebar.hasPointerCapture(e.pointerId)) return;
        const maxLeft = Math.max(0, el.clientWidth - win.offsetWidth);
        const maxTop = Math.max(0, el.clientHeight - 48 - win.offsetHeight);
        win.style.left = `${Math.min(maxLeft, Math.max(0, drag.left + (e.clientX - drag.x) / drag.scale))}px`;
        win.style.top = `${Math.min(maxTop, Math.max(0, drag.top + (e.clientY - drag.y) / drag.scale))}px`;
      };
      const up = (e) => {
        if (!titlebar.hasPointerCapture(e.pointerId)) return;
        titlebar.releasePointerCapture(e.pointerId);
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', up);
      };
      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', up);
    });
    win.querySelectorAll('[data-window-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.windowAction;
      if (action === 'minimize') minimizeWindow(win);
      if (action === 'maximize') {
        win.classList.toggle('is-maximized');
        button.setAttribute('aria-pressed', String(win.classList.contains('is-maximized')));
      }
      if (action === 'close') closeWindow(win);
    }));
  });
  const startButton = el.querySelector('[data-start]');
  const startMenu = el.querySelector('.start-menu');
  startButton.addEventListener('click', () => {
    const open = !el.classList.contains('start-open');
    el.classList.toggle('start-open', open);
    startButton.setAttribute('aria-expanded', String(open));
    startMenu.hidden = !open;
  });
  const themeToggle = el.querySelector('[data-theme-toggle]');
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('portfolio-screen-theme'); } catch { /* storage may be blocked */ }
  el.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
  const updateThemeButton = () => {
    const next = el.dataset.theme === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${next} mode`);
    themeToggle.setAttribute('title', `Switch to ${next} mode`);
  };
  updateThemeButton();
  themeToggle.addEventListener('click', () => {
    el.dataset.theme = el.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('portfolio-screen-theme', el.dataset.theme); } catch { /* storage may be blocked */ }
    updateThemeButton();
    onNeedsRender && onNeedsRender();
  });
  const clock = el.querySelector('.task-clock');
  const updateClock = () => {
    const now = new Date();
    clock.querySelector('.clock-time').textContent = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    clock.querySelector('.clock-date').textContent = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      now.getFullYear(),
    ].join('/');
  };
  updateClock();
  window.setInterval(updateClock, 30000);

  function update(now) {
    if (switching && now >= switchUntil) { switching = false; el.classList.remove('switching'); }
    return switching;
  }

  // ------------------------------------------------------------- render
  function render() {
    // Keep the CSS camera identical to the WebGL camera this frame (same size,
    // same object state, same fov), just moved into CSS-pixel space.
    cssCamera.fov = camera.fov;
    cssCamera.aspect = camera.aspect;
    cssCamera.near = camera.near;
    cssCamera.far = camera.far;
    cssCamera.updateProjectionMatrix();
    cssCamera.position.copy(camera.position).multiplyScalar(CSS_SCALE_K);
    cssCamera.quaternion.copy(camera.quaternion);
    cssCamera.updateMatrixWorld(true);

    cssRenderer.render(cssScene, cssCamera);

    // Hide the content entirely when the camera is behind the screen plane.
    if (current) {
      const toCam = camera.position.clone().sub(current.center).normalize();
      const facing = geo.normal.dot(toCam);
      const behind = facing <= 0.001;
      if (layer.classList.contains('behind') !== behind) layer.classList.toggle('behind', behind);
    }
  }

  function resize(w, h) {
    cssRenderer.setSize(w || window.innerWidth, h || window.innerHeight);
  }

  // Debug/calibration helper: project a world point to viewport pixels (null
  // if behind the camera / clipped). Matches the WebGL projection exactly.
  function project(point) {
    const v = point.clone().applyMatrix4(camera.matrixWorldInverse);
    if (v.z >= -0.001) return null;
    const ndc = v.applyMatrix4(camera.projectionMatrix); // already /w
    if (!isFinite(ndc.x) || !isFinite(ndc.y)) return null;
    if (ndc.z > 1 || ndc.z < -1) return null;
    return { x: (ndc.x * 0.5 + 0.5) * window.innerWidth, y: (-ndc.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ------------------------------------------------------------- calibration
  const STEP_OFF = 0.002;   // m
  const STEP_SCALE = 0.005; // ratio
  const STEP_ROT = 0.25;    // deg
  let calibOn = false;
  let logTimer = 0;

  const box = document.createElement('div');
  box.id = 'screen-calib';
  box.hidden = true;
  box.innerHTML =
    `<b>SCREEN CALIBRATION</b>` +
    `<div class="row"><span>offset</span><code data-calib="offset"></code></div>` +
    `<div class="row"><span>scale</span><code data-calib="scale"></code></div>` +
    `<div class="row"><span>rotation</span><code data-calib="rotation"></code></div>` +
    `<div class="row"><span>inset</span><code data-calib="inset"></code></div>` +
    `<div class="row"><span>quad</span><code data-calib="quad"></code></div>` +
    `<div class="keys">arrows X/Y &middot; PgUp/PgDn normal &middot; [ ] scale &middot; ` +
    `J/L yaw &middot; I/K pitch &middot; U/O roll &middot; Shift &times;5 &middot; C close</div>`;
  document.body.appendChild(box);

  function fmt(n, d = 3) { return Number(n).toFixed(d).replace(/\.?0+$/, '') || '0'; }

  function configBlock() {
    const t = current;
    return {
      offset: params.offset.map((n) => Number(n.toFixed(4))),
      scale: Number(params.scale.toFixed(4)),
      rotationOffset: {
        yaw: Number(params.rotationOffset.yaw.toFixed(3)),
        pitch: Number(params.rotationOffset.pitch.toFixed(3)),
        roll: Number(params.rotationOffset.roll.toFixed(3)),
      },
      inset: {
        left: Number(params.inset.left.toFixed(4)),
        right: Number(params.inset.right.toFixed(4)),
        top: Number(params.inset.top.toFixed(4)),
        bottom: Number(params.inset.bottom.toFixed(4)),
      },
      _derived: {
        center: t.center.toArray().map((n) => Number(n.toFixed(5))),
        right: geo.right.toArray().map((n) => Number(n.toFixed(5))),
        up: geo.up.toArray().map((n) => Number(n.toFixed(5))),
        normal: geo.normal.toArray().map((n) => Number(n.toFixed(5))),
        scaleX: Number(t.scaleX.toFixed(7)),
        scaleY: Number(t.scaleY.toFixed(7)),
      },
    };
  }

  function updateBox() {
    const t = current;
    box.querySelector('[data-calib="offset"]').textContent =
      `[${params.offset.map((n) => fmt(n, 4)).join(', ')}] (r,u,n)`;
    box.querySelector('[data-calib="scale"]').textContent =
      `${fmt(params.scale, 4)}  (x ${fmt(t.scaleX, 6)} / y ${fmt(t.scaleY, 6)} m/px)`;
    box.querySelector('[data-calib="rotation"]').textContent =
      `yaw ${fmt(params.rotationOffset.yaw, 2)}  pitch ${fmt(params.rotationOffset.pitch, 2)}  roll ${fmt(params.rotationOffset.roll, 2)}`;
    box.querySelector('[data-calib="inset"]').textContent =
      `L ${fmt(params.inset.left, 3)} R ${fmt(params.inset.right, 3)} T ${fmt(params.inset.top, 3)} B ${fmt(params.inset.bottom, 3)}`;
    box.querySelector('[data-calib="quad"]').textContent =
      `${fmt(t.contentW, 4)} x ${fmt(t.contentH, 4)} m @ [${t.center.toArray().map((n) => fmt(n, 3)).join(', ')}]`;
  }

  function logJSON() {
    window.clearTimeout(logTimer);
    logTimer = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('[screen] paste into CONFIG.screen in js/config.js:\n' + JSON.stringify(configBlock(), null, 2));
    }, 120);
  }

  function setCalib(on) {
    calibOn = !!on;
    dbg.visible = calibOn;
    el.classList.toggle('calib', calibOn);
    box.hidden = !calibOn;
    if (calibOn) { updateBox(); logJSON(); }
    onNeedsRender && onNeedsRender();
  }

  function onKey(e) {
    if (e.key === 'c' || e.key === 'C') {
      if (!e.repeat) setCalib(!calibOn);
      return;
    }
    if (!calibOn) return;
    const m = e.shiftKey ? 5 : 1;
    let used = true;
    switch (e.key) {
      case 'ArrowLeft': params.offset[0] -= STEP_OFF * m; break;
      case 'ArrowRight': params.offset[0] += STEP_OFF * m; break;
      case 'ArrowUp': params.offset[1] += STEP_OFF * m; break;
      case 'ArrowDown': params.offset[1] -= STEP_OFF * m; break;
      case 'PageUp': params.offset[2] += STEP_OFF * m; break;
      case 'PageDown': params.offset[2] -= STEP_OFF * m; break;
      case '[': params.scale = Math.max(0.4, params.scale - STEP_SCALE * m); break;
      case ']': params.scale = Math.min(1.6, params.scale + STEP_SCALE * m); break;
      case 'j': case 'J': params.rotationOffset.yaw -= STEP_ROT * m; break;
      case 'l': case 'L': params.rotationOffset.yaw += STEP_ROT * m; break;
      case 'i': case 'I': params.rotationOffset.pitch -= STEP_ROT * m; break;
      case 'k': case 'K': params.rotationOffset.pitch += STEP_ROT * m; break;
      case 'u': case 'U': params.rotationOffset.roll -= STEP_ROT * m; break;
      case 'o': case 'O': params.rotationOffset.roll += STEP_ROT * m; break;
      default: used = false;
    }
    if (!used) return;
    e.preventDefault();
    apply();
    updateBox();
    logJSON();
  }
  window.addEventListener('keydown', onKey);

  function dispose() {
    window.removeEventListener('keydown', onKey);
    webglScene.remove(hole);
    hole.geometry.dispose();
    hole.material.dispose();
    webglScene.remove(dbg);
    outline.geometry.dispose();
    outline.material.dispose();
    arrows.forEach((a) => a.dispose && a.dispose());
    box.remove();
    cssRoot.remove(obj);
    if (cssDom.parentNode) cssDom.parentNode.removeChild(cssDom);
  }

  // Auto-enable calibration with ?debug (screen.js owns this so it works even
  // if main.js is not the one toggling it).
  if (new URLSearchParams(location.search).has('debug')) setCalib(true);

  return {
    element: el, hole, object3D: obj,
    // World-space quad the DOM overlay is locked to.
    quad: { center: geo.center, right: geo.right, up: geo.up, normal: geo.normal },
    setActive, setVisible, setInteractive, boot, powerOff, update, render, resize, dispose, project, setBrightness,
    setOnExit(fn) { onExit = fn; },
    // Calibration API.
    toggleCalibration: () => setCalib(!calibOn),
    setCalibration: setCalib,
    get calibrating() { return calibOn; },
    get params() { return configBlock(); },
    get active() { return active; },
    get visible() { return true; },
    get interactive() { return layer.classList.contains('is-active'); },
  };
}
