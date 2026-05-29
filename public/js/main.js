// public/js/main.js
// Haeryong Dinosaur Era — gallery with 2-step caption reveal

(() => {
  // ───── Config ─────────────────────────────────────────────────────────
  const ANNIVERSARY_START = new Date('2025-05-24T00:00:00');
  const AUTO_OPTIONS = [
    { key: 'off', label: 'OFF',  ms: 0     },
    { key: '5s',  label: '5s',   ms: 5000  },
    { key: '10s', label: '10s',  ms: 10000 },
  ];

  // ───── State ──────────────────────────────────────────────────────────
  const state = {
    posts: [],
    index: 0,
    captionStage: 0,    // 0 = hidden, 1 = nickname only, 2 = full description
    autoIdx: 0,         // index in AUTO_OPTIONS (default off)
    autoTimer: null,
    isAnimating: false,
    isInteracting: false,
  };

  // ───── Elements ───────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const stage      = $('stage');
  const plate      = $('plate');
  const viewport   = $('viewport');
  const intro      = $('intro');
  const introStart = $('introStart');
  const introDday  = $('introDday');
  const empty      = $('empty');
  const prevBtn    = $('prevBtn');
  const nextBtn    = $('nextBtn');
  const countEl    = $('topbarCount');
  const plateNum   = $('plateNum');
  const plateTotal = $('plateTotal');

  const caption    = $('caption');
  const capPrompt  = $('capPrompt');
  const capName    = $('capName');
  const capDesc    = $('capDesc');
  const capSpecies = $('capSpecies');
  const capSpecies2 = $('capSpecies2');
  const capBody    = $('capBody');
  const capDate    = $('capDate');

  const menuBtn    = $('menuBtn');
  const menuPanel  = $('menuPanel');
  const menuAuto   = $('menuAuto');
  const menuAutoLabel = $('menuAutoLabel');
  const menuMusic  = $('menuMusic');
  const menuMusicLabel = $('menuMusicLabel');
  const menuRestart = $('menuRestart');

  const bgm = $('bgm');

  // ───── Utilities ──────────────────────────────────────────────────────
  function dayCount() {
    const now = new Date();
    const diff = now.setHours(0,0,0,0) - new Date(ANNIVERSARY_START).setHours(0,0,0,0);
    return Math.floor(diff / 86400000) + 1; // day 1 is the start date itself
  }

  function formatCaptured(s) {
    if (!s) return '';
    // Accept ISO or freeform — pass through if not parseable
    const d = new Date(s);
    if (!isNaN(d) && s.length >= 8) {
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return s;
  }

  function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
  }

  // ───── Boot ───────────────────────────────────────────────────────────
  async function boot() {
    introDday.textContent = `Day ${dayCount()}`;

    try {
      const res = await fetch('/api/posts');
      const all = await res.json();
      // Keep #1 fixed, shuffle the rest
      state.posts = all.length > 1
        ? [all[0], ...shuffle(all.slice(1))]
        : all;
    } catch (e) {
      console.error(e);
    }

    introStart.addEventListener('click', startGallery);
    bindEvents();
  }

  function startGallery() {
    intro.classList.add('is-leaving');
    setTimeout(() => {
      intro.hidden = true;
      if (state.posts.length === 0) {
        empty.hidden = false;
        return;
      }
      stage.hidden = false;
      renderSlides();
      show(0, { silent: true });
      startAuto();
    }, 480);
  }

  // ───── Render ─────────────────────────────────────────────────────────
  function renderSlides() {
    viewport.innerHTML = '';
    state.posts.forEach((p, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;

      const img = document.createElement('img');
      img.className = 'slide__img';
      img.src = p.image_url;
      img.alt = `Specimen ${i + 1}`;
      img.draggable = false;
      slide.appendChild(img);

      // Tap on slide → advance caption stage
      slide.addEventListener('click', advanceCaption);
      viewport.appendChild(slide);
    });
    plateTotal.textContent = String(state.posts.length).padStart(2, '0');
  }

  function updateCount() {
    const total = state.posts.length;
    countEl.textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    plateNum.textContent = String(state.index + 1).padStart(2, '0');
  }

  // ───── Caption stages ─────────────────────────────────────────────────
  function setCaptionStage(stage) {
    state.captionStage = stage;
    capPrompt.hidden = stage !== 0;
    capName.hidden   = stage !== 1;
    capDesc.hidden   = stage !== 2;

    const p = state.posts[state.index];
    if (!p) return;

    if (stage === 1) {
      capSpecies.textContent = p.nickname;
    } else if (stage === 2) {
      capSpecies2.textContent = p.nickname;
      capBody.textContent = p.description || '';
      capDate.textContent = p.captured_at ? formatCaptured(p.captured_at) : '';
      // hide meta if no date
      capDate.parentElement.style.display = p.captured_at ? '' : 'none';
    }
  }

  function advanceCaption() {
    if (state.captionStage === 0) {
      setCaptionStage(1);
      stopAuto();             // stop autoplay once user engages
    } else if (state.captionStage === 1) {
      setCaptionStage(2);
    } else {
      // Already at full — collapse back to stage 0 so they can re-quiz
      setCaptionStage(0);
    }
  }

  // ───── Navigation ─────────────────────────────────────────────────────
  function show(nextIndex, { dir = 'fade', silent = false } = {}) {
    if (state.isAnimating) return;
    const total = state.posts.length;
    if (total === 0) return;
    const next = ((nextIndex % total) + total) % total;
    const prev = state.index;
    if (next === prev && !silent) return;

    const slides = viewport.querySelectorAll('.slide');
    const prevEl = slides[prev];
    const nextEl = slides[next];

    if (silent) {
      slides.forEach((s) => s.classList.remove('is-active', 'swipe-active',
        'swipe-enter-left', 'swipe-enter-right', 'swipe-exit-left', 'swipe-exit-right'));
      nextEl.classList.add('is-active');
      state.index = next;
      updateCount();
      setCaptionStage(0);  // reset caption on slide change
      return;
    }

    state.isAnimating = true;

    if (dir === 'fade') {
      nextEl.classList.add('is-active');
      prevEl && prevEl.classList.remove('is-active');
      setTimeout(() => { state.isAnimating = false; }, 820);
    } else {
      const enter = dir === 'next' ? 'swipe-enter-right' : 'swipe-enter-left';
      const exit  = dir === 'next' ? 'swipe-exit-left'   : 'swipe-exit-right';

      nextEl.classList.add(enter);
      void nextEl.offsetWidth;
      nextEl.classList.add('swipe-active');
      nextEl.classList.add('is-active');
      nextEl.classList.remove(enter);

      if (prevEl) {
        prevEl.classList.add(exit);
        setTimeout(() => {
          prevEl.classList.remove('is-active', 'swipe-active',
            'swipe-enter-left', 'swipe-enter-right', 'swipe-exit-left', 'swipe-exit-right');
        }, 500);
      }

      setTimeout(() => {
        nextEl.classList.remove('swipe-active');
        state.isAnimating = false;
      }, 500);
    }

    state.index = next;
    updateCount();
    setCaptionStage(0);  // reset caption stage on every slide change
  }

  function next() { show(state.index + 1, { dir: 'next' }); }
  function prev() { show(state.index - 1, { dir: 'prev' }); }

  // ───── Autoplay ───────────────────────────────────────────────────────
  function startAuto() {
    stopAuto();
    const opt = AUTO_OPTIONS[state.autoIdx];
    if (opt.ms === 0) return;
    state.autoTimer = setInterval(() => {
      if (state.isInteracting) return;
      if (state.captionStage !== 0) return;  // pause when reading caption
      show(state.index + 1, { dir: 'fade' });
    }, opt.ms);
  }
  function stopAuto() {
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
  }
  function resetAuto() { startAuto(); }

  function cycleAuto() {
    state.autoIdx = (state.autoIdx + 1) % AUTO_OPTIONS.length;
    menuAutoLabel.textContent = AUTO_OPTIONS[state.autoIdx].label;
    startAuto();
  }

  // ───── Nav auto-hide ──────────────────────────────────────────────────
  let navHideTimer = null;
  function showNav() {
    prevBtn.classList.add('is-visible');
    nextBtn.classList.add('is-visible');
    if (navHideTimer) clearTimeout(navHideTimer);
    navHideTimer = setTimeout(() => {
      prevBtn.classList.remove('is-visible');
      nextBtn.classList.remove('is-visible');
    }, 2800);
  }

  // ───── Bind events ────────────────────────────────────────────────────
  function bindEvents() {
    // Menu toggle
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuPanel.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded',
        menuPanel.classList.contains('is-open') ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!menuPanel.classList.contains('is-open')) return;
      if (!menuPanel.contains(e.target) && !menuBtn.contains(e.target)) {
        menuPanel.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Menu items
    menuAuto.addEventListener('click', (e) => { e.stopPropagation(); cycleAuto(); });
    menuMusic.addEventListener('click', (e) => { e.stopPropagation(); toggleMusic(); });
    menuRestart.addEventListener('click', (e) => {
      e.stopPropagation();
      menuPanel.classList.remove('is-open');
      if (state.posts.length === 0) return;
      show(0, { silent: true });
      stopAuto();
      startAuto();
    });

    // Nav
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prev(); resetAuto(); showNav(); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); resetAuto(); showNav(); });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (intro && !intro.hidden) {
        if (e.key === 'Enter' || e.key === ' ') startGallery();
        return;
      }
      if (e.key === 'ArrowLeft')  { prev(); resetAuto(); showNav(); }
      if (e.key === 'ArrowRight') { next(); resetAuto(); showNav(); }
      if (e.key === ' ') { e.preventDefault(); advanceCaption(); }
    });

    // Touch swipe on stage
    let startX = 0, startY = 0, dx = 0, dy = 0, touching = false;
    stage.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      dx = dy = 0; touching = true;
      state.isInteracting = true;
      showNav();
    }, { passive: true });
    stage.addEventListener('touchmove', (e) => {
      if (!touching) return;
      const t = e.touches[0];
      dx = t.clientX - startX;
      dy = t.clientY - startY;
    }, { passive: true });
    stage.addEventListener('touchend', () => {
      if (!touching) return;
      touching = false;
      state.isInteracting = false;
      const threshold = 50;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0) next(); else prev();
        resetAuto();
      }
    });

    // Desktop: show nav on mouse move
    stage.addEventListener('mousemove', () => showNav());
  }

  // ───── BGM ────────────────────────────────────────────────────────────
  let bgmFadeTimer = null;
  function toggleMusic() {
    if (!bgm) return;
    if (!bgm.paused) {
      fadeBgm(0, () => bgm.pause());
      menuMusic.classList.remove('is-playing');
      menuMusicLabel.textContent = 'BGM 켜기';
    } else {
      bgm.play().then(() => {
        fadeBgm(0.4);
        menuMusic.classList.add('is-playing');
        menuMusicLabel.textContent = 'BGM 끄기';
      }).catch((err) => { console.warn('BGM play failed:', err); });
    }
  }
  function fadeBgm(target, onDone) {
    if (bgmFadeTimer) clearInterval(bgmFadeTimer);
    const step = (target > bgm.volume ? 1 : -1) * 0.04;
    bgmFadeTimer = setInterval(() => {
      const next = bgm.volume + step;
      if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
        bgm.volume = target;
        clearInterval(bgmFadeTimer);
        bgmFadeTimer = null;
        if (onDone) onDone();
      } else {
        bgm.volume = Math.max(0, Math.min(1, next));
      }
    }, 60);
  }
  if (bgm) bgm.volume = 0;

  document.addEventListener('DOMContentLoaded', boot);
})();
