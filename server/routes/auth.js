'use strict';
const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db         = require('../db');
const authMiddle = require('../middleware/auth');
const enc        = require('../crypto');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev_secret_please_change_in_production';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id, email FROM users').all();
  const emailLower = email.toLowerCase().trim();
  for (const u of existing) {
    if (enc.decryptField(u.email).toLowerCase() === emailLower)
      return res.status(400).json({ error: 'Email already registered' });
  }

  const id           = uuidv4();
  const hashed       = bcrypt.hashSync(password, 12);
  const encName      = enc.encryptField(name.trim());
  const encEmail     = enc.encryptField(emailLower);

  db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)')
    .run(id, encName, encEmail, hashed);

  const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  res.cookie('token', token, COOKIE_OPTS);
  res.json({ success: true, user: { id, name: name.trim(), email: emailLower } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'All fields are required' });

  const emailLower = email.toLowerCase().trim();
  const allUsers   = db.prepare('SELECT * FROM users').all();
  let matchedUser  = null;
  for (const u of allUsers) {
    const decEmail = enc.decryptField(u.email);
    if (decEmail.toLowerCase() === emailLower) { matchedUser = u; break; }
  }

  if (!matchedUser) {
    bcrypt.compareSync(password, '$2a$12$invalidhashforenumerationprotect000000000000000000000000');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!bcrypt.compareSync(password, matchedUser.password))
    return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ id: matchedUser.id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  res.cookie('token', token, COOKIE_OPTS);
  res.json({
    success: true,
    user: {
      id: matchedUser.id,
      name: enc.decryptField(matchedUser.name),
      email: enc.decryptField(matchedUser.email),
    },
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
  res.json({ success: true });
});

router.get('/me', authMiddle, (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authMiddle, (req, res) => {
  const { name, email, oldPassword, password } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  const emailLower = email.toLowerCase().trim();

  const allUsers = db.prepare('SELECT id, email FROM users').all();
  for (const u of allUsers) {
    if (u.id !== req.user.id && enc.decryptField(u.email).toLowerCase() === emailLower)
      return res.status(400).json({ error: 'Email already in use' });
  }

  const encName  = enc.encryptField(name.trim());
  const encEmail = enc.encryptField(emailLower);

  if (password && password.length > 0) {
    if (!oldPassword) return res.status(400).json({ error: 'Old password is required to set a new password' });

    const dbUser = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, dbUser.password)) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hashed = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(encName, encEmail, hashed, req.user.id);
  } else {
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(encName, encEmail, req.user.id);
  }

  res.json({ success: true });
});

module.exports = router;
