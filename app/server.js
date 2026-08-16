const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const authRouter = require('./routes/auth');
const todosRouter = require('./routes/todos');
const adminRouter = require('./routes/admin');
const { connectDB } = require('./db');
const { loadUser, requireAuth, requireAdmin } = require('./middleware/auth');
const { passport } = require('./config/passport');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

function buildSessionMiddleware(mongoUrl) {
  const store = MongoStore.create({ mongoUrl, collectionName: 'sessions' });
  const middleware = session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Flip via COOKIE_SECURE=true once the ingress terminates TLS —
      // a browser will silently drop a `secure` cookie sent over plain HTTP.
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
  return { middleware, store };
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

function mountRoutes() {
  app.use(passport.initialize());
  app.use('/api/auth', authRouter);
  app.use('/api/todos', requireAuth, todosRouter);
  app.use('/api/admin', requireAuth, requireAdmin, adminRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

const PORT = process.env.PORT || 3009;

if (require.main === module) {
  require('dotenv').config();
  if (!process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET must be set');
    process.exit(1);
  }
  connectDB(process.env.MONGODB_URI)
    .then(() => {
      const { middleware } = buildSessionMiddleware(process.env.MONGODB_URI);
      app.use(middleware);
      app.use(loadUser);
      mountRoutes();
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB', err);
      process.exit(1);
    });
}

module.exports = { app, buildSessionMiddleware, loadUser, mountRoutes };
