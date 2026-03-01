const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway's reverse proxy
app.set('trust proxy', 1);

// ──────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'copperhead-portal-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Main Copperhead homepage (public)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
// Serve main site assets (videos, images) from parent directory
app.use('/home-assets', express.static(path.join(__dirname, '..')));

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config for asset uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|pdf|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  }
});

// ──────────────────────────────────────────
// Auth — supports client + admin roles
// Client:  journals. / peepeepoopoo
// Admin:   journals.@admin / gingershavesouls
// ──────────────────────────────────────────
const ACCOUNTS = [
  { username: 'journals.', password: 'peepeepoopoo', role: 'client' },
  { username: 'journals.@admin', password: 'gingershavesouls', role: 'admin' }
];

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.authenticated && req.session.role === 'admin') return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Forbidden' });
  return res.redirect('/login');
}

// Login page (public)
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect(req.session.role === 'admin' ? '/admin' : '/portal');
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const account = ACCOUNTS.find(a => a.username === username && a.password === password);
  if (account) {
    req.session.authenticated = true;
    req.session.role = account.role;
    return res.json({ success: true, role: account.role });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Session info (so front-end knows the role)
app.get('/api/session', requireAuth, (req, res) => {
  res.json({ role: req.session.role || 'client' });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ──────────────────────────────────────────
// Protected routes
// ──────────────────────────────────────────
app.get('/portal', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// ──────────────────────────────────────────
// Posts API
// ──────────────────────────────────────────
app.get('/api/posts', requireAuth, (req, res) => {
  const { status, platform, month, year } = req.query;
  const posts = db.getPosts({ status, platform, month, year });
  res.json(posts);
});

app.get('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.post('/api/posts', requireAuth, (req, res) => {
  const post = db.createPost(req.body);
  res.json(post);
});

app.patch('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.updatePost(req.params.id, req.body);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  db.deletePost(req.params.id);
  res.json({ success: true });
});

// ──────────────────────────────────────────
// Comments API
// ──────────────────────────────────────────
app.get('/api/posts/:id/comments', requireAuth, (req, res) => {
  const comments = db.getComments(req.params.id);
  res.json(comments);
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const comment = db.createComment(req.params.id, req.body);
  res.json(comment);
});

// ──────────────────────────────────────────
// Analytics API
// ──────────────────────────────────────────
app.get('/api/analytics', requireAuth, (req, res) => {
  const data = db.getAnalytics(req.query);
  res.json(data);
});

app.get('/api/analytics/summary', requireAuth, (req, res) => {
  const summary = db.getAnalyticsSummary(req.query);
  res.json(summary);
});

// ──────────────────────────────────────────
// Assets API
// ──────────────────────────────────────────
app.get('/api/assets', requireAuth, (req, res) => {
  const assets = db.getAssets();
  res.json(assets);
});

app.post('/api/assets', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const asset = db.createAsset({
    filename: req.file.filename,
    original_name: req.file.originalname,
    file_type: req.file.mimetype,
    file_size: req.file.size
  });
  res.json(asset);
});

app.delete('/api/assets/:id', requireAuth, (req, res) => {
  const asset = db.getAsset(req.params.id);
  if (asset) {
    const filePath = path.join(uploadsDir, asset.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.deleteAsset(req.params.id);
  }
  res.json({ success: true });
});

// ──────────────────────────────────────────
// Start
// ──────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ┌──────────────────────────────────────┐`);
  console.log(`  │                                      │`);
  console.log(`  │   copperhead portal running          │`);
  console.log(`  │   http://0.0.0.0:${PORT}              │`);
  console.log(`  │                                      │`);
  console.log(`  │   client: journals.                  │`);
  console.log(`  │   admin:  journals.@admin             │`);
  console.log(`  │                                      │`);
  console.log(`  └──────────────────────────────────────┘\n`);
});
