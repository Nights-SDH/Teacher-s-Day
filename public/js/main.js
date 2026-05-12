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
    pwAction: null,     // 'edit' | 'delete' | null
    pwForPostId: null,
    verifiedPassword: null, // remembered after successful verify
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

  const editModal = $('editModal');
  const editAuthor   = $('editAuthor');
  const editMessage  = $('editMessage');
  const editImage    = $('editImage');
  const editError    = $('editError');
  const saveBtn      = $('saveBtn');
  const deleteBtn    = $('deleteBtn');

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
    dotsEl.innerHTML = '';
    state.posts.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i === 0 ? ' is-active' : '');
      dotsEl.appendChild(d);
    });
  }

  function updateCount() {
    countEl.textContent = `${state.index + 1} / ${state.posts.length}`;
    Array.from(dotsEl.children).forEach((d, i) =>
      d.classList.toggle('is-active', i === state.index)
    );
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

  // ───── Bind events ─────────────────────────────────────────────────────
  function bindEvents() {
    prevBtn.addEventListener('click', () => { prev(); resetAuto(); });
    nextBtn.addEventListener('click', () => { next(); resetAuto(); });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false'
        || pwModal.getAttribute('aria-hidden') === 'false'
        || editModal.getAttribute('aria-hidden') === 'false') return;
      if (e.key === 'ArrowLeft')  { prev(); resetAuto(); }
      if (e.key === 'ArrowRight') { next(); resetAuto(); }
    });

    // Touch swipe
    let startX = 0, startY = 0, dx = 0, dy = 0, touching = false;
    stage.addEventListener('touchstart', (e) => {
      if (sheet.getAttribute('aria-hidden') === 'false') return;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      dx = dy = 0; touching = true;
      state.isInteracting = true;
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
      state.pwAction = 'edit';
      openPwModal();
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
        closePwModal();
        if (state.pwAction === 'edit') openEditModal();
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
      form.append('author', author);
      form.append('message', message);
      form.append('password', state.verifiedPassword || '');
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
      // refresh image (bust cache by appending a timestamp)
      const slides = viewport.querySelectorAll('.slide');
      const img = slides[state.index].querySelector('img');
      img.src = data.image_url + '?t=' + Date.now();
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
      `정말 삭제하시겠어요?\n\n"${p.author}" 님이 남긴 추억이 사라집니다.\n이 작업은 되돌릴 수 없어요.`
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

  // Boot
  document.addEventListener('DOMContentLoaded', boot);
})();
