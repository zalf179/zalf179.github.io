import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.screens.colors;
const FONT = CONFIG.screens.font;
const W = CONFIG.screens.canvasWidth;
const H = CONFIG.screens.canvasHeight;

const REDUCED = globalThis.matchMedia
  ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// ----------------------------------------------------------------- content
// A stop is a list of lines. A line is { indent, size, gap, runs:[...] }.
// A run is { text, color, weight, size, url }; `url` makes it a clickable link.
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
    indent: 40, size: SMALL,
    runs: [{ text: k.padEnd(12, ' '), color: C.accent, weight: 500 }, { text: v, color }],
  });
  const head = (t) => ({ gap: 10, runs: [{ text: '> ' + t, color: C.green, weight: 700, size: 38 }] });
  const note = (t) => ({ indent: 40, size: SMALL, runs: [{ text: t, color: C.comment }] });
  const row = (k, v) => ({
    indent: 40, size: SMALL,
    runs: [{ text: k.padEnd(12, ' '), color: C.fg, weight: 700 }, { text: v, color: C.dim }],
  });
  return [
    { runs: [{ text: '# technical stack & strategic insights', color: C.comment }] },
    { runs: [{ text: 'Architecting secure, resilient infrastructure.', color: C.dim }] },
    { gap: 18 },
    head('SECURITY'),
    row('DAST/SAST', 'automated vuln scans, dependency auditing, container scanning'),
    row('Pentesting', 'network/application security evaluation, threat emulation'),
    row('SIEM/SOC', 'intrusion monitoring, threat hunting, log aggregation'),
    head('CLOUD'),
    kv('AWS', 'Learning', C.warn),
    kv('Azure', 'Planned', C.dim),
    kv('GCP', 'Planned', C.dim),
    head('DEVOPS'),
    note('Docker  Kubernetes  Terraform  Ansible  GitHub Actions'),
    { indent: 40, size: SMALL, runs: [{ text: 'IaC'.padEnd(12, ' '), color: C.accent, weight: 500 }, { text: 'version-controlled, peer-reviewed cloud environments', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'DevSecOps'.padEnd(12, ' '), color: C.accent, weight: 500 }, { text: 'vuln scans + policy gates inside CI/CD', color: C.dim }] },
    { indent: 40, size: SMALL, runs: [{ text: 'Containers'.padEnd(12, ' '), color: C.accent, weight: 500 }, { text: 'image hardening, admission control, signing, runtime', color: C.dim }] },
  ];
}

function projectsContent() {
  const proj = (n, title, desc, links) => {
    const rows = [
      { gap: 12, runs: [{ text: `[${n}] `, color: C.green, weight: 700 }, { text: title, color: C.fg, weight: 700, size: 36 }] },
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
    { runs: [{ text: "senior-level DevSecOps positions. Let's build something unbreakable.", color: C.dim, size: SMALL }] },
    { gap: 14 },
    { runs: [{ text: '\u25cf ', color: C.green, size: SMALL }, { text: '[STATUS] Ready for encrypted communications.', color: C.green, size: SMALL }] },
  ];
}

const CONTENT = { home: whoamiContent, skills: skillsContent, projects: projectsContent, contact: contactContent };

// ----------------------------------------------------------------- drawing
const PAD_X = 84;
const PAD_Y = 150;
const LINE = 52;

function totalChars(lines) {
  let n = 0;
  for (const l of lines) for (const r of l.runs || []) n += r.text.length;
  return n;
}

// Draws `lines`, revealing at most `reveal` chars (Infinity = all), and
// collecting clickable hit-rects (canvas px) into `hitRects`.
function drawLines(ctx, lines, reveal, hitRects) {
  let y = PAD_Y;
  let remaining = reveal;
  let cursor = null;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (const line of lines) {
    const size = line.size || BODY;
    if (line.gap) y += line.gap;
    if (!line.runs) continue;

    let x = PAD_X + (line.indent || 0);
    const lh = line.size ? Math.max(LINE, size + 16) : LINE;

    for (const run of line.runs) {
      const s = run.size || size;
      ctx.font = `${run.weight || 400} ${s}px ${FONT}`;
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
      cursor = { x: x - ctx.measureText(run.text).width + ctx.measureText(show).width, y, size: s };
      remaining -= len;
    }
    y += lh;
  }
  return cursor;
}

function drawChrome(ctx, title) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let yy = 0; yy < H; yy += 4) ctx.fillRect(0, yy, W, 1);

  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = C.frame;
  ctx.fillRect(0, 96, W, 3);

  [C.red, C.warn, C.green].forEach((col, i) => {
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

const TITLES = { home: 'home.sh', skills: 'skills.conf', projects: 'projects.md', contact: 'contact.sh' };

// ----------------------------------------------------------------- screens
export function createScreens({ renderer, stops, screens, onNeedsRender }) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const items = [];
  let activeId = null;

  for (const stop of stops) {
    const mesh = screens.byName.get(stop.mesh);
    if (!mesh) { console.warn('[screens] mesh not found:', stop.mesh); continue; }

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
    // glTF screen quads use v=1 at the geometric top, so flip on upload.
    texture.flipY = true;

    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    mesh.material = material;

    const item = {
      stop, mesh, title: TITLES[stop.id] || stop.id,
      lines: CONTENT[stop.id](),
      canvas, ctx, texture, material,
      hitRects: [], reveal: Infinity, chars: 0,
      typing: false, tStart: null, blinkOn: true, dirty: true,
    };
    item.chars = totalChars(item.lines);
    items.push(item);
  }

  const byMesh = new Map(items.map((i) => [i.mesh, i]));
  const pickMeshes = items.map((i) => i.mesh);

  function redraw(item) {
    item.hitRects.length = 0;
    drawChrome(item.ctx, item.title);
    const cursor = drawLines(item.ctx, item.lines, item.reveal, item.hitRects);

    if (item.stop.id === activeId && cursor && item.blinkOn) {
      const ctx = item.ctx;
      ctx.font = `400 ${cursor.size}px ${FONT}`;
      const cw = ctx.measureText('M').width * 0.62;
      ctx.fillStyle = C.green;
      ctx.fillRect(cursor.x + 2, cursor.y + 2, cw, cursor.size);
    }
    item.texture.needsUpdate = true;
    item.dirty = false;
  }

  function drawAll() {
    for (const it of items) redraw(it);
    onNeedsRender && onNeedsRender();
  }

  function find(id) { return items.find((i) => i.stop.id === id); }

  function setActive(id) {
    if (activeId && activeId !== id) {
      const prev = find(activeId);
      if (prev) { prev.reveal = Infinity; prev.typing = false; prev.dirty = true; }
    }
    activeId = id;
    const it = find(id);
    if (!it) return;
    if (REDUCED) {
      it.reveal = Infinity;
      it.typing = false;
    } else {
      it.reveal = 0;
      it.typing = true;
      it.tStart = null;
      it.blinkOn = true;
    }
    it.dirty = true;
    onNeedsRender && onNeedsRender();
  }

  // Advance typing + blink. Returns true if any canvas needs a re-render.
  function update(now) {
    let changed = false;
    for (const it of items) {
      if (it.typing && it.stop.id === activeId) {
        if (it.tStart == null) it.tStart = now;
        it.reveal = Math.min(it.chars, (now - it.tStart) / CONFIG.screens.typeMs);
        if (it.reveal >= it.chars) it.typing = false;
        it.dirty = true;
      }
      if (it.stop.id === activeId && !REDUCED) {
        const on = Math.floor(now / CONFIG.screens.blinkMs) % 2 === 0;
        if (on !== it.blinkOn) { it.blinkOn = on; it.dirty = true; }
      }
      if (it.dirty) { redraw(it); changed = true; }
    }
    return changed;
  }

  // ---- link picking -------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(clientX, clientY, camera, domElement) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickMeshes, false);
    for (const h of hits) {
      if (!h.uv) continue;
      const it = byMesh.get(h.object);
      if (!it) continue;
      const cx = h.uv.x * W;
      const cy = (1 - h.uv.y) * H; // flipY texture -> canvas row
      for (const r of it.hitRects) {
        if (cx >= r.x - 6 && cx <= r.x + r.w + 6 && cy >= r.y - 6 && cy <= r.y + r.h + 6) {
          return { url: r.url, label: r.label, stop: it.stop.id };
        }
      }
    }
    return null;
  }

  function dispose() {
    for (const it of items) {
      it.texture.dispose();
      it.material.dispose();
    }
  }

  return { items, drawAll, setActive, update, redraw, pick, dispose, find };
}
