const User = require('../models/User');

async function loadUser(req, res, next) {
  if (!req.session.userId) return next();
  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.active) {
      req.session.destroy(() => {});
      return next();
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
