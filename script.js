/* ─────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────── */
const TOTAL_FRAMES = 75;
const FRAME_PATH = i => `sequence/frame_${String(i).padStart(2, '0')}_delay-0.067s.png`;


/* ─────────────────────────────────────────────────
   ELEMENTS
───────────────────────────────────────────────── */
const canvas = document.getElementById('scrolly-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('scrolly-container');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const panel1 = document.getElementById('panel-1');
const panel2 = document.getElementById('panel-2');
const panel3 = document.getElementById('panel-3');

/* ─────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────── */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));

/* ─────────────────────────────────────────────────
   YEAR
───────────────────────────────────────────────── */
document.getElementById('year').textContent = new Date().getFullYear();

/* ─────────────────────────────────────────────────
   CANVAS RESIZE
───────────────────────────────────────────────── */
let images = [];
let currentFrame = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  drawFrame(currentFrame);
});

/* ─────────────────────────────────────────────────
   DRAW FRAME  (object-fit: cover behaviour)
───────────────────────────────────────────────── */
function drawFrame(index, alpha = 1) {
  if (!images.length) return;

  const img = images[Math.min(Math.round(index), TOTAL_FRAMES - 1)];
  if (!img || !img.complete) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const canvasRatio = cw / ch;
  const imgRatio = img.naturalWidth / img.naturalHeight;

  // Scale image to cover the canvas
  let dw = cw, dh = ch, ox = 0, oy = 0;
  if (canvasRatio > imgRatio) {
    dh = cw / imgRatio;
    oy = (ch - dh) / 2;
  } else {
    dw = ch * imgRatio;
    ox = (cw - dw) / 2;
  }

  ctx.clearRect(0, 0, cw, ch);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────────
   PRELOAD IMAGES
───────────────────────────────────────────────── */
function preload() {
  return new Promise(resolve => {
    images = new Array(TOTAL_FRAMES);
    let loaded = 0;
    let successCount = 0;
    const timeout = setTimeout(() => {
      // If taking too long, resolve anyway
      resolve(successCount > 0);
    }, 5000);

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      images[i] = img;

      const onDone = (success) => {
        loaded++;
        if (success) successCount++;
        loaderBar.style.width = (loaded / TOTAL_FRAMES * 100) + '%';
        if (loaded === TOTAL_FRAMES) {
          clearTimeout(timeout);
          resolve(successCount > 0);
        }
      };

      img.onload = () => onDone(true);
      img.onerror = () => onDone(false);
    }
  });
}

/* ─────────────────────────────────────────────────
   OVERLAY ANIMATION
   Calculates opacity and translateY for a panel
   based on scroll progress through [inStart → peak → outEnd].
───────────────────────────────────────────────── */
function getPanelStyle(progress, inStart, peak, outEnd, yFrom, yTo) {
  let opacity;
  if (progress < inStart) opacity = 0;
  else if (progress < peak) opacity = (progress - inStart) / (peak - inStart);
  else if (progress <= outEnd) opacity = 1 - (progress - peak) / (outEnd - peak);
  else opacity = 0;

  const t = clamp01((progress - inStart) / (outEnd - inStart));
  const y = lerp(yFrom, yTo, t);

  return { opacity: clamp01(opacity), y };
}

function updateOverlay(progress) {
  // Panel 1: fully visible at start (inStart=-0.01 ensures opacity=1 at progress=0), fades out by 20%
  const p1 = getPanelStyle(progress, -0.01, 0, 0.2, 0, -50);
  panel1.style.opacity = p1.opacity;
  panel1.style.transform = `translateY(${p1.y}px)`;

  // Panel 2: fades in 20→30%, out 30→40%
  const p2 = getPanelStyle(progress, 0.2, 0.3, 0.4, 50, -50);
  panel2.style.opacity = p2.opacity;
  panel2.style.transform = `translateY(${p2.y}px)`;

  // Panel 3: fades in 50→60%, out 60→70%
  const p3 = getPanelStyle(progress, 0.5, 0.6, 0.7, 50, -50);
  panel3.style.opacity = p3.opacity;
  panel3.style.transform = `translateY(${p3.y}px)`;
}

/* ─────────────────────────────────────────────────
   SCROLL HANDLER
───────────────────────────────────────────────── */
function onScroll() {
  const rect = container.getBoundingClientRect();
  const scrolled = -rect.top;                       // px scrolled into container
  const total = rect.height - window.innerHeight; // total scrollable px
  const progress = clamp01(scrolled / total);

  // freeze / unfreeze logic (pin the last frame when close to the end)
  if (!isFrozen && progress >= FREEZE_THRESHOLD) {
    freezeAtLastFrame();
  } else if (isFrozen && progress < FREEZE_THRESHOLD) {
    unfreeze();
  }

  // only update frames if not frozen
  if (!isFrozen) {
    const frameIdx = progress * (TOTAL_FRAMES - 1);
    if (Math.round(frameIdx) !== Math.round(currentFrame)) {
      currentFrame = frameIdx;
      drawFrame(currentFrame);
    }
  }

  updateOverlay(progress);
}


/* ─────────────────────────────────────────────────
   BIDIRECTIONAL SCROLL REVEAL SYSTEM
   • 30%+ visible from bottom  → appear (fade + slide up)
   • 30%-  visible from top    → disappear (fade + slide up)
───────────────────────────────────────────────── */
function setupObserver() {

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const el = entry.target;
      const rect = entry.boundingClientRect;
      const vh = window.innerHeight;

      if (entry.intersectionRatio >= 0.3) {
        // ── ENTER: 30%+ visible → reveal ──
        const savedDelay = el.dataset.revealDelay || '0s';
        el.style.transitionDelay = savedDelay;
        el.classList.add('visible');
        el.classList.remove('exit-top');

        // After entry transition finishes, clear delay so hover feels instant
        const delayMs = parseFloat(savedDelay) * 1000;
        setTimeout(() => {
          if (el.classList.contains('visible')) {
            el.style.transitionDelay = '0s';
          }
        }, delayMs + 600);

      } else if (!entry.isIntersecting && rect.bottom < vh * 0.3) {
        // ── EXIT TOP: scrolled past top → dismiss upward ──
        el.style.transitionDelay = '0s';
        el.classList.remove('visible');
        el.classList.add('exit-top');

      } else if (!entry.isIntersecting && rect.top > vh) {
        // ── RESET: element is below viewport → back to entry state ──
        el.style.transitionDelay = el.dataset.revealDelay || '0s';
        el.classList.remove('visible');
        el.classList.remove('exit-top');
      }
    });
  }, {
    threshold: [0, 0.1, 0.2, 0.3]
  });

  // ── Register an element for bidirectional reveal ──
  function reveal(el, type = 'up', delay = 0) {
    if (!el) return;
    const delayStr = delay > 0 ? `${delay}s` : '0s';
    el.dataset.revealDelay = delayStr;
    el.style.transitionDelay = delayStr;
    el.classList.add(`reveal-${type}`);
    observer.observe(el);
  }

  // ── Register an element that already has its own CSS reveal state ──
  function revealNative(el, delay = 0) {
    if (!el) return;
    const delayStr = delay > 0 ? `${delay}s` : '0s';
    el.dataset.revealDelay = delayStr;
    el.style.transitionDelay = delayStr;
    observer.observe(el);
  }

  // ─── ABOUT SECTION ────────────────────────────
  reveal(document.querySelector('.about-title'), 'up', 0);
  reveal(document.querySelector('.about-bio'), 'up', 0.1);
  reveal(document.querySelector('.about-author-row'), 'up', 0.2);
  // Individual stats (direct children of section, no opacity-hidden parent)
  document.querySelectorAll('.about-stat').forEach((stat, i) => {
    reveal(stat, 'up', 0.28 + i * 0.08);
  });
  // Social bar + individual links
  reveal(document.querySelector('.about-social-bar'), 'up', 0.15);
  document.querySelectorAll('.about-social-link').forEach((link, i) => {
    reveal(link, 'up', 0.2 + i * 0.06);
  });

  // ─── EXPERIENCE SECTION ────────────────────────
  reveal(document.querySelector('.exp-title'), 'up', 0);
  reveal(document.querySelector('.exp-summary'), 'up', 0.1);
  // Cards only (NOT their children — parent starts at opacity:0, so child
  // animations would complete invisibly)
  document.querySelectorAll('.exp-item').forEach((item, i) => {
    revealNative(item, i * 0.15);
  });

  // ─── SECTION BADGES / HEADINGS ─────────────────
  document.querySelectorAll('.section-badge').forEach((badge, i) => {
    reveal(badge, 'up', i * 0.05);
  });

  // ─── BENTO CARDS (My Expertise) ────────────────
  // Cards only (children inherit parent's opacity)
  document.querySelectorAll('.bento-card').forEach((card, i) => {
    revealNative(card, i * 0.1);
  });

  // ─── STACK CARDS (Favourite Stack) ─────────────
  // Cards only (children inherit parent's opacity)
  document.querySelectorAll('.stack-card').forEach((card, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    revealNative(card, (row * 0.1) + (col * 0.06));
  });

  // ─── CONTACT SECTION ───────────────────────────
  reveal(document.querySelector('.contact-title'), 'up', 0);
  reveal(document.querySelector('.contact-desc'), 'up', 0.1);
  // Form inputs individually
  document.querySelectorAll('.form-group').forEach((group, i) => {
    reveal(group, 'up', 0.15 + i * 0.08);
  });
  reveal(document.querySelector('.submit-btn'), 'up', 0.4);
  // Right side (not nested — contact-right is a direct section child)
  reveal(document.querySelector('.contact-right'), 'right', 0.12);

  // ─── FOOTER ─────────────────────────────────────
  document.querySelectorAll('.footer-col').forEach((col, i) => {
    reveal(col, 'up', i * 0.1);
  });
  reveal(document.querySelector('.footer-bottom'), 'up', 0.15);
}

/* ─────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────
   FREEZE LAST FRAME AT END OF SCROLL
───────────────────────────────────────────────── */

const overlay = document.getElementById('overlay');

const FREEZE_THRESHOLD = 0.995; // when progress >= this, freeze the last frame
let isFrozen = false;

function freezeAtLastFrame() {
  if (isFrozen) return;
  isFrozen = true;

  // draw the very last frame and pin the canvas
  currentFrame = TOTAL_FRAMES - 1;
  drawFrame(currentFrame);

  canvas.classList.add('frozen');
  document.getElementById('sticky-viewport').classList.add('frozen-viewport');
  overlay.classList.add('panels-hidden');

  // ensure canvas sits behind sections (optional explicit zIndex)
  canvas.style.zIndex = 5;
}

function unfreeze() {
  if (!isFrozen) return;
  isFrozen = false;

  canvas.classList.remove('frozen');
  document.getElementById('sticky-viewport').classList.remove('frozen-viewport');
  overlay.classList.remove('panels-hidden');
  canvas.style.zIndex = '';
  // ensure we repaint to match current scroll position
  onScroll();
}

/* ─────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────── */

// Set initial panel states before images load
panel1.style.opacity = '1';
panel1.style.transform = 'translateY(0)';
panel2.style.opacity = '0';
panel2.style.transform = 'translateY(50px)';
panel3.style.opacity = '0';
panel3.style.transform = 'translateY(50px)';

// Add fallback gradient background to canvas
canvas.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)';

setupObserver();

// Hide loader immediately and start
loader.classList.add('hidden');
window.addEventListener('scroll', onScroll, { passive: true });
onScroll(); // sync initial state

// Try to preload frames in background
preload().then((hasFrames) => {
  if (hasFrames) {
    let alpha = 0;
    const fade = () => {
      alpha += 0.03;
      if (alpha >= 1) {
        drawFrame(0, 1);
        return;
      }
      drawFrame(0, alpha);
      requestAnimationFrame(fade);
    };
    fade();
  }
});

/* ─────────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────────── */
(function () {
  const navbar = document.getElementById('navbar');
  const links = document.querySelectorAll('.nav-link');
  const indicator = document.querySelector('.nav-indicator');

  // Show navbar after a short delay on load
  setTimeout(() => navbar.classList.add('visible'), 800);

  // Move the sliding indicator to a given link
  function moveIndicator(link) {
    const pillRect = document.querySelector('.nav-pill').getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    indicator.style.width = linkRect.width + 'px';
    indicator.style.transform = `translateX(${linkRect.left - pillRect.left - 4}px)`;
  }

  // Set active link + move indicator
  function setActive(link) {
    links.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    moveIndicator(link);
  }

  // Init indicator on first active link
  window.addEventListener('load', () => {
    const active = document.querySelector('.nav-link.active');
    if (active) moveIndicator(active);
  });

  // Click handler — smooth scroll + active state
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      setActive(link);
    });
  });

  // Hover preview
  links.forEach(link => {
    link.addEventListener('mouseenter', () => moveIndicator(link));
    link.addEventListener('mouseleave', () => {
      const active = document.querySelector('.nav-link.active');
      if (active) moveIndicator(active);
    });
  });

  // Scroll spy — highlight correct section
  const sections = [
    { id: 'scrolly-container', link: document.querySelector('[data-section="home"]') },
    { id: 'about', link: document.querySelector('[data-section="about"]') },
    { id: 'experience', link: document.querySelector('[data-section="experience"]') },
    { id: 'contact', link: document.querySelector('[data-section="contact"]') },
  ];

  function scrollSpy() {
    const mid = window.innerHeight / 2;
    let current = sections[0].link;
    sections.forEach(({ id, link }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= mid) current = link;
    });

    if (!current.classList.contains('active')) setActive(current);
  }

  window.addEventListener('scroll', scrollSpy, { passive: true });
  scrollSpy();
})();

/* ─────────────────────────────────────────────────
   SMOOTH SCROLL FOR ANCHOR LINKS
───────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

/* ─────────────────────────────────────────────────
   FORM INTERACTIONS
───────────────────────────────────────────────── */
const formInputs = document.querySelectorAll('.form-control');
formInputs.forEach(input => {
  input.addEventListener('focus', () => {
    input.parentElement.classList.add('focused');
  });
  input.addEventListener('blur', () => {
    input.parentElement.classList.remove('focused');
  });
});

/* ─────────────────────────────────────────────────
   PARALLAX EFFECT FOR CHARACTER IMAGE
───────────────────────────────────────────────── */
const characterImg = document.querySelector('.character-img');
if (characterImg) {
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * 0.03;
    characterImg.style.transform = `translateY(${rate}px)`;
  }, { passive: true });
}