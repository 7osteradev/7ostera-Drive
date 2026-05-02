'use strict';
const jwt = require('jsonwebtoken');
const db  = require('../db');
const enc = require('../crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_please_change_in_production';

module.exports = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const raw = db.prepare('SELECT id, name, email, storage_used, storage_limit FROM users WHERE id = ?').get(payload.id);
    if (!raw) return res.status(401).json({ error: 'User not found' });
    req.user = enc.decryptUser(raw);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
