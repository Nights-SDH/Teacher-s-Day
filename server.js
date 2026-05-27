// server.js
// Teacher's Day tribute page — backend
// Stack: Express + Multer + bcryptjs + flat-file JSON store
// Why JSON instead of SQLite? No native deps, smaller image, faster cold start,
// trivially backup-able. For a lab-sized dataset (≤ a few hundred entries),
// performance is identical and we trade nothing meaningful.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');

// ───── Paths ─────────────────────────────────────────────────────────────
// On Railway, mount a persistent volume at /data so the DB + images survive
// re-deploys. Locally it falls back to ./data.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_PATH = process.env.ADMIN_PATH || 'manage-7f3a9c2e';
const RECIPIENT_PATH = process.env.RECIPIENT_PATH || 'for-yoonji-private';

const DATA_DIR = process.env.DATA_DIR
  || (fs.existsSync('/data') && isWritable('/data') ? '/data' : path.join(__dirname, 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'posts.json');

function isWritable(p) {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; }
}

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ───── Store (atomic JSON read/write with in-memory cache + lock) ────────
let cache = null;
let writeQueue = Promise.resolve();

function loadStore() {
  if (cache) return cache;
  if (fs.existsSync(DB_PATH)) {
    try {
      const txt = fs.readFileSync(DB_PATH, 'utf8');
      cache = JSON.parse(txt);
    } catch (e) {
      console.error('Failed to parse DB; starting fresh:', e);
      cache = { nextId: 1, posts: [] };
    }
  } else {
    cache = { nextId: 1, posts: [] };
  }
  return cache;
}

function saveStore() {
  // Atomic write: tmp file then rename. Queued so concurrent writes don't race.
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    const tmp = DB_PATH + '.tmp';
    fs.writeFile(tmp, JSON.stringify(cache, null, 2), (err) => {
      if (err) return reject(err);
      fs.rename(tmp, DB_PATH, (err2) => err2 ? reject(err2) : resolve());
    });
  })).catch((e) => console.error('saveStore error:', e));
  return writeQueue;
}

loadStore();

// ───── App ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ───── Multer (upload handling) ──────────────────────────────────────────
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8);
    const safe = /^\.[a-z0-9]+$/.test(ext) ? ext : '';
    cb(null, `${crypto.randomUUID()}${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('지원하지 않는 이미지 형식입니다 (jpg/png/webp/gif).'));
  },
});

// ───── Helpers ───────────────────────────────────────────────────────────
function sanitizeText(s, max = 2000) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function postPublic(p) {
  return {
    id: p.id,
    author: p.author,
    message: p.message,
    created_at: p.created_at,
    image_url: `/api/posts/${p.id}/image`,
  };
}

function findPost(id) {
  const store = loadStore();
  return store.posts.find((p) => p.id === Number(id));
}

// ───── Routes ────────────────────────────────────────────────────────────
// ───── Admin ─────────────────────────────────────────────────────────
// Serve the admin page only at the secret path
app.get(`/${ADMIN_PATH}`, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Recipient-only page — all letters visible without password
app.get(`/${RECIPIENT_PATH}`, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recipient.html'));
});

// Admin login — returns a list of all posts (with timestamps) if pw matches
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin password not configured.' });
  }
  if (String(req.body.password || '') !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password.' });
  }
  const store = loadStore();
  const posts = store.posts
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(postPublic);
  res.json({ ok: true, posts });
});

// Admin delete — requires the admin password
app.delete('/api/admin/posts/:id', async (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin password not configured.' });
  }
  if (String(req.body.password || '') !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password.' });
  }
  const store = loadStore();
  const idx = store.posts.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  const p = store.posts[idx];
  const filePath = path.join(UPLOADS_DIR, p.image_file);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch {} }
  store.posts.splice(idx, 1);
  await saveStore();
  res.json({ ok: true });
});

// Upload page (separate path per requirement #2)
app.get('/upload', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// List posts (public)
app.get('/api/posts', (_req, res) => {
  const store = loadStore();
  const sorted = store.posts.slice().sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );
  res.json(sorted.map(postPublic));
});

// Serve image binary
app.get('/api/posts/:id/image', (req, res) => {
  const p = findPost(req.params.id);
  if (!p) return res.status(404).send('Not found');
  const filePath = path.join(UPLOADS_DIR, p.image_file);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');
  res.setHeader('Content-Type', p.image_mime);
  res.setHeader('Cache-Control', 'public, max-age=300');
  fs.createReadStream(filePath).pipe(res);
});

// Create
app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const author = sanitizeText(req.body.author, 40);
    const message = sanitizeText(req.body.message, 1500);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!author)  return res.status(400).json({ error: '이름을 입력해주세요.' });
    if (!message) return res.status(400).json({ error: '편지를 입력해주세요.' });
    if (password.length < 2) return res.status(400).json({ error: '비밀번호를 입력해주세요. (2자 이상)' });
    if (!req.file) return res.status(400).json({ error: '사진을 첨부해주세요.' });

    const hash = await bcrypt.hash(password, 10);
    const store = loadStore();
    const id = store.nextId++;
    const post = {
      id,
      author,
      message,
      image_file: req.file.filename,
      image_mime: req.file.mimetype,
      password_hash: hash,
      created_at: new Date().toISOString(),
    };
    store.posts.push(post);
    await saveStore();

    res.json(postPublic(post));
  } catch (e) {
    console.error(e);
    // Clean up the uploaded file if persistence failed
    if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
    res.status(500).json({ error: e.message || '업로드 중 오류가 발생했습니다.' });
  }
});

// Verify password
app.post('/api/posts/:id/verify', async (req, res) => {
  const p = findPost(req.params.id);
  if (!p) return res.status(404).json({ ok: false });
  const ok = await bcrypt.compare(String(req.body.password || ''), p.password_hash);
  res.json({ ok });
});

// Update (author / message / optional new image)
app.put('/api/posts/:id', upload.single('image'), async (req, res) => {
  try {
    const p = findPost(req.params.id);
    if (!p) {
      if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
      return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    }

    const ok = await bcrypt.compare(String(req.body.password || ''), p.password_hash);
    if (!ok) {
      if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    if (req.body.author !== undefined)  p.author = sanitizeText(req.body.author, 40) || p.author;
    if (req.body.message !== undefined) p.message = sanitizeText(req.body.message, 1500) || p.message;

    if (req.file) {
      const oldPath = path.join(UPLOADS_DIR, p.image_file);
      if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch {} }
      p.image_file = req.file.filename;
      p.image_mime = req.file.mimetype;
    }

    await saveStore();
    res.json(postPublic(p));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || '수정 중 오류가 발생했습니다.' });
  }
});

// Delete
app.delete('/api/posts/:id', async (req, res) => {
  const store = loadStore();
  const idx = store.posts.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });

  const p = store.posts[idx];
  const ok = await bcrypt.compare(String(req.body.password || ''), p.password_hash);
  if (!ok) return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });

  const filePath = path.join(UPLOADS_DIR, p.image_file);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch {} }
  store.posts.splice(idx, 1);
  await saveStore();
  res.json({ ok: true });
});

// Error handler (multer file-too-large etc.)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || '오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✨ Teacher's Day server running on http://localhost:${PORT}`);
  console.log(`   Data dir: ${DATA_DIR}`);
});
