const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false, { message: 'Google account has no email' });

          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.findOne({ email });
            if (user && !user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
          }

          if (!user) {
            const isFirstUser = (await User.countDocuments()) === 0;
            user = await User.create({
              fullName: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              role: isFirstUser ? 'admin' : 'user',
            });
          }

          if (!user.active) return done(null, false, { message: 'Account deactivated' });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { passport, googleEnabled };
