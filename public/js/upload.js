// public/js/upload.js
(() => {
  const $ = (id) => document.getElementById(id);
  const form        = $('form');
  const picker      = $('picker');
  const imageInput  = $('imageInput');
  const preview     = $('preview');
  const clearImage  = $('clearImage');
  const author      = $('author');
  const message     = $('message');
  const password    = $('password');
  const charCount   = $('charCount');
  const formError   = $('formError');
  const submitBtn   = $('submitBtn');
  const success     = $('success');
  const anotherBtn  = $('anotherBtn');
  const toast       = $('toast');

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2400);
  }

  // Picker
  picker.addEventListener('click', (e) => {
    if (e.target === clearImage || clearImage.contains(e.target)) return;
    imageInput.click();
  });
  imageInput.addEventListener('change', () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('파일이 너무 큽니다 (최대 15MB)');
      imageInput.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    preview.src = url;
    picker.classList.add('has-image');
    clearImage.hidden = false;
  });
  clearImage.addEventListener('click', (e) => {
    e.stopPropagation();
    imageInput.value = '';
    preview.src = '';
    picker.classList.remove('has-image');
    clearImage.hidden = true;
  });

  // Char count
  function updateCount() {
    charCount.textContent = `${message.value.length} / 1500`;
  }
  message.addEventListener('input', updateCount);
  updateCount();

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    if (!imageInput.files || !imageInput.files[0]) {
      formError.textContent = '사진을 첨부해주세요.';
      return;
    }
    if (!author.value.trim()) {
      formError.textContent = '이름을 입력해주세요.';
      return;
    }
    if (!message.value.trim()) {
      formError.textContent = '편지를 입력해주세요.';
      return;
    }
    if (password.value.length < 2) {
      formError.textContent = '비밀번호는 2자 이상으로 입력해주세요.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = '편지 보내는 중...';

    try {
      const fd = new FormData();
      fd.append('author', author.value.trim());
      fd.append('message', message.value.trim());
      fd.append('password', password.value);
      fd.append('image', imageInput.files[0]);

      const res = await fetch('/api/posts', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        formError.textContent = data.error || '업로드에 실패했어요.';
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = '편지 남기기';
        return;
      }
      // success
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      formError.textContent = '네트워크 오류가 발생했어요.';
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = '편지 남기기';
    }
  });

  // 한 번 더
  anotherBtn.addEventListener('click', () => {
    form.reset();
    preview.src = '';
    picker.classList.remove('has-image');
    clearImage.hidden = true;
    updateCount();
    success.hidden = true;
    form.hidden = false;
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = '편지 남기기';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
