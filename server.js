// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Google OAuth credentials - must be set via environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://badam-rewards.onrender.com/api/auth/google/callback'
    : 'http://localhost:3000/api/auth/google/callback');

// Validate required environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('Warning: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables for Google OAuth to work');
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
// Session configuration
app.set('trust proxy', 1); // ✅ Tell Express we're behind a proxy (Render)
app.use(session({
  secret: process.env.SESSION_SECRET || 'badam-rewards-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true, // ✅ Required for secure cookies behind proxy
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // ✅ Only secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // ✅ Allow cross-site cookies from OAuth
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));


// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, { userId: user.id, username: user.username || user.email, email: user.email, avatar_url: user.avatar_url });
});

passport.deserializeUser(async (userData, done) => {
  try {
    const result = await pool.query('SELECT id, username, email, avatar_url FROM users WHERE id = $1', [userData.userId]);
    if (result.rows.length === 0) {
      return done(null, false);
    }
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists with this Google ID
    let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
    
    if (result.rows.length > 0) {
      // User exists, return user
      return done(null, result.rows[0]);
    }

    // Check if user exists with this email (for account linking)
    if (profile.emails && profile.emails[0]) {
      result = await pool.query('SELECT * FROM users WHERE email = $1', [profile.emails[0].value]);
      if (result.rows.length > 0) {
        // Link Google account to existing user
        await pool.query(
          'UPDATE users SET google_id = $1, avatar_url = $2 WHERE email = $3',
          [profile.id, profile.photos && profile.photos[0] ? profile.photos[0].value : null, profile.emails[0].value]
        );
        result = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
        return done(null, result.rows[0]);
      }
    }

    // Create new user
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const displayName = profile.displayName || email || 'Google User';
    const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

    const insertResult = await pool.query(
      'INSERT INTO users (google_id, email, username, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [profile.id, email, displayName, avatarUrl]
    );

    const newUser = insertResult.rows[0];

    // Initialize badam count
    await pool.query('INSERT INTO badam_counts (user_id, count) VALUES ($1, $2)', [newUser.id, 0]);

    return done(null, newUser);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Helper function to get user from session (for backward compatibility)
function getUserFromSession(req) {
  if (req.user) {
    return {
      userId: req.user.id,
      username: req.user.username || req.user.email,
      email: req.user.email,
      avatar_url: req.user.avatar_url
    };
  }
  return null;
}

// Sign up endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    const userId = result.rows[0].id;

    // Initialize badam count
    await pool.query('INSERT INTO badam_counts (user_id, count) VALUES ($1, $2)', [userId, 0]);

    // Auto-login after signup
    req.login({ id: userId, username: result.rows[0].username }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Session creation failed' });
      }
      res.json({ message: 'User created successfully', username: result.rows[0].username });
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in endpoint
app.post('/api/signin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (only regular users, not Google users)
    const result = await pool.query('SELECT id, username, password FROM users WHERE username = $1 AND password IS NOT NULL', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    if (!user.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Create session using Passport
    req.login({ id: user.id, username: user.username }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Session creation failed' });
      }
      res.json({ message: 'Sign in successful', username: user.username });
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
app.get('/api/user', async (req, res) => {
  try {
    const user = getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ 
      username: user.username,
      email: user.email || null,
      avatar_url: user.avatar_url || null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get badam count
app.get('/api/badam', async (req, res) => {
  try {
    const user = getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query('SELECT count FROM badam_counts WHERE user_id = $1', [user.userId]);
    if (result.rows.length === 0) {
      // Initialize if not exists
      await pool.query('INSERT INTO badam_counts (user_id, count) VALUES ($1, $2)', [user.userId, 0]);
      return res.json({ count: 0 });
    }

    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Get badam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update badam count (legacy endpoint - kept for compatibility)
app.post('/api/badam', async (req, res) => {
  try {
    const user = getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { action } = req.body; // 'increment' or 'decrement'

    if (action !== 'increment' && action !== 'decrement') {
      return res.status(400).json({ error: 'Invalid action. Use "increment" or "decrement"' });
    }

    // Get current count
    let result = await pool.query('SELECT count FROM badam_counts WHERE user_id = $1', [user.userId]);
    let currentCount = 0;

    if (result.rows.length === 0) {
      await pool.query('INSERT INTO badam_counts (user_id, count) VALUES ($1, $2)', [user.userId, 0]);
    } else {
      currentCount = result.rows[0].count;
    }

    // Update count
    const newCount = action === 'increment' ? currentCount + 1 : Math.max(0, currentCount - 1);
    await pool.query(
      'UPDATE badam_counts SET count = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newCount, user.userId]
    );

    res.json({ count: newCount });
  } catch (error) {
    console.error('Update badam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync badam count to database (used after 10 second delay)
app.post('/api/badam/sync', async (req, res) => {
  try {
    const user = getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { count } = req.body;

    if (typeof count !== 'number' || count < 0) {
      return res.status(400).json({ error: 'Invalid count value' });
    }

    // Check if record exists
    let result = await pool.query('SELECT id FROM badam_counts WHERE user_id = $1', [user.userId]);
    
    if (result.rows.length === 0) {
      // Create new record
      await pool.query('INSERT INTO badam_counts (user_id, count) VALUES ($1, $2)', [user.userId, count]);
    } else {
      // Update existing record
      await pool.query(
        'UPDATE badam_counts SET count = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [count, user.userId]
      );
    }

    res.json({ count, message: 'Count synced successfully' });
  } catch (error) {
    console.error('Sync badam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard (top badam givers)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(`
      SELECT 
        COALESCE(u.username, u.email) as username,
        COALESCE(bc.count, 0) as count,
        u.created_at,
        u.avatar_url
      FROM users u
      LEFT JOIN badam_counts bc ON u.id = bc.user_id
      ORDER BY COALESCE(bc.count, 0) DESC, u.created_at ASC
      LIMIT $1
    `, [limit]);

    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/index.html?error=google_auth_failed' }),
  (req, res) => {
    // Successful authentication, redirect to main page
    res.redirect('/main.html');
  }
);

// Sign out endpoint
app.post('/api/signout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Sign out failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Signed out successfully' });
    });
  });
});

// Serve static files after API routes
app.use(express.static('public'));

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

