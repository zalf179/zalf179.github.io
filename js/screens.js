import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.screens.colors;
const FONT = CONFIG.screens.font;
const W = CONFIG.screens.canvasWidth;
const H = CONFIG.screens.canvasHeight;

// ----------------------------------------------------------------- content
// Each stop is a list of lines. A line is { indent, size, runs:[...] }.
// A run is { text, color, weight, url }. `url` makes it a clickable link.
const BODY = 34;
const SMALL = 29;

const PROMPT = 'visitor@sec-ops-portfolio:~$';

function whoamiContent() {
  return [
    { runs: [{ text: PROMPT + ' ', color: C.green, weight: 700 }, { text: 'whoami', color: C.fg }] },
    { runs: [{ text: 'Muhammad Rizal Fadhillah', color: C.accent, weight: 700, size: 60 }] },
    { gap: 22 },
    { runs: [{ text: PROMPT + ' ', color: C.green, weight: 700 }, { text: 'cat role.txt', color: C.fg }] },
    { runs: [{ text: 'DevSecOps Architect & Student', color: C.fg, size: 40, weight: 500 }] },
    { runs: [{ text: 'aspiring DevOps & cyber-security engineer building secure,', color: C.dim }] },
    { runs: [{ text: 'automated cloud-native infrastructure.', color: C.dim }] },
    { gap: 22 },
    { runs: [{ text: PROMPT + ' ', color: C.green, weight: 700 }, { text: 'ls ~/links', color: C.fg }] },
    {
      runs: [
        { text: 'GitHub', color: C.link, url: 'https://github.com/zalf179' },
        { text: '   ', color: C.fg },
        { text: 'LinkedIn', color: C.link, url: 'https://www.linkedin.com/in/rizalfadh/' },
        { text: '   ', color: C.fg },
        { text: 'Medium', color: C.link, url: 'https://medium.com/@zalfd' },
        { text: '   ', color: C.fg },
        { text: 'Resume.pdf', color: C.link, url: 'Resume.pdf' },
      ],
    },
    { gap: 12 },
    { runs: [{ text: '// scroll to explore the room', color: C.comment, size: SMALL }] },
  ];
}

function skillsContent() {
  const kv = (k, v, color = C.fg) => ({
    indent: 40,
    size: SMALL,
    runs: [
      { text: k.padEnd(12, ' '), color: C.accent, weight: 500 },
      { text: v, color },
    ],
  });
  const head = (t) => ({ gap: 10, runs: [{ text: '> ' + t, color: C.green, weight: 700, size: 38 }] });
  const note = (t) => ({ indent: 40, size: SMALL, runs: [{ text: t, color: C.comment }] });
  return [
    { runs: [{ text: '# technical stack & strategic insights', color: C.comment }] },
    { runs: [{ text: 'Architecting secure, resilient infrastructure.', color: C.dim }] },
    { gap: 18 },
    head('SECURITY'),
    { indent: 40, size: SMALL, runs: [{ text: 'DAST/SAST   ', color: C.fg, weight: 700 }, { text: 'automated vuln scans, dependency auditing, container scanning', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'Pentesting  ', color: C.fg, weight: 700 }, { text: 'network/application security evaluation, threat emulation', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'SIEM/SOC    ', color: C.fg, weight: 700 }, { text: 'intrusion monitoring, threat hunting, log aggregation', color: C.dim }] },
    head('CLOUD'),
    kv('AWS', 'Learning', C.warn),
    kv('Azure', 'Planned', C.dim),
    kv('GCP', 'Planned', C.dim),
    head('DEVOPS'),
    note('Docker  Kubernetes  Terraform  Ansible  GitHub Actions'),
    { indent: 40, size: SMALL, runs: [{ text: 'IaC         ', color: C.accent, weight: 500 }, { text: 'version-controlled, peer-reviewed cloud environments', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'DevSecOps   ', color: C.accent, weight: 500 }, { text: 'vuln scans + policy gates inside CI/CD', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'Containers  ', color: C.accent, weight: 500 }, { text: 'image hardening, admission control, signing, runtime', color: C.dim }] },
  ];
}

function projectsContent() {
  const proj = (n, title, desc, links) => {
    const runs = [
      { text: `[${n}] `, color: C.green, weight: 700 },
      { text: title, color: C.fg, weight: 700, size: 36 },
    ];
    const rows = [
      { gap: 12, runs },
      { indent: 44, size: SMALL, runs: [{ text: desc, color: C.dim }] },
    ];
    if (links && links.length) {
      const lr = [{ text: '\u2192 ', color: C.comment, size: SMALL }];
      links.forEach((l, i) => {
        if (i) lr.push({ text: '   ', color: C.fg, size: SMALL });
        lr.push({ text: l.label, color: C.link, url: l.url, size: SMALL });
      });
      rows.push({ indent: 44, size: SMALL, runs: lr });
    }
    return rows;
  };
  return [
    { runs: [{ text: '# engineered infrastructure & defensive systems', color: C.comment }] },
    { runs: [{ text: 'A compilation of DevOps write-ups & pipeline implementations.', color: C.dim }] },
    { gap: 16 },
    ...proj(1, 'Python CI/CD Pipeline: Errors, False Positives & Lessons Learned',
      'Environment drift, dependency management and scanner false positives.',
      [{ label: 'Medium', url: 'https://medium.com/@zalfd/building-a-python-ci-cd-pipeline-errors-false-positives-and-lessons-learned-f75743c833bb' }]),
    ...proj(2, 'Centralized Logging with ELK Stack & Docker on Minimal Hardware',
      'Resource-efficient Elasticsearch, Logstash, Kibana via Docker-Compose.',
      [{ label: 'Medium', url: 'https://medium.com/@zalfd/building-a-centralized-logging-system-with-elk-stack-docker-on-minimal-hardware-72ee2b960ccb' }]),
    ...proj(3, 'Blocking SSH Brute Force with Active Response in Wazuh',
      'Detect SSH brute-force attacks and block host IPs in real time.',
      [{ label: 'Medium', url: 'https://medium.com/@zalfd/blocking-ssh-brute-force-with-active-response-in-wazuh-a8aadac34251' }]),
    ...proj(4, 'Automated Threat Response: Apache Log to Firewall Block',
      'SOC home lab: Wazuh + n8n + VirusTotal + iptables.',
      [{ label: 'GitHub', url: 'https://github.com/zalf179/SOC_Home_Lab' }]),
    ...proj(5, 'Enterprise-Grade DevSecOps & GitOps Pipeline with ArgoCD',
      'Code to monitoring: SonarQube, Gitleaks, Trivy, ArgoCD, Prometheus.',
      [
        { label: 'Medium', url: 'https://medium.com/@zalfd/building-an-enterprise-grade-devsecops-gitops-pipeline-from-code-to-monitoring-with-argocd-78204a02bf25' },
        { label: 'app repo', url: 'https://github.com/flazel/learn_ci-cd' },
        { label: 'gitops repo', url: 'https://github.com/flazel/learn_ci-cd-gitops' },
      ]),
  ];
}

function contactContent() {
  const row = (label, value, url) => ({
    size: SMALL,
    runs: [
      { text: '[+] ', color: C.green, weight: 700 },
      { text: label.padEnd(11, ' '), color: C.fg, weight: 500 },
      url ? { text: value, color: C.link, url } : { text: value, color: C.fg },
    ],
  });
  return [
    { runs: [{ text: PROMPT + ' ', color: C.green, weight: 700 }, { text: './get_contact_info.sh', color: C.fg }] },
    { gap: 18 },
    row('GitHub', 'github.com/zalf179', 'https://github.com/zalf179'),
    row('LinkedIn', 'linkedin.com/in/rizalfadh', 'https://www.linkedin.com/in/rizalfadh/'),
    row('Medium', 'medium.com/@zalfd', 'https://medium.com/@zalfd'),
    row('Resume', 'Resume.pdf', 'Resume.pdf'),
    row('Email', 'muhammadrizalfadhillah@gmail.com', 'mailto:muhammadrizalfadhillah@gmail.com'),
    { gap: 18 },
    { runs: [{ text: 'Ready to Secure Your Velocity?', color: C.accent, weight: 700, size: 40 }] },
    { runs: [{ text: 'Open to architectural consultation, pipeline auditing, or', color: C.dim, size: SMALL }] },
    { runs: [{ text: 'senior-level DevSecOps positions. Let\'s build something unbreakable.', color: C.dim, size: SMALL }] },
    { gap: 14 },
    { runs: [{ text: '\u25cf ', color: C.green, size: SMALL }, { text: '[STATUS] Ready for encrypted communications.', color: C.green, size: SMALL }] },
  ];
}

const CONTENT = {
  home: whoamiContent,
  skills: skillsContent,
  projects: projectsContent,
  contact: contactContent,
};

// ----------------------------------------------------------------- drawing
const PAD_X = 84;
const PAD_Y = 150;
const LINE = 52;

function totalChars(lines) {
  let n = 0;
  for (const l of lines) {
    for (const r of l.runs || []) n += r.text.length;
  }
  return n;
}

// Draws `lines`, revealing at most `reveal` characters (Infinity = all),
// collecting clickable hit-rects (canvas px) into `hitRects`.
function drawLines(ctx, lines, reveal, hitRects) {
  let y = PAD_Y;
  let remaining = reveal;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (const line of lines) {
    let size = line.size || BODY;
    if (line.gap) y += line.gap;
    if (!line.runs) continue;

    let x = PAD_X + (line.indent || 0);
    const lh = line.size ? Math.max(LINE, size + 16) : LINE;

    for (const run of line.runs) {
      const s = run.size || size;
      const weight = run.weight || 400;
      ctx.font = `${weight} ${s}px ${FONT}`;
      ctx.fillStyle = run.color || C.fg;

      const len = run.text.length;
      if (remaining <= 0) {
        x += ctx.measureText(run.text).width;
        continue;
      }
      const show = remaining >= len ? run.text : run.text.slice(0, remaining);
      ctx.fillText(show, x, y);

      if (run.url && remaining >= len) {
        const w = ctx.measureText(run.text).width;
        hitRects.push({ x, y, w, h: s * 1.25, url: run.url, label: run.text });
      }
      x += ctx.measureText(run.text).width;
      remaining -= len;
    }
    y += lh;
  }
  return { endY: y, cursorX: 0 };
}

function drawChrome(ctx, title) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // faint scanline texture
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let yy = 0; yy < H; yy += 4) ctx.fillRect(0, yy, W, 1);

  // title bar
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = C.frame;
  ctx.fillRect(0, 96, W, 3);

  const dots = [C.red, C.warn, C.green];
  dots.forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(48 + i * 42, 48, 13, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = C.comment;
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 200, 50);
  ctx.textBaseline = 'top';
}

// ----------------------------------------------------------------- screens
export function createScreens({ renderer, stops, screens, onNeedsRender }) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const items = [];

  for (const stop of stops) {
    const mesh = screens.byName.get(stop.mesh);
    if (!mesh) {
      console.warn('[screens] mesh not found:', stop.mesh);
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAniso;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    // glTF screen quads use v=1 at the geometric top, so the canvas must be
    // flipped on upload (CanvasTexture default) to sit upright on the screen.
    texture.flipY = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    mesh.material = material;

    const item = {
      stop,
      mesh,
      title: stop.id === 'contact' ? 'contact.sh' : `${stop.id}.${stop.id === 'skills' ? 'conf' : stop.id === 'home' ? 'sh' : 'md'}`,
      lines: CONTENT[stop.id](),
      canvas,
      ctx,
      texture,
      hitRects: [],
      reveal: Infinity,
      chars: 0,
      dirty: true,
    };
    item.chars = totalChars(item.lines);

    // If the mesh somehow lacks UVs, fall back to a plane over its bounds.
    const uv = mesh.geometry.getAttribute('uv');
    if (!uv) {
      console.warn('[screens] no UVs on', stop.mesh, '- adding overlay plane');
      addOverlayPlane(item);
    }

    items.push(item);
  }

  function addOverlayPlane(item) {
    const geo = item.mesh.geometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), item.mesh.material);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    plane.position.copy(centre);
    plane.position.z += 0.001;
    item.mesh.add(plane);
  }

  function redraw(item) {
    item.hitRects.length = 0;
    drawChrome(item.ctx, item.title);
    drawLines(item.ctx, item.lines, item.reveal, item.hitRects);
    item.texture.needsUpdate = true;
    item.dirty = false;
  }

  function drawAll() {
    for (const it of items) redraw(it);
    onNeedsRender && onNeedsRender();
  }

  // Stage 4 will animate `reveal`; for now everything is fully drawn.
  function setActive(id) {
    const it = items.find((i) => i.stop.id === id);
    if (!it) return;
    if (it.reveal !== Infinity) {
      it.reveal = Infinity;
      it.dirty = true;
    }
  }

  function update() {
    let changed = false;
    for (const it of items) {
      if (it.dirty) { redraw(it); changed = true; }
    }
    if (changed) onNeedsRender && onNeedsRender();
  }

  return {
    items,
    drawAll,
    setActive,
    update,
    redraw,
    getByMesh: (name) => items.find((i) => i.mesh.name === name),
  };
}
