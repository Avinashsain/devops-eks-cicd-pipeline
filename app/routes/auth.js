const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { passport, googleEnabled } = require('../config/passport');

const router = express.Router();

function isValidEmail(email) {
  if (typeof email !== 'string' || email.length === 0 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return false;
  const domain = email.slice(atIndex + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

function isValidFullName(fullName) {
  if (typeof fullName !== 'string') return false;
  const trimmed = fullName.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

router.post('/register', asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!isValidFullName(fullName)) {
    return res.status(400).json({ error: 'Full name is required (max 100 characters)' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const isFirstUser = (await User.countDocuments()) === 0;
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    fullName: fullName.trim(),
    email: email.toLowerCase(),
    passwordHash,
    role: isFirstUser ? 'admin' : 'user',
  });

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not create session' });
    req.session.userId = user._id.toString();
    res.status(201).json(user.toSafeJSON());
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user?.active || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not create session' });
    req.session.userId = user._id.toString();
    res.json(user.toSafeJSON());
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).send();
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user.toSafeJSON());
});

router.get('/providers', (req, res) => {
  res.json({ google: googleEnabled });
});

if (googleEnabled) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: true })
  );

  router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: false, state: true }, (err, user, info) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return res.redirect('/login?error=google');
      }
      if (!user) {
        console.error('Google OAuth denied:', info);
        return res.redirect('/login?error=google');
      }
      req.session.regenerate((regenErr) => {
        if (regenErr) return res.redirect('/login?error=google');
        req.session.userId = user._id.toString();
        res.redirect('/');
      });
    })(req, res, next);
  });
}

module.exports = router;
