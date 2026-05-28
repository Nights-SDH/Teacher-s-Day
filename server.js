// server.js
// Haeryong Dinosaur Era — 1주년 갤러리
// Admin-only uploads. No per-post passwords; a single ADMIN_PASSWORD
// gates the admin area where you add / edit / delete entries.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

// ───── Paths ─────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR
  || (fs.existsSync('/data') && isWritable('/data') ? '/data' : path.join(__dirname, 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'posts.json');

function isWritable(p) {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; }
}

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ───── Config ────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_PATH = process.env.ADMIN_PATH || 'curator-7f3a9c2e';

// ───── Store ─────────────────────────────────────────────────────────────
let cache = null;
let writeQueue = Promise.resolve();

function loadStore() {
  if (cache) return cache;
  if (fs.existsSync(DB_PATH)) {
    try { cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch (e) { console.error('DB parse failed:', e); cache = { nextId: 1, posts: [] }; }
  } else {
    cache = { nextId: 1, posts: [] };
  }
  return cache;
}

function saveStore() {
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

// ───── Multer ────────────────────────────────────────────────────────────
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
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('지원하지 않는 이미지 형식입니다.'));
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
    order: p.order ?? 0,
    nickname: p.nickname,
    description: p.description || '',
    captured_at: p.captured_at || '',
    created_at: p.created_at,
    image_url: `/api/posts/${p.id}/image`,
  };
}

function findPost(id) {
  return loadStore().posts.find((p) => p.id === Number(id));
}

function requireAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: 'ADMIN_PASSWORD not configured.' });
    return false;
  }
  if (String(req.body.password || '') !== ADMIN_PASSWORD) {
    res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

// ───── Public routes ─────────────────────────────────────────────────────
app.get('/api/posts', (_req, res) => {
  const store = loadStore();
  const sorted = store.posts.slice().sort((a, b) => {
    const oa = a.order ?? 0, ob = b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  res.json(sorted.map(postPublic));
});

app.get('/api/posts/:id/image', (req, res) => {
  const p = findPost(req.params.id);
  if (!p) return res.status(404).send('Not found');
  const filePath = path.join(UPLOADS_DIR, p.image_file);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');
  res.setHeader('Content-Type', p.image_mime);
  res.setHeader('Cache-Control', 'public, max-age=300');
  fs.createReadStream(filePath).pipe(res);
});

// ───── Admin routes ──────────────────────────────────────────────────────
app.get(`/${ADMIN_PATH}`, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/admin/login', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = loadStore();
  const posts = store.posts.slice().sort((a, b) => {
    const oa = a.order ?? 0, ob = b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  res.json({ ok: true, posts: posts.map(postPublic) });
});

app.post('/api/admin/posts', upload.single('image'), async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
      return;
    }

    const nickname = sanitizeText(req.body.nickname, 60);
    const description = sanitizeText(req.body.description, 1500);
    const captured_at = sanitizeText(req.body.captured_at, 40);

    if (!nickname) return res.status(400).json({ error: '별명을 입력해주세요.' });
    if (!req.file)  return res.status(400).json({ error: '사진을 첨부해주세요.' });

    const store = loadStore();
    const id = store.nextId++;
    const maxOrder = store.posts.reduce((m, p) => Math.max(m, p.order ?? 0), 0);
    const post = {
      id,
      order: maxOrder + 1,
      nickname,
      description,
      captured_at,
      image_file: req.file.filename,
      image_mime: req.file.mimetype,
      created_at: new Date().toISOString(),
    };
    store.posts.push(post);
    await saveStore();
    res.json(postPublic(post));
  } catch (e) {
    console.error(e);
    if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
    res.status(500).json({ error: e.message || '오류가 발생했습니다.' });
  }
});

app.put('/api/admin/posts/:id', upload.single('image'), async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
      return;
    }
    const p = findPost(req.params.id);
    if (!p) {
      if (req.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch {} }
      return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    }

    if (req.body.nickname !== undefined)    p.nickname    = sanitizeText(req.body.nickname, 60)    || p.nickname;
    if (req.body.description !== undefined) p.description = sanitizeText(req.body.description, 1500);
    if (req.body.captured_at !== undefined) p.captured_at = sanitizeText(req.body.captured_at, 40);
    if (req.body.order !== undefined && !isNaN(Number(req.body.order))) {
      p.order = Number(req.body.order);
    }

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
    res.status(500).json({ error: e.message || '오류가 발생했습니다.' });
  }
});

// Bulk reorder
app.post('/api/admin/reorder', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const order = req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array' });
  const store = loadStore();
  order.forEach((id, idx) => {
    const p = store.posts.find((x) => x.id === Number(id));
    if (p) p.order = idx + 1;
  });
  await saveStore();
  res.json({ ok: true });
});

app.delete('/api/admin/posts/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = loadStore();
  const idx = store.posts.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
  const p = store.posts[idx];
  const filePath = path.join(UPLOADS_DIR, p.image_file);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch {} }
  store.posts.splice(idx, 1);
  await saveStore();
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || '오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🦕 Dinosaur Era running on http://localhost:${PORT}`);
  console.log(`   Data dir: ${DATA_DIR}`);
  console.log(`   Admin path: /${ADMIN_PATH}`);
});
