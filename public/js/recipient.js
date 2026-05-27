// public/js/recipient.js
// Gallery for the gift recipient — letters open without password

(() => {
  // ───── State ───────────────────────────────────────────────────────────
  const state = {
    posts: [],
    index: 0,
    autoTimer: null,
    autoMs: 5000,
    isInteracting: false,
    isAnimating: false,
  };

  // ───── Elements ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const stage     = $('stage');
  const viewport  = $('viewport');
  const prevBtn   = $('prevBtn');
  const nextBtn   = $('nextBtn');
  const dotsEl    = $('dots');
  const countEl   = $('topbarCount');
  const emptyEl   = $('empty');

  const sheet         = $('sheet');
  const sheetPanel    = $('sheetPanel');
  const letterAuthor  = $('letterAuthor');
  const letterMessage = $('letterMessage');
  const letterDate    = $('letterDate');

  const toast = $('toast');

  // ───── Utilities ───────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2400);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return '';
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function setHidden(el, hidden) {
    if (hidden) el.setAttribute('aria-hidden', 'true');
    else el.setAttribute('aria-hidden', 'false');
  }

  // ───── Boot ────────────────────────────────────────────────────────────
  async function boot() {
    stage.classList.add('is-loading');
    try {
      const res = await fetch('/api/posts');
      const posts = await res.json();
      state.posts = shuffle(posts);
    } catch (e) {
      console.error(e);
      showToast('데이터를 불러오지 못했어요');
    }

    if (state.posts.length === 0) {
      emptyEl.hidden = false;
      stage.style.display = 'none';
      return;
    }

    renderSlides();
    renderDots();
    updateCount();
    show(0, { silent: true });
    startAuto();
    bindEvents();
    stage.classList.remove('is-loading');
  }

  async function reload() {
    stopAuto();
    try {
      const res = await fetch('/api/posts');
      const posts = await res.json();
      state.posts = shuffle(posts);
      state.index = 0;

      if (state.posts.length === 0) {
        emptyEl.hidden = false;
        stage.style.display = 'none';
      } else {
        emptyEl.hidden = true;
        stage.style.display = '';
        renderSlides();
        renderDots();
        show(0, { silent: true });
        startAuto();
      }
      showToast('업데이트됨');
    } catch (e) {
      showToast('새로고침 실패');
    } finally {
      setTimeout(() => {
        ptr.classList.remove('is-loading', 'is-active');
        ptr.style.transition = 'transform 280ms var(--ease)';
        ptr.style.transform  = 'translate(-50%, -60px)';
        setTimeout(() => { ptr.style.transition = ''; }, 300);
      }, 400);
    }
  }

  // ───── Render slides ───────────────────────────────────────────────────
  function renderSlides() {
    viewport.innerHTML = '';
    state.posts.forEach((p, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;

      const img = document.createElement('img');
      img.className = 'slide__img';
      img.src = p.image_url;
      img.alt = `${p.author}님의 사진`;
      img.draggable = false;
      img.addEventListener('click', () => openLetter(i));
      slide.appendChild(img);

      viewport.appendChild(slide);
    });
  }

  function renderDots() {
    dotsEl.innerHTML = '<div class="dots__fill" id="dotsFill"></div>';
  }

  function updateCount() {
    const total = state.posts.length;
    countEl.textContent = `${state.index + 1} / ${total}`;
    const fill = document.getElementById('dotsFill');
    if (fill) {
      const pct = total <= 1 ? 100 : ((state.index + 1) / total) * 100;
      fill.style.width = `${pct}%`;
    }
  }

  // ───── Navigation ──────────────────────────────────────────────────────
  function show(nextIndex, { dir = 'fade', silent = false } = {}) {
    if (state.isAnimating) return;
    const total = state.posts.length;
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
      return;
    }

    state.isAnimating = true;

    if (dir === 'fade') {
      nextEl.classList.add('is-active');
      prevEl && prevEl.classList.remove('is-active');
      setTimeout(() => { state.isAnimating = false; }, 920);
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
        }, 540);
      }

      setTimeout(() => {
        nextEl.classList.remove('swipe-active',
          'swipe-enter-left', 'swipe-enter-right', 'swipe-exit-left', 'swipe-exit-right');
        state.isAnimating = false;
      }, 540);
    }

    state.index = next;
    updateCount();
  }

  function next() { show(state.index + 1, { dir: 'next' }); }
  function prev() { show(state.index - 1, { dir: 'prev' }); }

  function startAuto() {
    stopAuto();
    state.autoTimer = setInterval(() => {
      if (state.isInteracting || sheet.getAttribute('aria-hidden') === 'false') return;
      show(state.index + 1, { dir: 'fade' });
    }, state.autoMs);
  }
  function stopAuto() {
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
  }

  let navHideTimer = null;
  function showNav() {
    prevBtn.classList.add('is-visible');
    nextBtn.classList.add('is-visible');
    if (navHideTimer) clearTimeout(navHideTimer);
    navHideTimer = setTimeout(() => {
      prevBtn.classList.remove('is-visible');
      nextBtn.classList.remove('is-visible');
    }, 2500);
  }

  // ───── Bind events ─────────────────────────────────────────────────────
  function bindEvents() {
    prevBtn.addEventListener('click', () => { prev(); resetAuto(); showNav(); });
    nextBtn.addEventListener('click', () => { next(); resetAuto(); showNav(); });

    window.addEventListener('keydown', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      if (e.key === 'ArrowLeft')  { prev(); resetAuto(); }
      if (e.key === 'ArrowRight') { next(); resetAuto(); }
    });

    // ───── Pull-to-Refresh ──────────────────────────────────────────────
    const ptr = document.getElementById('ptr');
    let ptrStartY = 0;
    let ptrPull   = 0;
    let ptrActive = false;
    const PTR_THRESHOLD = 80;

    stage.addEventListener('touchstart', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      ptrStartY = e.touches[0].clientY;
      ptrPull = 0;
      ptrActive = false;
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      const t = e.touches[0];
      const dy = t.clientY - ptrStartY;
      const dx = Math.abs(t.clientX - (window._ptrLastX || t.clientX));
      window._ptrLastX = t.clientX;

      if (dy > 10 && Math.abs(t.clientY - ptrStartY) > dx * 2) {
        ptrPull = Math.min(dy, 150);
        ptrActive = true;
        const eased = Math.min(ptrPull * 0.6, 90) - 60;
        ptr.style.transform = `translate(-50%, ${eased}px)`;
        ptr.classList.add('is-active');
        const rot = (ptrPull / PTR_THRESHOLD) * 360;
        ptr.querySelector('.ptr__spinner').style.transform = `rotate(${rot}deg)`;
      }
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      if (!ptrActive) return;
      ptrActive = false;
      if (ptrPull >= PTR_THRESHOLD) {
        ptr.classList.add('is-loading');
        ptr.style.transform = 'translate(-50%, 20px)';
        ptr.querySelector('.ptr__spinner').style.transform = '';
        reload();
      } else {
        ptr.style.transition = 'transform 280ms var(--ease)';
        ptr.style.transform  = 'translate(-50%, -60px)';
        ptr.classList.remove('is-active');
        setTimeout(() => { ptr.style.transition = ''; }, 300);
      }
    });

    let startX = 0, startY = 0, dx = 0, dy = 0, touching = false;
    stage.addEventListener('touchstart', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
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

    stage.addEventListener('mousemove', () => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      showNav();
    });

    sheet.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', closeLetter));

    let sStartY = 0, sDy = 0, sDragging = false;
    sheetPanel.addEventListener('touchstart', (e) => {
      const rect = sheetPanel.getBoundingClientRect();
      if (e.touches[0].clientY - rect.top > 60) return;
      sStartY = e.touches[0].clientY; sDy = 0; sDragging = true;
      sheetPanel.style.transition = 'none';
    }, { passive: true });
    sheetPanel.addEventListener('touchmove', (e) => {
      if (!sDragging) return;
      sDy = Math.max(0, e.touches[0].clientY - sStartY);
      sheetPanel.style.transform = `translateY(${sDy}px)`;
    }, { passive: true });
    sheetPanel.addEventListener('touchend', () => {
      if (!sDragging) return;
      sDragging = false;
      sheetPanel.style.transition = '';
      if (sDy > 100) closeLetter();
      else sheetPanel.style.transform = '';
    });
  }

  function resetAuto() { startAuto(); }

  // ───── Letter sheet — no password required ─────────────────────────────
  function openLetter(i) {
    const p = state.posts[i];
    if (!p) return;
    state.index = i;
    const slides = viewport.querySelectorAll('.slide');
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
    updateCount();

    letterAuthor.textContent = p.author;
    letterMessage.textContent = p.message;
    letterDate.textContent = formatDate(p.created_at);
    setHidden(sheet, false);
    stopAuto();
  }

  function closeLetter() {
    setHidden(sheet, true);
    sheetPanel.style.transform = '';
    startAuto();
  }

  // ───── BGM toggle ─────────────────────────────────────────────────────
  const bgm = document.getElementById('bgm');
  const musicBtn = document.getElementById('musicBtn');
  let bgmFadeTimer = null;

  if (bgm && musicBtn) {
    bgm.volume = 0;

    musicBtn.addEventListener('click', () => {
      const isPlaying = !bgm.paused;
      if (isPlaying) {
        fadeBgm(0, () => bgm.pause());
        musicBtn.classList.remove('is-playing');
        musicBtn.setAttribute('aria-pressed', 'false');
        musicBtn.setAttribute('aria-label', '음악 켜기');
      } else {
        bgm.play().then(() => {
          fadeBgm(0.4);
          musicBtn.classList.add('is-playing');
          musicBtn.setAttribute('aria-pressed', 'true');
          musicBtn.setAttribute('aria-label', '음악 끄기');
        }).catch((err) => {
          console.warn('BGM play failed:', err);
        });
      }
    });

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
  }

  // ───── Speed toggle ───────────────────────────────────────────────────
  const speedBtn = document.getElementById('speedBtn');
  const speedLabel = document.getElementById('speedLabel');
  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      if (state.autoMs === 5000) {
        state.autoMs = 10000;
        speedLabel.textContent = '10s';
        speedBtn.classList.add('is-slow');
      } else {
        state.autoMs = 5000;
        speedLabel.textContent = '5s';
        speedBtn.classList.remove('is-slow');
      }
      startAuto();
    });
  }

  // ───── Mobile menu ────────────────────────────────────────────────────
  const menu       = document.getElementById('menu');
  const menuBtn    = document.getElementById('menuBtn');
  const menuPanel  = document.getElementById('menuPanel');
  const menuMusic  = document.getElementById('menuMusic');
  const menuMusicLabel = document.getElementById('menuMusicLabel');
  const menuSpeed  = document.getElementById('menuSpeed');
  const menuSpeedLabel = document.getElementById('menuSpeedLabel');

  if (menu && menuBtn) {
    function openMenu() {
      menu.classList.add('is-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      menuPanel.setAttribute('aria-hidden', 'false');
    }
    function closeMenu() {
      menu.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuPanel.setAttribute('aria-hidden', 'true');
    }
    function toggleMenu() {
      if (menu.classList.contains('is-open')) closeMenu();
      else openMenu();
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('is-open')) return;
      if (!menu.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });

    if (menuMusic) {
      menuMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        musicBtn.click();
        setTimeout(() => {
          const playing = musicBtn.classList.contains('is-playing');
          menuMusic.classList.toggle('is-playing', playing);
          menuMusicLabel.textContent = playing ? '음악 끄기' : '음악 켜기';
        }, 50);
      });
    }

    if (menuSpeed) {
      menuSpeed.addEventListener('click', (e) => {
        e.stopPropagation();
        speedBtn.click();
        setTimeout(() => {
          menuSpeedLabel.textContent = state.autoMs === 10000 ? '10초' : '5초';
        }, 50);
      });
    }

    const menuContact = document.getElementById('menuContact');
    if (menuContact) {
      menuContact.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        openContact();
      });
    }

    const contactModal = document.getElementById('contactModal');
    const contactBtn   = document.getElementById('contactBtn');

    function openContact()  { if (contactModal) contactModal.setAttribute('aria-hidden', 'false'); }
    function closeContact() { if (contactModal) contactModal.setAttribute('aria-hidden', 'true');  }

    if (contactBtn) {
      contactBtn.addEventListener('click', openContact);
    }
    if (contactModal) {
      contactModal.querySelectorAll('[data-close]').forEach((el) =>
        el.addEventListener('click', closeContact)
      );
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
