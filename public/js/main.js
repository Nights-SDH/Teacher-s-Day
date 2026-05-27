// public/js/main.js
// Gallery, bottom-sheet letter, password-protected edit/delete

(() => {
  // ───── State ───────────────────────────────────────────────────────────
  const state = {
    posts: [],          // [{id, author, message, image_url, created_at}]
    index: 0,           // current slide index
    autoTimer: null,
    autoMs: 5000,
    isInteracting: false,
    isAnimating: false,
    pwAction: null,     // 'view' | 'edit' | null
    pwForPostId: null,
    verifiedPassword: null, // remembered after successful verify
    pendingLetterIndex: null,
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
  const editBtn       = $('editBtn');

  const pwModal   = $('pwModal');
  const pwInput   = $('pwInput');
  const pwError   = $('pwError');
  const pwSubmit  = $('pwSubmit');
  const pwHint    = $('pwHint');

  const editModal = $('editModal');
  const editAuthor    = $('editAuthor');
  const editMessage   = $('editMessage');
  const editImage     = $('editImage');
  const editIsPrivate = $('editIsPrivate');
  const editError     = $('editError');
  const saveBtn       = $('saveBtn');
  const deleteBtn     = $('deleteBtn');

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
      state.posts = shuffle(posts); // random initial order, requirement 3.b
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
      // Hide spinner with a bit of delay so the success feels intentional
      setTimeout(() => {
        ptr.classList.remove('is-loading', 'is-active');
        ptr.style.transition = 'transform 280ms var(--ease)';
        ptr.style.transform  = 'translate(-50%, -60px)';
        setTimeout(() => { ptr.style.transition = ''; }, 300);
      }, 400);
    }
  }

  // ───── Render slides ───────────────────────────────────────────────────
  function buildSlideContent(slide, p, i) {
    slide.innerHTML = '';
    if (p.is_private) {
      const placeholder = document.createElement('div');
      placeholder.className = 'slide__private';
      placeholder.addEventListener('click', () => openLetter(i));

      const lockDiv = document.createElement('div');
      lockDiv.className = 'slide__private-lock';
      lockDiv.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'slide__private-name';
      nameDiv.textContent = p.author;

      const hintDiv = document.createElement('div');
      hintDiv.className = 'slide__private-hint';
      hintDiv.textContent = '탭해서 비밀번호로 열기';

      placeholder.append(lockDiv, nameDiv, hintDiv);
      slide.appendChild(placeholder);
    } else {
      const img = document.createElement('img');
      img.className = 'slide__img';
      img.src = p.image_url;
      img.alt = `${p.author}님의 사진`;
      img.draggable = false;
      img.addEventListener('click', () => openLetter(i));
      slide.appendChild(img);
    }
  }

  function renderSlides() {
    viewport.innerHTML = '';
    state.posts.forEach((p, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;
      buildSlideContent(slide, p, i);
      viewport.appendChild(slide);
    });
  }

  function renderDots() {
    // Progress bar — single fill element, scales with index regardless of count
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
      // Cross-fade
      nextEl.classList.add('is-active');
      prevEl && prevEl.classList.remove('is-active');
      setTimeout(() => { state.isAnimating = false; }, 920);
    } else {
      // Slide animation
      const enter = dir === 'next' ? 'swipe-enter-right' : 'swipe-enter-left';
      const exit  = dir === 'next' ? 'swipe-exit-left'   : 'swipe-exit-right';

      nextEl.classList.add(enter);
      // force reflow
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

  // Auto-play
  function startAuto() {
    stopAuto();
    state.autoTimer = setInterval(() => {
      if (state.isInteracting || sheet.getAttribute('aria-hidden') === 'false'
          || pwModal.getAttribute('aria-hidden') === 'false'
          || editModal.getAttribute('aria-hidden') === 'false') return;
      show(state.index + 1, { dir: 'fade' });
    }, state.autoMs);
  }
  function stopAuto() {
    if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
  }
  // ───── Nav visibility (auto-hide) ───────────────────────────────────
  let navHideTimer = null;
  function showNav() {
    prevBtn.classList.add('is-visible');
    nextBtn.classList.add('is-visible');
    if (navHideTimer) clearTimeout(navHideTimer);
    navHideTimer = setTimeout(() => {
      prevBtn.classList.remove('is-visible');
      nextBtn.classList.remove('is-visible');
    }, 2500); // 마지막 인터랙션 후 2.5초 뒤 사라짐
  }
  // ───── Bind events ─────────────────────────────────────────────────────
  function bindEvents() {
    prevBtn.addEventListener('click', () => { prev(); resetAuto(); showNav(); });
    nextBtn.addEventListener('click', () => { next(); resetAuto(); showNav(); });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false'
        || pwModal.getAttribute('aria-hidden') === 'false'
        || editModal.getAttribute('aria-hidden') === 'false') return;
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
      // Only start PTR when bottom sheet is closed
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

      // Only engage PTR if vertical pull is dominant (avoid conflict w/ swipe)
      if (dy > 10 && Math.abs(t.clientY - ptrStartY) > dx * 2) {
        ptrPull = Math.min(dy, 150);
        ptrActive = true;
        // Translate the indicator down with resistance
        const eased = Math.min(ptrPull * 0.6, 90) - 60;
        ptr.style.transform = `translate(-50%, ${eased}px)`;
        ptr.classList.add('is-active');
        // Rotate spinner based on pull amount
        const rot = (ptrPull / PTR_THRESHOLD) * 360;
        ptr.querySelector('.ptr__spinner').style.transform = `rotate(${rot}deg)`;
      }
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      if (!ptrActive) return;
      ptrActive = false;
      if (ptrPull >= PTR_THRESHOLD) {
        // Trigger refresh
        ptr.classList.add('is-loading');
        ptr.style.transform = 'translate(-50%, 20px)';
        ptr.querySelector('.ptr__spinner').style.transform = '';
        reload();
      } else {
        // Snap back
        ptr.style.transition = 'transform 280ms var(--ease)';
        ptr.style.transform  = 'translate(-50%, -60px)';
        ptr.classList.remove('is-active');
        setTimeout(() => { ptr.style.transition = ''; }, 300);
      }
    });
    // Touch swipe
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
    // Desktop: show nav on mouse move
    stage.addEventListener('mousemove', () => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      showNav();
    });

    // Sheet close
    sheet.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', closeLetter));

    // Drag-to-close on sheet
    let sStartY = 0, sDy = 0, sDragging = false;
    sheetPanel.addEventListener('touchstart', (e) => {
      // Only initiate if touch starts in the handle/head area (top 60px)
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

    // Edit flow
    editBtn.addEventListener('click', () => {
      const p = state.posts[state.index];
      if (state.verifiedPassword && state.pwForPostId === p?.id) {
        // already verified while opening letter — skip re-entry
        openEditModal();
      } else {
        state.pwAction = 'edit';
        if (pwHint) pwHint.textContent = '편집을 위해 등록 시 입력한 비밀번호를 입력해 주세요.';
        openPwModal();
      }
    });

    // Password modal
    pwModal.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', closePwModal));
    pwSubmit.addEventListener('click', verifyPw);
    pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyPw(); });

    // Edit modal
    editModal.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', closeEditModal));
    saveBtn.addEventListener('click', savePost);
    deleteBtn.addEventListener('click', deletePost);
  }

  function resetAuto() { startAuto(); }

  // ───── Letter sheet ────────────────────────────────────────────────────
  function openLetter(i) {
    const p = state.posts[i];
    if (!p) return;
    state.index = i;
    // ensure correct slide visible (in case clicked while transitioning)
    const slides = viewport.querySelectorAll('.slide');
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
    updateCount();

    state.pwAction = 'view';
    state.pendingLetterIndex = i;
    if (pwHint) pwHint.textContent = '편지를 보려면 등록 시 입력한 비밀번호를 입력해 주세요.';
    openPwModal();
  }

  function showLetter(i) {
    const p = state.posts[i];
    if (!p) return;

    // Reveal private photo now that password is verified
    if (p.is_private) {
      const slides = viewport.querySelectorAll('.slide');
      const slide = slides[i];
      const placeholder = slide && slide.querySelector('.slide__private');
      if (placeholder) {
        const img = document.createElement('img');
        img.className = 'slide__img';
        img.src = p.image_url;
        img.alt = `${p.author}님의 사진`;
        img.draggable = false;
        img.addEventListener('click', () => openLetter(i));
        slide.replaceChild(img, placeholder);
      }
    }

    letterAuthor.textContent = p.author;
    letterMessage.textContent = p.message;
    letterDate.textContent = formatDate(p.created_at);
    setHidden(sheet, false);
    stopAuto();
  }

  function closeLetter() {
    setHidden(sheet, true);
    sheetPanel.style.transform = '';
    state.verifiedPassword = null; // reset on close
    state.pwForPostId = null;
    state.pendingLetterIndex = null;
    startAuto();
  }

  // ───── Password modal ──────────────────────────────────────────────────
  function openPwModal() {
    pwError.textContent = '';
    pwInput.value = '';
    setHidden(pwModal, false);
    setTimeout(() => pwInput.focus(), 80);
  }
  function closePwModal() {
    setHidden(pwModal, true);
    state.pwAction = null;
  }

  async function verifyPw() {
    const p = state.posts[state.index];
    if (!p) return;
    const pw = pwInput.value;
    if (!pw) { pwError.textContent = '비밀번호를 입력해주세요.'; return; }

    pwSubmit.disabled = true;
    try {
      const res = await fetch(`/api/posts/${p.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        state.verifiedPassword = pw;
        state.pwForPostId = p.id;
        const action = state.pwAction;
        closePwModal();
        if (action === 'edit') openEditModal();
        else if (action === 'view') showLetter(state.pendingLetterIndex ?? state.index);
      } else {
        pwError.textContent = '비밀번호가 일치하지 않습니다.';
      }
    } catch (e) {
      pwError.textContent = '확인 중 오류가 발생했어요.';
    } finally {
      pwSubmit.disabled = false;
    }
  }

  // ───── Edit modal ──────────────────────────────────────────────────────
  function openEditModal() {
    const p = state.posts[state.index];
    if (!p) return;
    editAuthor.value = p.author;
    editMessage.value = p.message;
    editImage.value = '';
    if (editIsPrivate) editIsPrivate.checked = p.is_private || false;
    editError.textContent = '';
    setHidden(editModal, false);
  }
  function closeEditModal() { setHidden(editModal, true); }

  async function savePost() {
    const p = state.posts[state.index];
    if (!p || state.pwForPostId !== p.id) {
      editError.textContent = '세션이 만료되었어요. 다시 시도해주세요.';
      return;
    }

    const author = editAuthor.value.trim();
    const message = editMessage.value.trim();
    if (!author) { editError.textContent = '이름을 입력해주세요.'; return; }
    if (!message) { editError.textContent = '편지를 입력해주세요.'; return; }

    saveBtn.disabled = true;
    editError.textContent = '';
    try {
      const form = new FormData();
      form.append('author',     author);
      form.append('message',    message);
      form.append('password',   state.verifiedPassword || '');
      form.append('is_private', editIsPrivate && editIsPrivate.checked ? 'true' : 'false');
      if (editImage.files && editImage.files[0]) {
        form.append('image', editImage.files[0]);
      }
      const res = await fetch(`/api/posts/${p.id}`, { method: 'PUT', body: form });
      const data = await res.json();
      if (!res.ok) {
        editError.textContent = data.error || '저장에 실패했어요.';
        return;
      }
      // Update local state
      state.posts[state.index] = { ...state.posts[state.index], ...data };
      // Re-render slide (handles public ↔ private toggle change)
      const slides = viewport.querySelectorAll('.slide');
      const slide = slides[state.index];
      if (slide) {
        buildSlideContent(slide, state.posts[state.index], state.index);
        // Bust cache on the newly created image if it exists
        const newImg = slide.querySelector('.slide__img');
        if (newImg) newImg.src = data.image_url + '?t=' + Date.now();
      }
      letterAuthor.textContent = data.author;
      letterMessage.textContent = data.message;
      closeEditModal();
      showToast('편지가 수정되었어요');
    } catch (e) {
      editError.textContent = '저장 중 오류가 발생했어요.';
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function deletePost() {
    const p = state.posts[state.index];
    if (!p) return;
    const confirmed = window.confirm(
      `정말 삭제하시겠어요?\n\n"${p.author}" 님이 남긴 메시지가 사라집니다.\n이 작업은 되돌릴 수 없어요.`
    );
    if (!confirmed) return;

    deleteBtn.disabled = true;
    try {
      const res = await fetch(`/api/posts/${p.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: state.verifiedPassword || '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        editError.textContent = data.error || '삭제에 실패했어요.';
        return;
      }
      // remove from state
      state.posts.splice(state.index, 1);
      closeEditModal();
      closeLetter();
      showToast('삭제되었어요');

      if (state.posts.length === 0) {
        emptyEl.hidden = false;
        stage.style.display = 'none';
        stopAuto();
        return;
      }
      renderSlides();
      renderDots();
      const newIdx = Math.min(state.index, state.posts.length - 1);
      state.index = 0;
      show(newIdx, { silent: true });
      // rebind image click handlers happens via renderSlides
    } catch (e) {
      editError.textContent = '삭제 중 오류가 발생했어요.';
    } finally {
      deleteBtn.disabled = false;
    }
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
        // Fade out then pause
        fadeBgm(0, () => bgm.pause());
        musicBtn.classList.remove('is-playing');
        musicBtn.setAttribute('aria-pressed', 'false');
        musicBtn.setAttribute('aria-label', '음악 켜기');
      } else {
        // Play and fade in
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

  // ───── Speed toggle (5s ↔ 10s) ────────────────────────────────────────
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
      startAuto();  // restart with new interval
    });
  }

  // ───── Mobile menu (dropdown) ────────────────────────────────────────
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

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('is-open')) return;
      if (!menu.contains(e.target)) closeMenu();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });

    // Music item in menu — proxies the existing music button
    if (menuMusic) {
      menuMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        musicBtn.click();   // delegate to existing handler
        // Update menu label/state after a tick (music button toggles class)
        setTimeout(() => {
          const playing = musicBtn.classList.contains('is-playing');
          menuMusic.classList.toggle('is-playing', playing);
          menuMusicLabel.textContent = playing ? '음악 끄기' : '음악 켜기';
        }, 50);
      });
    }

    // Speed item in menu — proxies the existing speed button
    if (menuSpeed) {
      menuSpeed.addEventListener('click', (e) => {
        e.stopPropagation();
        speedBtn.click();   // delegate to existing handler
        // Update menu label after a tick
        setTimeout(() => {
          menuSpeedLabel.textContent = state.autoMs === 10000 ? '10초' : '5초';
        }, 50);
      });
    }

    // Contact item in menu
    const menuContact = document.getElementById('menuContact');
    if (menuContact) {
      menuContact.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        openContact();
      });
    }

    // ───── Contact modal ─────────────────────────────────────────────────
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

  // Boot
  document.addEventListener('DOMContentLoaded', boot);
})();
