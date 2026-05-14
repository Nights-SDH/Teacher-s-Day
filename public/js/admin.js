// public/js/admin.js
(() => {
  const $ = (id) => document.getElementById(id);
  const loginScreen = $('loginScreen');
  const adminScreen = $('adminScreen');
  const adminPw     = $('adminPw');
  const loginBtn    = $('loginBtn');
  const loginError  = $('loginError');
  const grid        = $('grid');
  const adminCount  = $('adminCount');
  const adminEmpty  = $('adminEmpty');
  const toast       = $('toast');

  let adminPassword = '';   // kept in memory only, never stored

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2400);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ───── Login ────────────────────────────────────────────────────────
  async function login() {
    loginError.textContent = '';
    const pw = adminPw.value;
    if (!pw) { loginError.textContent = '비밀번호를 입력하세요.'; return; }

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
      loginScreen.hidden = true;
      adminScreen.hidden = false;
      render(data.posts);
    } catch (e) {
      loginError.textContent = '네트워크 오류';
      loginBtn.disabled = false;
    }
  }

  loginBtn.addEventListener('click', login);
  adminPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

  // ───── Render ───────────────────────────────────────────────────────
  function render(posts) {
    grid.innerHTML = '';
    adminCount.textContent = `${posts.length}개`;
    if (posts.length === 0) {
      adminEmpty.hidden = false;
      return;
    }
    adminEmpty.hidden = true;

    posts.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = p.id;
      card.innerHTML = `
        <img class="card__img" src="${p.image_url}" alt="${p.author}" loading="lazy" />
        <div class="card__body">
          <div class="card__author">${escapeHtml(p.author)}</div>
          <div class="card__date">${formatDate(p.created_at)}</div>
        </div>
        <div class="card__actions">
          <button class="card__delete" type="button">삭제</button>
        </div>
      `;
      card.querySelector('.card__delete').addEventListener('click', () =>
        deletePost(p.id, p.author, card)
      );
      grid.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ───── Delete ───────────────────────────────────────────────────────
  async function deletePost(id, author, cardEl) {
    if (!confirm(`"${author}"님의 게시물을 삭제할까요?\n되돌릴 수 없습니다.`)) return;

    const btn = cardEl.querySelector('.card__delete');
    btn.disabled = true;
    btn.textContent = '삭제 중...';

    try {
      const res = await fetch(`/api/admin/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '삭제 실패');
        btn.disabled = false;
        btn.textContent = '삭제';
        return;
      }
      cardEl.style.transition = 'opacity 200ms, transform 200ms';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.96)';
      setTimeout(() => {
        cardEl.remove();
        const remaining = grid.querySelectorAll('.card').length;
        adminCount.textContent = `${remaining}개`;
        if (remaining === 0) adminEmpty.hidden = false;
      }, 200);
      showToast('삭제되었습니다');
    } catch (e) {
      showToast('네트워크 오류');
      btn.disabled = false;
      btn.textContent = '삭제';
    }
  }
})();