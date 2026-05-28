// public/js/admin.js
// Curator dashboard — manage specimens
(() => {
  const $ = (id) => document.getElementById(id);

  const loginScreen = $('loginScreen');
  const adminScreen = $('adminScreen');
  const adminPw     = $('adminPw');
  const loginBtn    = $('loginBtn');
  const loginError  = $('loginError');

  const grid       = $('grid');
  const adminCount = $('adminCount');
  const adminEmpty = $('adminEmpty');
  const addBtn     = $('addBtn');

  const formModal  = $('formModal');
  const formTitle  = $('formTitle');
  const picker     = $('picker');
  const imageInput = $('imageInput');
  const preview    = $('preview');
  const nickname   = $('nickname');
  const description = $('description');
  const capturedAt = $('capturedAt');
  const formError  = $('formError');
  const saveBtn    = $('saveBtn');

  const toast = $('toast');

  let adminPassword = '';
  let posts = [];
  let editingId = null;
  let isComposing = false;
  let isSaving = false;

  // ───── Toast ────────────────────────────────────────────────────────
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2400);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function formatCaptured(s) {
    if (!s) return '';
    const d = new Date(s);
    if (!isNaN(d) && s.length >= 8) {
      return d.toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
    }
    return s;
  }

  // ───── Login ────────────────────────────────────────────────────────
  async function login() {
    loginError.textContent = '';
    const pw = adminPw.value;
    if (!pw) { loginError.textContent = '비밀번호를 입력해주세요.'; return; }

    loginBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        loginError.textContent = data.error || '로그인 실패';
        loginBtn.disabled = false;
        return;
      }
      adminPassword = pw;
      posts = data.posts || [];
      loginScreen.hidden = true;
      adminScreen.hidden = false;
      showToast('인증 완료');
      render();
    } catch (e) {
      loginError.textContent = '네트워크 오류';
      loginBtn.disabled = false;
    }
  }
  loginBtn.addEventListener('click', login);
  adminPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

  // ───── Render ───────────────────────────────────────────────────────
  function render() {
    grid.innerHTML = '';
    adminCount.textContent = `${posts.length}개 표본 · ${posts.length === 0 ? '비어 있음' : '도감 활성'}`;
    if (posts.length === 0) {
      adminEmpty.hidden = false;
      return;
    }
    adminEmpty.hidden = true;

    posts.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="card__order">№ ${String(i + 1).padStart(2, '0')}</div>
        <div class="card__move">
          <button data-act="up" aria-label="위로" type="button">↑</button>
          <button data-act="down" aria-label="아래로" type="button">↓</button>
        </div>
        <img class="card__img" src="${p.image_url}" alt="${escapeHtml(p.nickname)}" loading="lazy" />
        <div class="card__body">
          <div class="card__name">${escapeHtml(p.nickname)}</div>
          ${p.captured_at ? `<div class="card__date">${escapeHtml(formatCaptured(p.captured_at))}</div>` : ''}
        </div>
        <div class="card__actions">
          <button class="card__btn" data-act="edit" type="button">편집</button>
          <button class="card__btn card__btn--danger" data-act="delete" type="button">삭제</button>
        </div>
      `;
      card.querySelector('[data-act="edit"]').addEventListener('click', () => openEdit(p));
      card.querySelector('[data-act="delete"]').addEventListener('click', () => deletePost(p));
      card.querySelector('[data-act="up"]').addEventListener('click', () => move(i, -1));
      card.querySelector('[data-act="down"]').addEventListener('click', () => move(i, 1));
      grid.appendChild(card);
    });
  }

  // ───── Move (reorder) ───────────────────────────────────────────────
  async function move(fromIdx, delta) {
    const toIdx = fromIdx + delta;
    if (toIdx < 0 || toIdx >= posts.length) return;
    const item = posts.splice(fromIdx, 1)[0];
    posts.splice(toIdx, 0, item);
    render();
    // Persist
    try {
      await fetch('/api/admin/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          order: posts.map((p) => p.id),
        }),
      });
    } catch (e) {
      showToast('순서 저장 실패');
    }
  }

  // ───── Image picker ─────────────────────────────────────────────────
  imageInput.addEventListener('change', () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      showToast('파일이 너무 큽니다 (최대 30MB)');
      imageInput.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    preview.src = url;
    picker.classList.add('has-image');
  });

  // ───── IME tracking ─────────────────────────────────────────────────
  [nickname, description, capturedAt].forEach((el) => {
    el.addEventListener('compositionstart', () => { isComposing = true; });
    el.addEventListener('compositionend',   () => { isComposing = false; });
  });

  // ───── Client-side image resize ─────────────────────────────────────
  async function optimizeImage(file, maxDim = 1600, quality = 0.85) {
    const isHeic = /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);
    if (file.size < 700 * 1024 && !isHeic) return file;

    let source, bw, bh;
    try {
      if (typeof createImageBitmap === 'function') {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        bw = source.width; bh = source.height;
      } else {
        const url = URL.createObjectURL(file);
        source = await new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
        });
        URL.revokeObjectURL(url);
        bw = source.naturalWidth; bh = source.naturalHeight;
      }
    } catch (e) {
      console.warn('decode failed, sending original', e);
      return file;
    }

    let tw = bw, th = bh;
    if (bw > maxDim || bh > maxDim) {
      if (bw >= bh) { tw = maxDim; th = Math.round(bh * (maxDim / bw)); }
      else          { th = maxDim; tw = Math.round(bw * (maxDim / bh)); }
    }

    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, tw, th);
    if (source.close) source.close();

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  }

  // ───── Open / close form ────────────────────────────────────────────
  function openCreate() {
    editingId = null;
    formTitle.textContent = '표본 등록';
    nickname.value = '';
    description.value = '';
    capturedAt.value = '';
    imageInput.value = '';
    preview.src = '';
    picker.classList.remove('has-image');
    formError.textContent = '';
    saveBtn.textContent = '등록';
    isSaving = false;
    formModal.setAttribute('aria-hidden', 'false');
  }

  function openEdit(p) {
    editingId = p.id;
    formTitle.textContent = '표본 편집';
    nickname.value = p.nickname || '';
    description.value = p.description || '';
    capturedAt.value = p.captured_at || '';
    imageInput.value = '';
    preview.src = p.image_url;
    picker.classList.add('has-image');
    formError.textContent = '';
    saveBtn.textContent = '저장';
    isSaving = false;
    formModal.setAttribute('aria-hidden', 'false');
  }

  function closeForm() {
    formModal.setAttribute('aria-hidden', 'true');
  }
  formModal.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeForm));

  addBtn.addEventListener('click', openCreate);

  // ───── Save ─────────────────────────────────────────────────────────
  async function save() {
    if (isSaving) return;
    formError.textContent = '';

    // Flush IME
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (isComposing) await new Promise((r) => setTimeout(r, 80));

    const nn = nickname.value.trim();
    if (!nn) { formError.textContent = '별명을 입력해주세요.'; return; }

    const isNew = editingId === null;
    const file = imageInput.files && imageInput.files[0];
    if (isNew && !file) { formError.textContent = '사진을 첨부해주세요.'; return; }

    isSaving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = file ? '사진 최적화 중...' : '저장 중...';

    try {
      const optimized = file ? await optimizeImage(file) : null;
      saveBtn.textContent = isNew ? '등록 중...' : '저장 중...';

      const fd = new FormData();
      fd.append('password', adminPassword);
      fd.append('nickname', nn);
      fd.append('description', description.value.trim());
      fd.append('captured_at', capturedAt.value.trim());
      if (optimized) fd.append('image', optimized);

      const url    = isNew ? '/api/admin/posts' : `/api/admin/posts/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) {
        formError.textContent = data.error || '저장 실패';
        isSaving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = isNew ? '등록' : '저장';
        return;
      }

      // Update local list
      if (isNew) {
        posts.push(data);
      } else {
        const idx = posts.findIndex((p) => p.id === editingId);
        if (idx !== -1) posts[idx] = data;
      }
      render();
      closeForm();
      showToast(isNew ? '표본 등록됨' : '수정됨');
    } catch (e) {
      console.error(e);
      formError.textContent = '네트워크 오류';
      isSaving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? '등록' : '저장';
    }
  }
  saveBtn.addEventListener('click', save);
  saveBtn.addEventListener('pointerdown', () => {
    if (document.activeElement && document.activeElement !== saveBtn && document.activeElement.blur)
      document.activeElement.blur();
  }, { passive: true });

  // ───── Delete ───────────────────────────────────────────────────────
  async function deletePost(p) {
    if (!confirm(`"${p.nickname}" 표본을 삭제할까요?\n되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch(`/api/admin/posts/${p.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '삭제 실패'); return; }
      posts = posts.filter((x) => x.id !== p.id);
      render();
      showToast('삭제됨');
    } catch (e) {
      showToast('네트워크 오류');
    }
  }
})();
