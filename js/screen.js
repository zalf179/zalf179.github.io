import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CONFIG, CREDIT_TEXT } from './config.js';

// ===========================================================================
// The monitor screen: a CSS3DObject holding real HTML, locked to the display
// quad's world transform. A separate invisible depth-only plane ("hole") is
// placed exactly over the display so the WebGL scene keeps correct depth while
// the DOM shows through. Monitor_Monitor_0 itself is left untouched.
// ===========================================================================

const PROMPT = 'visitor@sec-ops-portfolio:~$';

// ------------------------------------------------------------------ pages
const PAGES = {
  home: () => `
    <div class="page page-home" data-name="home">
      <div class="line"><span class="ps1">${PROMPT}</span> <span class="cmd">whoami</span></div>
      <h1 class="name">Muhammad Rizal Fadhillah</h1>
      <div class="line"><span class="ps1">${PROMPT}</span> <span class="cmd">cat role.txt</span></div>
      <p class="role">DevSecOps Architect &amp; Student</p>
      <p class="dim">aspiring DevOps &amp; cyber-security engineer building secure,<br>automated cloud-native infrastructure.</p>
      <div class="line"><span class="ps1">${PROMPT}</span> <span class="cmd">ls ~/links</span></div>
      <nav class="links">
        <a href="https://github.com/zalf179" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.linkedin.com/in/rizalfadh/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://medium.com/@zalfd" target="_blank" rel="noopener noreferrer">Medium</a>
        <a href="Resume.pdf" target="_blank" rel="noopener noreferrer">Resume.pdf</a>
      </nav>
      <p class="comment">// scroll to explore the desk</p>
    </div>`,

  skills: () => `
    <div class="page page-skills" data-name="skills">
      <div class="line"><span class="comment"># technical stack &amp; strategic insights</span></div>
      <p class="dim">Architecting secure, resilient infrastructure.</p>
      <div class="sect">
        <div class="h">&gt; SECURITY</div>
        <div class="kv"><b>DAST/SAST</b><span>automated vuln scans, dependency auditing, container scanning</span></div>
        <div class="kv"><b>Pentesting</b><span>network/application security evaluation, threat emulation</span></div>
        <div class="kv"><b>SIEM/SOC</b><span>intrusion monitoring, threat hunting, log aggregation</span></div>
      </div>
      <div class="sect">
        <div class="h">&gt; CLOUD</div>
        <div class="kv"><b>AWS</b><span class="warn">Learning</span></div>
        <div class="kv"><b>Azure</b><span class="dim">Planned</span></div>
        <div class="kv"><b>GCP</b><span class="dim">Planned</span></div>
      </div>
      <div class="sect">
        <div class="h">&gt; DEVOPS</div>
        <div class="note">Docker&nbsp;&nbsp;Kubernetes&nbsp;&nbsp;Terraform&nbsp;&nbsp;Ansible&nbsp;&nbsp;GitHub Actions</div>
        <div class="kv"><b>IaC</b><span>version-controlled, peer-reviewed cloud environments</span></div>
        <div class="kv"><b>DevSecOps</b><span>vuln scans + policy gates inside CI/CD</span></div>
        <div class="kv"><b>Containers</b><span>image hardening, admission control, signing, runtime</span></div>
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
      <div class="line"><span class="ps1">${PROMPT}</span> <span class="cmd">./get_contact_info.sh</span></div>
      <div class="rows">
        <div class="row"><span class="plus">[+]</span><b>GitHub</b><a href="https://github.com/zalf179" target="_blank" rel="noopener noreferrer">github.com/zalf179</a></div>
        <div class="row"><span class="plus">[+]</span><b>LinkedIn</b><a href="https://www.linkedin.com/in/rizalfadh/" target="_blank" rel="noopener noreferrer">linkedin.com/in/rizalfadh</a></div>
        <div class="row"><span class="plus">[+]</span><b>Medium</b><a href="https://medium.com/@zalfd" target="_blank" rel="noopener noreferrer">medium.com/@zalfd</a></div>
        <div class="row"><span class="plus">[+]</span><b>Resume</b><a href="Resume.pdf" target="_blank" rel="noopener noreferrer">Resume.pdf</a></div>
        <div class="row"><span class="plus">[+]</span><b>Email</b><a href="mailto:muhammadrizalfadhillah@gmail.com">muhammadrizalfadhillah@gmail.com</a></div>
      </div>
      <div class="cta">Ready to Secure Your Velocity?</div>
      <p class="dim">Open to architectural consultation, pipeline auditing, or senior-level DevSecOps positions.</p>
      <p class="status"><span class="dot">&#9679;</span> [STATUS] Ready for encrypted communications.</p>
      <footer class="credit${CONFIG.credit.placeholder ? ' placeholder' : ''}">3D model credit: ${escapeHtml(CREDIT_TEXT)}</footer>
    </div>`,
};

const TITLES = { home: 'home.sh', skills: 'skills.conf', projects: 'projects.md', contact: 'contact.sh' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------- transform
// Build the world transform for the display quad from CONFIG.screen.
function screenBasis(s) {
  const right = new THREE.Vector3(...s.right).normalize();
  const up = new THREE.Vector3(...s.up).normalize();
  const normal = new THREE.Vector3(...s.normal).normalize();
  return { right, up, normal };
}

function applyScreenTransform(obj, s, extraOffset = 0) {
  const { right, up, normal } = screenBasis(s);
  const basis = new THREE.Matrix4().makeBasis(right, up, normal);
  obj.quaternion.setFromRotationMatrix(basis);
  obj.position.set(...s.center).addScaledVector(normal, s.offset + extraOffset);
}

// ------------------------------------------------------------- factory
export function createScreen({ webglScene, camera, onNeedsRender }) {
  const S = CONFIG.screen;
  const layer = document.getElementById('css3d-layer');

  // CSS3D layer, perfectly over the WebGL canvas.
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.left = '0';
  cssRenderer.domElement.style.pointerEvents = 'none';
  layer.appendChild(cssRenderer.domElement);

  const cssScene = new THREE.Scene();

  // The screen element (real HTML).
  const el = document.createElement('div');
  el.className = 'screen';
  el.setAttribute('data-active', 'home');
  el.innerHTML =
    `<div class="bar"><span class="tl r"></span><span class="tl y"></span><span class="tl g"></span>` +
    `<span class="title">home.sh</span></div>` +
    `<div class="body">${Object.values(PAGES).map((fn) => fn()).join('')}</div>` +
    `<div class="wipe" aria-hidden="true"></div>` +
    `<div class="scan" aria-hidden="true"></div>` +
    `<div class="glass" aria-hidden="true"></div>`;

  const obj = new CSS3DObject(el);
  obj.scale.setScalar(S.width / S.pageWidth);
  applyScreenTransform(obj, S, 0.0006); // DOM sits a hair in front of the hole plane
  cssScene.add(obj);

  // Invisible depth-only plane over the display quad (leaves the monitor mesh
  // untouched). Keeps WebGL depth correct under the DOM.
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(S.width, S.height),
    new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: true, colorWrite: false,
      blending: THREE.NoBlending, side: THREE.DoubleSide,
    }),
  );
  hole.name = 'screen-hole';
  hole.renderOrder = 1;
  applyScreenTransform(hole, S);
  webglScene.add(hole);

  // ------------------------------------------------------------- state
  let active = 'home';
  let switching = false;
  let switchUntil = 0;

  function setActive(id) {
    if (!PAGES[id] || id === active) return;
    active = id;
    switching = true;
    switchUntil = performance.now() + 360;
    el.setAttribute('data-active', id);
    const title = el.querySelector('.title');
    if (title) title.textContent = TITLES[id] || id;
    el.classList.add('switching');
    window.setTimeout(() => el.classList.remove('switching'), 360);
    onNeedsRender && onNeedsRender();
  }

  function setVisible(v) {
    layer.classList.toggle('visible', !!v);
    onNeedsRender && onNeedsRender();
  }

  function setInteractive(v) {
    layer.classList.toggle('is-hold', !!v);
  }

  function update(now) {
    if (switching && now >= switchUntil) { switching = false; el.classList.remove('switching'); }
    return switching;
  }

  function render() {
    cssRenderer.render(cssScene, camera);
  }

  function resize(w, h) {
    cssRenderer.setSize(w, h);
  }

  function dispose() {
    webglScene.remove(hole);
    hole.geometry.dispose();
    hole.material.dispose();
    el.remove();
    cssScene.remove(obj);
    if (cssRenderer.domElement.parentNode) cssRenderer.domElement.parentNode.removeChild(cssRenderer.domElement);
  }

  return {
    object3D: obj, element: el, hole,
    setActive, setVisible, setInteractive, update, render, resize, dispose,
    get active() { return active; },
    get visible() { return layer.classList.contains('visible'); },
    // debug: expose the derived world transform
    get transform() {
      return { position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.x };
    },
  };
}
