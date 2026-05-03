'use strict';
const path = require('path');
const fs   = require('fs');

try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    });
  }
} catch {}

const express     = require('express');
const cookieParser= require('cookie-parser');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const crypto      = require('crypto');
const db          = require('./db');
const enc         = require('./crypto');

const app  = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      mediaSrc:    ["'self'", 'blob:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'self'"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.disable('x-powered-by');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Upload rate limit exceeded.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Too many API requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
  },
}));

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/files/upload', uploadLimiter);
app.use('/api/files', apiLimiter, require('./routes/files'));

app.get('/api/share/:token', (req, res) => {
  const token = req.params.token;
  if (!token || token.length > 128) return res.status(400).json({ error: 'Invalid token' });
  const file = db.prepare('SELECT id, name, mime_type, size, created_at FROM files WHERE share_token = ? AND is_public = 1').get(token);
  if (!file) return res.status(404).json({ error: 'File not found or link expired' });
  res.json({ file: enc.decryptFile(file) });
});

app.get('/api/share/:token/preview', (req, res) => {
  const token = req.params.token;
  const file  = db.prepare('SELECT * FROM files WHERE share_token = ? AND is_public = 1').get(token);
  if (!file) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(uploadsDir, file.disk_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing on disk' });
  try {
    const plainBuf  = enc.decryptFileToBuffer(fp);
    const mimeType  = file.mime_type || 'application/octet-stream';
    const totalSize = plainBuf.length;
    const range     = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/, '').split('-');
      const start  = parseInt(s, 10);
      const end    = e ? parseInt(e, 10) : totalSize - 1;
      const chunk  = plainBuf.slice(start, end + 1);
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk.length,
        'Content-Type':   mimeType,
      });
      res.end(chunk);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      });
      res.end(plainBuf);
    }
  } catch {
    res.status(500).json({ error: 'Decryption failed' });
  }
});

app.get('/api/share/:token/download', (req, res) => {
  const token = req.params.token;
  const file  = db.prepare('SELECT * FROM files WHERE share_token = ? AND is_public = 1').get(token);
  if (!file) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(uploadsDir, file.disk_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing' });
  try {
    const plainBuf = enc.decryptFileToBuffer(fp);
    const realName = enc.decryptField(file.name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(realName)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', plainBuf.length);
    res.end(plainBuf);
  } catch {
    res.status(500).json({ error: 'Decryption failed' });
  }
});

app.get('/share/:token', (req, res) => res.sendFile(path.join(__dirname, '../public/share.html')));
app.get('/dashboard',    (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/login',        (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/register',     (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/',             (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    const keySet = process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32;
    const jwtSet = process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev_secret_please_change_in_production';
    console.log(`\n  🚀  7ostera Drive is running!`);
    console.log(`  ➜   http://localhost:${PORT}`);
    console.log(`\n  Security Status:`);
    console.log(`  ${keySet ? '✅' : '⚠️ '} ENCRYPTION_KEY ${keySet ? 'set' : 'NOT SET — files encrypted with fallback key'}`);
    console.log(`  ${jwtSet ? '✅' : '⚠️ '} JWT_SECRET     ${jwtSet ? 'set' : 'NOT SET — using dev default'}`);
    console.log(`  ✅  AES-256-GCM  File encryption active`);
    console.log(`  ✅  AES-256-CBC  Field encryption active`);
    console.log(`  ✅  Helmet       Security headers active`);
    console.log(`  ✅  Rate limiter Auth: 20/15min · API: 300/min\n`);
  });
}

module.exports = app;

