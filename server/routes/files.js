'use strict';
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const { v4: uuidv4 } = require('uuid');
const db           = require('../db');
const auth         = require('../middleware/auth');
const enc          = require('../crypto');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 500) * 1024 * 1024 },
});

router.use(auth);

router.get('/', (req, res) => {
  const { parent_id = null } = req.query;
  const files = db.prepare(`
    SELECT id, name, type, mime_type, size, share_token, is_public, created_at, updated_at, parent_id
    FROM files WHERE user_id = ? AND parent_id IS ?
    ORDER BY type DESC, created_at DESC
  `).all(req.user.id, parent_id === 'null' ? null : parent_id);
  res.json({ files: enc.decryptFiles(files) });
});

router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ files: [] });
  const files = db.prepare(`
    SELECT id, name, type, mime_type, size, share_token, is_public, created_at, updated_at, parent_id
    FROM files WHERE user_id = ? ORDER BY updated_at DESC
  `).all(req.user.id);
  const decrypted = enc.decryptFiles(files);
  const ql = q.toLowerCase();
  res.json({ files: decrypted.filter(f => f.name.toLowerCase().includes(ql)).slice(0, 50) });
});

router.get('/storage', (req, res) => {
  const user = db.prepare('SELECT storage_used, storage_limit FROM users WHERE id = ?').get(req.user.id);
  res.json({ used: user.storage_used, limit: user.storage_limit });
});

router.get('/breadcrumb', (req, res) => {
  const { folder_id } = req.query;
  if (!folder_id || folder_id === 'null') return res.json({ breadcrumb: [] });
  const crumbs = [];
  let currentId = folder_id;
  while (currentId) {
    const folder = db.prepare('SELECT id, name, parent_id FROM files WHERE id = ? AND user_id = ?').get(currentId, req.user.id);
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: enc.decryptField(folder.name) });
    currentId = folder.parent_id;
  }
  res.json({ breadcrumb: crumbs });
});

router.post('/upload', upload.array('files', 20), async (req, res) => {
  const { parent_id } = req.body;
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });

  const results = [];
  let totalSize = 0;

  for (const file of req.files) {
    const fileId    = uuidv4();
    const diskName  = fileId;
    const diskPath  = path.join(UPLOADS_DIR, diskName);

    const plainBuf  = file.buffer;
    const iv        = require('crypto').randomBytes(16);
    const cipher    = require('crypto').createCipheriv('aes-256-gcm', enc.MASTER_KEY, iv);
    const encrypted = Buffer.concat([
      Buffer.from([0x01]),
      iv,
      cipher.update(plainBuf),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(diskPath, Buffer.concat([encrypted, tag]));

    const encryptedName = enc.encryptField(file.originalname);

    db.prepare('INSERT INTO files (id, user_id, parent_id, name, type, mime_type, size, disk_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(fileId, req.user.id, parent_id || null, encryptedName, 'file', file.mimetype, file.size, diskName);

    totalSize += file.size;
    results.push({ id: fileId, name: file.originalname, size: file.size, mime_type: file.mimetype, type: 'file' });
  }

  db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(totalSize, req.user.id);
  res.json({ success: true, files: results });
});

router.post('/folder', (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  const encryptedName = enc.encryptField(name);
  db.prepare('INSERT INTO files (id, user_id, parent_id, name, type) VALUES (?, ?, ?, ?, ?)').run(id, req.user.id, parent_id || null, encryptedName, 'folder');
  res.json({ success: true, folder: { id, name, type: 'folder' } });
});

router.get('/:id/download', (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ? AND type = 'file'").get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(UPLOADS_DIR, file.disk_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing on disk' });
  try {
    const plainBuf = enc.decryptFileToBuffer(fp);
    const realName = enc.decryptField(file.name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(realName)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', plainBuf.length);
    res.end(plainBuf);
  } catch (e) {
    res.status(500).json({ error: 'Decryption failed' });
  }
});

router.get('/:id/preview', (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ? AND type = 'file'").get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(UPLOADS_DIR, file.disk_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing' });
  try {
    const plainBuf  = enc.decryptFileToBuffer(fp);
    const mimeType  = file.mime_type || 'application/octet-stream';
    const totalSize = plainBuf.length;
    const range     = req.headers.range;

    if (totalSize === 0) {
      res.writeHead(200, {
        'Content-Length': 0,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      });
      return res.end(plainBuf);
    }

    if (range) {
      let [s, e] = range.replace(/bytes=/, '').split('-');
      let start = s ? parseInt(s, 10) : 0;
      let end = e ? parseInt(e, 10) : totalSize - 1;

      if (isNaN(start)) start = 0;
      if (isNaN(end)) end = totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        return res.end();
      }

      const chunk = plainBuf.slice(start, end + 1);
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
  } catch (e) {
    console.error('Preview error:', e);
    res.status(500).json({ error: 'Preview failed', details: e.message });
  }
});

router.get('/:id/preview-zip', (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ? AND type = 'file'").get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  const fp = path.join(UPLOADS_DIR, file.disk_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing' });
  try {
    const plainBuf  = enc.decryptFileToBuffer(fp);
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(plainBuf);
    const zipEntries = zip.getEntries();

    const entries = zipEntries.map(e => ({
      entryName: e.entryName,
      isDirectory: e.isDirectory,
      size: e.header.size
    }));

    res.json({ success: true, entries });
  } catch (e) {
    res.status(500).json({ error: 'Decryption or unzip failed' });
  }
});

router.delete('/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (file.type === 'file') {
    const fp = path.join(UPLOADS_DIR, file.disk_path);
    if (fs.existsSync(fp)) {
      const size = fs.statSync(fp).size;
      const fd   = fs.openSync(fp, 'r+');
      fs.writeSync(fd, require('crypto').randomBytes(size), 0, size, 0);
      fs.closeSync(fd);
      fs.unlinkSync(fp);
    }
    db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(file.size, req.user.id);
  } else {
    deleteFolder(file.id, req.user.id);
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

function deleteFolder(folderId, userId) {
  const children = db.prepare('SELECT * FROM files WHERE parent_id = ? AND user_id = ?').all(folderId, userId);
  for (const child of children) {
    if (child.type === 'folder') {
      deleteFolder(child.id, userId);
    } else {
      const fp = path.join(UPLOADS_DIR, child.disk_path);
      if (fs.existsSync(fp)) {
        const size = fs.statSync(fp).size;
        const fd   = fs.openSync(fp, 'r+');
        fs.writeSync(fd, require('crypto').randomBytes(size), 0, size, 0);
        fs.closeSync(fd);
        fs.unlinkSync(fp);
      }
      db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(child.size, userId);
    }
    db.prepare('DELETE FROM files WHERE id = ?').run(child.id);
  }
}

router.patch('/:id/rename', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const file = db.prepare('SELECT id FROM files WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(enc.encryptField(name), req.params.id);
  res.json({ success: true, name });
});

router.post('/:id/share', (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ? AND type = 'file'").get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (file.is_public) {
    db.prepare('UPDATE files SET is_public = 0, share_token = NULL WHERE id = ?').run(req.params.id);
    res.json({ success: true, is_public: false, share_token: null });
  } else {
    const token = require('crypto').randomBytes(24).toString('base64url');
    db.prepare('UPDATE files SET is_public = 1, share_token = ? WHERE id = ?').run(token, req.params.id);
    res.json({ success: true, is_public: true, share_token: token });
  }
});

module.exports = router;
