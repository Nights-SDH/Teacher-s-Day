// public/js/upload.js
// Robust upload: client-side image resize + IME-safe submit + double-tap-safe.

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

  // ───── State ─────────────────────────────────────────────────────────
  let isComposing  = false;  // Korean IME composition in progress
  let isSubmitting = false;  // Prevent double-submit

  // ───── Toast ─────────────────────────────────────────────────────────
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2400);
  }

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
    clearImage.hidden = false;
  });

  clearImage.addEventListener('click', (e) => {
    e.preventDefault();   // ← clear 버튼이 label 안에 있어서 이것도 필요
    e.stopPropagation();
    imageInput.value = '';
    preview.src = '';
    picker.classList.remove('has-image');
    clearImage.hidden = true;
  });

  // ───── Char count ────────────────────────────────────────────────────
  function updateCount() { charCount.textContent = `${message.value.length} / 1500`; }
  message.addEventListener('input', updateCount);
  updateCount();

  // ───── IME composition tracking ──────────────────────────────────────
  [author, message, password].forEach((el) => {
    el.addEventListener('compositionstart', () => { isComposing = true; });
    el.addEventListener('compositionend',   () => { isComposing = false; });
  });

  // ───── Client-side image resize ──────────────────────────────────────
  // Why: 7MB iPhone photos → ~500KB JPEG. ~10× faster upload and removes
  // the "first tap does nothing" UX gap users see during slow uploads.
  async function optimizeImage(file, maxDim = 1600, quality = 0.85) {
    // Skip if small enough and a format the server already accepts cleanly
    const isHeic = /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);
    if (file.size < 700 * 1024 && !isHeic) return file;

    // Decode (preferring createImageBitmap with EXIF auto-rotate)
    let source;
    let bitmapWidth, bitmapHeight;
    try {
      if (typeof createImageBitmap === 'function') {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        bitmapWidth = source.width;
        bitmapHeight = source.height;
      } else {
        // Fallback: <img>
        const url = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload  = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        URL.revokeObjectURL(url);
        bitmapWidth = source.naturalWidth;
        bitmapHeight = source.naturalHeight;
      }
    } catch (err) {
      // Decode failed (often: HEIC on Chrome/Android). Send original.
      console.warn('image decode failed, sending original:', err);
      return file;
    }

    // Compute target dims
    let tw = bitmapWidth, th = bitmapHeight;
    if (bitmapWidth > maxDim || bitmapHeight > maxDim) {
      if (bitmapWidth >= bitmapHeight) {
        tw = maxDim;
        th = Math.round(bitmapHeight * (maxDim / bitmapWidth));
      } else {
        th = maxDim;
        tw = Math.round(bitmapWidth * (maxDim / bitmapHeight));
      }
    }

    // Draw → JPEG
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, tw, th);
    if (source.close) source.close(); // free bitmap memory

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );

    if (!blob) return file;
    // If "optimized" is bigger than original (rare, tiny files), keep original.
    if (blob.size >= file.size) return file;

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  }

  // ───── Validation ────────────────────────────────────────────────────
  function validate() {
    if (!imageInput.files || !imageInput.files[0]) return '사진을 첨부해주세요.';
    if (!author.value.trim())                       return '이름을 입력해주세요.';
    if (!message.value.trim())                      return '편지를 입력해주세요.';
    if (password.value.length < 2)                  return '비밀번호는 2자 이상으로 입력해주세요.';
    return null;
  }

  // ───── Button UI ─────────────────────────────────────────────────────
  function setBtnText(text) {
    const span = submitBtn.querySelector('span');
    if (span) span.textContent = text;
  }
  function resetBtn() {
    isSubmitting = false;
    submitBtn.disabled = false;
    setBtnText('편지 남기기');
  }

  // ───── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (isSubmitting) return;

    // 1) Flush IME composition. If user tapped the button while a Korean
    //    syllable was still being composed, give the browser a tick to
    //    commit it before we read the input values.
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    if (isComposing) {
      await new Promise((r) => setTimeout(r, 80));
    }

    formError.textContent = '';
    const err = validate();
    if (err) { formError.textContent = err; return; }

    isSubmitting = true;
    submitBtn.disabled = true;

    try {
      // 2) Compress
      setBtnText('사진 최적화 중...');
      const optimized = await optimizeImage(imageInput.files[0]);

      // 3) Upload
      setBtnText('편지 보내는 중...');
      const fd = new FormData();
      fd.append('author',   author.value.trim());
      fd.append('message',  message.value.trim());
      fd.append('password', password.value);
      fd.append('image',    optimized);

      const res = await fetch('/api/posts', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        formError.textContent = data.error || '업로드에 실패했어요.';
        resetBtn();
        return;
      }

      // 4) Success — keep button disabled, swap to success card
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      formError.textContent = '네트워크 오류가 발생했어요. 다시 시도해주세요.';
      resetBtn();
    }
  }

  // 3-tap fix: blur the focused input on pointerdown so the *first* tap on
  // the button isn't consumed by the input blurring + keyboard closing +
  // viewport reflow that normally happens between pointerdown and click.
  submitBtn.addEventListener('pointerdown', () => {
    if (document.activeElement
        && document.activeElement !== submitBtn
        && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }, { passive: true });

  // Bind to both click (button taps) and submit (Enter key in inputs).
  // The isSubmitting flag dedupes if both fire for the same action.
  submitBtn.addEventListener('click', handleSubmit);
  form.addEventListener('submit', handleSubmit);

  // ───── "한 번 더 남기기" ─────────────────────────────────────────────
  anotherBtn.addEventListener('click', () => {
    form.reset();
    preview.src = '';
    picker.classList.remove('has-image');
    clearImage.hidden = true;
    updateCount();
    success.hidden = true;
    form.hidden = false;
    resetBtn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();