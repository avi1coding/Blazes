require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = process.env.DB_PATH || 'blazes.db';

// Database: Turso (remote) or local SQLite file
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`,
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});

// Compatibility wrapper — provides the same callback API as sqlite3
// so the rest of the 6700+ lines of code work without changes
const db = {
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    tursoClient.execute({ sql, args: params || [] })
      .then(result => {
        if (callback) callback.call(
          { lastID: Number(result.lastInsertRowid), changes: result.rowsAffected },
          null
        );
      })
      .catch(err => {
        if (callback) callback.call({}, err);
        // No callback = fire-and-forget (schema setup), silently ignore errors
      });
  },
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    tursoClient.execute({ sql, args: params || [] })
      .then(result => {
        if (callback) callback(null, result.rows[0] || undefined);
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    tursoClient.execute({ sql, args: params || [] })
      .then(result => {
        if (callback) callback(null, result.rows);
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  serialize(callback) {
    // sqlite3.serialize guarantees sequential execution;
    // @libsql/client handles this via its own queue, so just call through
    if (callback) callback();
  },
};

const path = require('path');
const fs = require('fs');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
console.log('[Stripe]', stripe ? 'Initialized' : 'NOT configured (no STRIPE_SECRET_KEY)');
const Groq = require('groq-sdk');
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
console.log('[AI]', groq ? 'Groq initialized' : 'NOT configured (no GROQ_API_KEY)');

const cookieParser = require('cookie-parser');
const XLSX = require('xlsx');
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || null;
const FRONTEND_URL = process.env.FRONTEND_URL || RENDER_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || RENDER_URL || 'http://localhost:5000';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(cookieParser());
// Serve uploaded question images
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Render (and most PaaS) terminate TLS at a proxy and forward plain HTTP.
// Without this, req.protocol is 'http' and express-session refuses to send
// the `secure` cookie below, so sessions never persist in production.
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user));
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/auth/google/callback`,
  }, (accessToken, refreshToken, params, profile, done) => {
    try {
      const email = profile.emails[0].value.toLowerCase();
      const name = profile.displayName;
      const newScopes = (params && params.scope) || '';
      const newHasClassroom = newScopes.includes('classroom.');
      dbGetRetry('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) { console.error('[Auth] DB lookup error (after retries):', err); return done(err); }
        if (user) {
          const existingScopes = user.google_scopes || '';
          const existingHasClassroom = existingScopes.includes('classroom.');
          const shouldUpdateToken = !existingHasClassroom || newHasClassroom;
          if (accessToken && shouldUpdateToken) {
            db.run('UPDATE users SET google_access_token = ?, google_refresh_token = COALESCE(?, google_refresh_token), google_scopes = ? WHERE id = ?',
              [accessToken, refreshToken || null, newScopes, user.id]);
          } else if (refreshToken) {
            db.run('UPDATE users SET google_refresh_token = ? WHERE id = ?', [refreshToken, user.id]);
          }
          return done(null, user);
        }
        // New user — fetch birthday from Google People API to determine role
        const createUser = (role) => {
          console.log('[Auth] Creating new user:', email, 'role:', role);
          db.run('INSERT INTO users (email, name, role, google_access_token, google_refresh_token, google_scopes) VALUES (?, ?, ?, ?, ?, ?)',
            [email, name, role, accessToken || null, refreshToken || null, newScopes], function(err) {
            if (err) { console.error('[Auth] User insert error:', err); return done(err); }
            const userId = this.lastID;
            console.log('[Auth] New user created, id:', userId);
            db.run('INSERT INTO user_stats (user_id) VALUES (?)', [userId]);
            db.run('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);
            db.run('INSERT OR IGNORE INTO user_equipped (user_id, avatar_skin) VALUES (?, ?)', [userId, randomBasicSkin()]);
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, newUser) => {
              if (err) console.error('[Auth] User fetch error:', err);
              done(err, newUser);
            });
          });
        };
        // Always create new users as pending — they'll pick teacher/student on first sign-in
        createUser('pending');
      });
    } catch (e) {
      console.error('[Auth] Google strategy error:', e);
      done(e);
    }
  }));
}

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback',
  // Custom callback: failureRedirect only covers auth *failures*, not *errors*.
  // A thrown token-exchange error or done(err) would otherwise fall through to
  // the global handler and render raw {"error":"Internal server error"} JSON.
  (req, res, next) => {
    passport.authenticate('google', (err, user) => {
      if (err) {
        console.error('[Auth] Google callback error:', err);
        const reason = encodeURIComponent(err.message || 'unknown');
        return res.redirect(`${FRONTEND_URL}/login?error=google_failed&reason=${reason}`);
      }
      if (!user) return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Auth] Google session login error:', loginErr);
          return res.redirect(`${FRONTEND_URL}/login?error=google_failed&reason=session`);
        }
        next();
      });
    })(req, res, next);
  },
  async (req, res) => {
    try {
    const user = req.user;
    if (!user) return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);

    // If this was a password reset flow (verified by httpOnly cookie + server-side nonce)
    const resetNonce = req.cookies?.blazes_reset_nonce;
    if (resetNonce && pendingGoogleResets.has(resetNonce)) {
      pendingGoogleResets.delete(resetNonce); // one-time use
      res.clearCookie('blazes_reset_nonce');
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
        return res.redirect(`${FRONTEND_URL}/reset-password?token=${token}`);
      } catch (err) {
        console.error('[Auth] Google reset token error:', err);
        return res.redirect(`${FRONTEND_URL}/forgot-password?error=reset_failed`);
      }
    }


    db.run('INSERT INTO login_activity (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
      [user.id, req.ip, req.headers['user-agent'] || 'Unknown']);
    const userData = encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role }));
    if (user.role === 'pending') {
      res.redirect(`${FRONTEND_URL}/auth/callback?token=jwt-token-here&user=${userData}&new=true`);
    } else {
      res.redirect(`${FRONTEND_URL}/auth/callback?token=jwt-token-here&user=${userData}`);
    }
    } catch (err) {
      console.error('[Auth] Google callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }
  }
);

const CLASSROOM_SCOPES = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
];

// Google Classroom: connect (requests classroom scopes, uses same callback URL)
app.get('/auth/google/classroom', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${FRONTEND_URL}/home/teacher?error=google_not_configured`);
  passport.authenticate('google', {
    scope: CLASSROOM_SCOPES,
    accessType: 'offline',
    prompt: 'consent',
  })(req, res, next);
});

// Middleware: require an authenticated session (only Google OAuth logins create sessions).
function requireGoogleSession(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Please sign in with Google to use Classroom features.' });
  }
  next();
}

function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher account required.' });
  }
  next();
}

// Fetch with automatic Google token refresh on 401.
async function googleFetch(userId, url) {
  const user = await dbGet('SELECT google_access_token, google_scopes FROM users WHERE id = ?', [userId]);
  if (!user?.google_access_token || !(user.google_scopes || '').includes('classroom.')) {
    const err = new Error('Google Classroom not connected');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  let token = user.google_access_token;
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    token = await refreshGoogleToken(userId);
    if (!token) {
      const err = new Error('Token expired. Please reconnect Google Classroom.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  return response;
}

async function fetchCourseStudents(userId, courseId) {
  const students = [];
  let pageToken;
  do {
    const url = `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/students?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await googleFetch(userId, url);
    if (!response.ok) throw new Error(`Google Classroom API error (${response.status})`);
    const data = await response.json();
    for (const s of data.students || []) {
      const email = s.profile?.emailAddress?.toLowerCase();
      if (!email) continue;
      students.push({ email, name: s.profile?.name?.fullName || '' });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return students;
}

// Google Classroom API: list classes for the signed-in teacher
app.get('/api/google-classroom/courses', requireGoogleSession, requireTeacher, async (req, res) => {
  try {
    const response = await googleFetch(req.user.id, 'https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE');
    if (!response.ok) return res.status(response.status).json({ error: 'Google Classroom API error' });
    const data = await response.json();
    res.json(data.courses || []);
  } catch (err) {
    if (err.code === 'NOT_CONNECTED' || err.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    console.error('[Google Classroom] courses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Google Classroom: import a course into Blazes (fetches students server-side; client cannot inject).
app.post('/api/google-classroom/import', requireGoogleSession, requireTeacher, async (req, res) => {
  const userId = req.user.id;
  const { courseId, courseName } = req.body;
  if (!courseId || !courseName) return res.status(400).json({ error: 'courseId and courseName required' });
  try {
    const students = await fetchCourseStudents(userId, courseId);

    const classroomId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO classrooms (teacher_id, name, subject) VALUES (?, ?, ?)',
        [userId, courseName, 'Imported from Google Classroom'], function (err) { err ? reject(err) : resolve(this.lastID); });
    });

    const teacherInfo = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);

    let invited = 0;
    const notFound = [];
    for (const s of students) {
      const student = await dbGet('SELECT id FROM users WHERE email = ? AND role = ?', [s.email, 'student']);
      if (!student) { notFound.push({ email: s.email, name: s.name }); continue; }
      try {
        const inserted = await dbRun('INSERT OR IGNORE INTO classroom_students (classroom_id, student_id, status) VALUES (?, ?, ?)', [classroomId, student.id, 'pending']);
        if (inserted) {
          invited++;
          if (await shouldNotify(student.id, 'classroom_invite')) {
            await dbRun('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
              [student.id, 'classroom_invite', 'Classroom Invitation',
                `${teacherInfo?.name || 'Your teacher'} invited you to "${courseName}"`,
                `classroom_invite:${classroomId}`]);
          }
        }
      } catch (_) { }
    }

    res.json({ classroomId, invited, added: invited, notFound, total: students.length });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED' || err.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    console.error('[Google Classroom] import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: refresh Google token
async function refreshGoogleToken(userId) {
  try {
    const user = await dbGet('SELECT google_refresh_token FROM users WHERE id = ?', [userId]);
    if (!user?.google_refresh_token) return null;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: user.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      // data.scope reflects what the refreshed token is actually valid for.
      if (data.scope) {
        await dbRun('UPDATE users SET google_access_token = ?, google_scopes = ? WHERE id = ?', [data.access_token, data.scope, userId]);
      } else {
        await dbRun('UPDATE users SET google_access_token = ? WHERE id = ?', [data.access_token, userId]);
      }
      return data.access_token;
    }
    return null;
  } catch (err) {
    console.error('[Google] token refresh error:', err);
    return null;
  }
}

// Create users table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT,
  name TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Create stats table
db.run(`CREATE TABLE IF NOT EXISTS user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  gamesWon INTEGER DEFAULT 0,
  dayStreak INTEGER DEFAULT 0,
  accuracyRate INTEGER DEFAULT 0,
  totalGames INTEGER DEFAULT 0,
  winRate REAL DEFAULT 0,
  avgScore INTEGER DEFAULT 0,
  questionsAnswered INTEGER DEFAULT 0,
  currentXP INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  totalGamesHosted INTEGER DEFAULT 0,
  activeStudents INTEGER DEFAULT 0,
  totalCorrectAnswers INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);
db.run(`ALTER TABLE user_stats ADD COLUMN totalCorrectAnswers INTEGER DEFAULT 0`, () => { });

// Create games table
db.run(`CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER,
  game_code TEXT UNIQUE,
  kit_id INTEGER,
  game_mode TEXT DEFAULT 'classic_timed', -- Default game mode
  game_type TEXT DEFAULT 'live', -- 'live' or 'assignment'
  subject TEXT,
  status TEXT DEFAULT 'waiting',
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  ended_at DATETIME,
  FOREIGN KEY(host_id) REFERENCES users(id),
  FOREIGN KEY(kit_id) REFERENCES question_kits(id)
)`);

// Create game participants table
db.run(`CREATE TABLE IF NOT EXISTS game_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER,
  user_id INTEGER,
  player_name TEXT,
  score INTEGER DEFAULT 0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(game_id) REFERENCES games(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Create activity table
db.run(`CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  activity_type TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Create question kits table
db.run(`CREATE TABLE IF NOT EXISTS question_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER,
  title TEXT,
  subject TEXT,
  grade_level TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(teacher_id) REFERENCES users(id)
)`);

// Create questions table
db.run(`CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_id INTEGER,
  question_text TEXT,
  answer_type TEXT,
  correct_answer TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  time_limit INTEGER DEFAULT 30,
  points INTEGER DEFAULT 100,
  FOREIGN KEY(kit_id) REFERENCES question_kits(id)
)`);

// Create game answers table
db.run(`CREATE TABLE IF NOT EXISTS game_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER,
  user_id INTEGER,
  question_id INTEGER,
  answer TEXT,
  is_correct BOOLEAN,
  time_taken INTEGER,
  points_earned INTEGER,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(game_id) REFERENCES games(id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(question_id) REFERENCES questions(id)
)`);

// BlazesBucks balance table (one row per student)
db.run(`CREATE TABLE IF NOT EXISTS blazes_bucks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  balance INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// BlazesBucks transaction log
db.run(`CREATE TABLE IF NOT EXISTS blazes_bucks_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount INTEGER,
  reason TEXT,
  game_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);


// User achievements table
db.run(`CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  achievement_id TEXT,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Error analyst review counter table
db.run(`CREATE TABLE IF NOT EXISTS review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  review_count INTEGER DEFAULT 0
)`);


// User skins ownership table
db.run(`CREATE TABLE IF NOT EXISTS user_skins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  skin_id TEXT,
  skin_type TEXT DEFAULT 'avatar',
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stock_rotation TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);
// Migration: ensure user_skins has no UNIQUE constraint (allows duplicates for pack skins)
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_skins'", (_, row) => {
  if (row && row.sql && row.sql.includes('UNIQUE')) {
    console.log('[Migration] Removing UNIQUE constraint from user_skins...');
    db.serialize(() => {
      db.run(`CREATE TABLE user_skins_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, skin_id TEXT,
        skin_type TEXT DEFAULT 'avatar', purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        stock_rotation TEXT, FOREIGN KEY(user_id) REFERENCES users(id)
      )`);
      db.run(`INSERT INTO user_skins_v2 (user_id, skin_id, skin_type, purchased_at)
        SELECT user_id, skin_id, skin_type, purchased_at FROM user_skins`);
      db.run(`DROP TABLE user_skins`);
      db.run(`ALTER TABLE user_skins_v2 RENAME TO user_skins`, () => {
        console.log('[Migration] user_skins UNIQUE constraint removed successfully');
      });
    });
  }
});


// Rotating skin stock (resets every 3 hours)
db.run(`CREATE TABLE IF NOT EXISTS skin_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_ids TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
)`);
// User equipped skins
db.run(`CREATE TABLE IF NOT EXISTS user_equipped (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  avatar_skin TEXT DEFAULT 'default',
  bar_skin TEXT DEFAULT 'default',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Add joined_game_at to game_participants if it doesn't exist yet
db.run(`ALTER TABLE game_participants ADD COLUMN joined_game_at DATETIME`, () => { });
// Survival mode columns
db.run(`ALTER TABLE game_participants ADD COLUMN lives INTEGER DEFAULT 3`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN eliminated INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN eliminated_at_round INTEGER`, () => { });
// Survival synchronized round columns
db.run(`ALTER TABLE games ADD COLUMN current_question_index INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE games ADD COLUMN round_started_at DATETIME`, () => { });
db.run(`ALTER TABLE games ADD COLUMN round_ended_at DATETIME`, () => { });
db.run(`ALTER TABLE games ADD COLUMN round_status TEXT DEFAULT 'answering'`, () => { });
db.run(`ALTER TABLE games ADD COLUMN sudden_death INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE games ADD COLUMN rounds_played INTEGER DEFAULT 0`, () => { });
// Elemental Clash columns
db.run(`ALTER TABLE game_participants ADD COLUMN team INTEGER`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN energy_points INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE games ADD COLUMN team_1_score INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE games ADD COLUMN team_2_score INTEGER DEFAULT 0`, () => { });
// Set when the host bails out mid-game; results page renders a different
// message ("host ended early") instead of the placement leaderboard.
db.run(`ALTER TABLE games ADD COLUMN abandoned INTEGER DEFAULT 0`, () => { });

// ─── Indexes ─────────────────────────────────────────────────────────────
// These columns are queried/joined/filtered constantly (kit lookups, game
// answers per question, participants per game, BB log per user, etc.).
// Without indexes, every query did a full table scan. Adding these cuts
// most read paths from O(n) to O(log n) and dramatically speeds up CRUD
// + the teacher analytics endpoint. CREATE INDEX IF NOT EXISTS is idempotent.
db.run(`CREATE INDEX IF NOT EXISTS idx_questions_kit_id ON questions(kit_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_game_answers_question_id ON game_answers(question_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_game_answers_game_id ON game_answers(game_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_game_answers_user_id ON game_answers(user_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_game_participants_user_id ON game_participants(user_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_games_host_id ON games(host_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_games_kit_id ON games(kit_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_question_kits_teacher_id ON question_kits(teacher_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_kit_id ON assignments(kit_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON assignments(classroom_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_classroom_students_student_id ON classroom_students(student_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_classroom_students_classroom_id ON classroom_students(classroom_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id)`, () => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_blazes_bucks_log_user_id ON blazes_bucks_log(user_id)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS elemental_attacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER,
  attacker_user_id INTEGER,
  attack_type TEXT,
  energy_cost INTEGER,
  damage INTEGER,
  target_team INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(game_id) REFERENCES games(id)
)`);
db.run(`CREATE TABLE IF NOT EXISTS game_answers_claimed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER,
  user_id INTEGER,
  question_id INTEGER,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
// Classrooms & Assignments
db.run(`CREATE TABLE IF NOT EXISTS classrooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER,
  name TEXT,
  subject TEXT,
  grade_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(teacher_id) REFERENCES users(id)
)`);
db.run(`CREATE TABLE IF NOT EXISTS classroom_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classroom_id INTEGER,
  student_id INTEGER,
  status TEXT DEFAULT 'pending',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(classroom_id, student_id),
  FOREIGN KEY(classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY(student_id) REFERENCES users(id)
)`);
db.run(`ALTER TABLE classroom_students ADD COLUMN status TEXT DEFAULT 'accepted'`, () => { });
db.run(`ALTER TABLE classrooms ADD COLUMN image_url TEXT`, () => { });
db.run(`CREATE TABLE IF NOT EXISTS classroom_teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classroom_id INTEGER,
  teacher_id INTEGER,
  role TEXT DEFAULT 'co-teacher',
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(classroom_id, teacher_id),
  FOREIGN KEY(classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY(teacher_id) REFERENCES users(id)
)`);
db.run(`CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classroom_id INTEGER,
  kit_id INTEGER,
  game_mode TEXT DEFAULT 'classic_timed',
  title TEXT,
  instructions TEXT,
  due_date DATETIME,
  due_time TEXT,
  requirements TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY(kit_id) REFERENCES question_kits(id)
)`);
db.run(`ALTER TABLE assignments ADD COLUMN due_time TEXT`, () => { });
db.run(`CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER,
  student_id INTEGER,
  status TEXT DEFAULT 'pending',
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  completed_at DATETIME,
  UNIQUE(assignment_id, student_id),
  FOREIGN KEY(assignment_id) REFERENCES assignments(id),
  FOREIGN KEY(student_id) REFERENCES users(id)
)`);
db.run(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);
db.run(`ALTER TABLE games ADD COLUMN assignment_id INTEGER`, () => { });
// Password reset columns
db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, () => { });
db.run(`ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`, () => { });
// Google Classroom token storage
db.run(`ALTER TABLE users ADD COLUMN google_access_token TEXT`, () => { });
db.run(`ALTER TABLE users ADD COLUMN google_refresh_token TEXT`, () => { });
db.run(`ALTER TABLE users ADD COLUMN google_scopes TEXT`, () => { });
db.run(`ALTER TABLE users ADD COLUMN password_changed_at TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'`, () => {});
// One-shot 3-day free trial of teacher_pro. Set to 1 once a teacher
// has consumed their trial; prevents re-use.
db.run(`ALTER TABLE users ADD COLUMN trial_used INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE users ADD COLUMN subscription_id TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN subscription_expires TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`, () => {});
db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1`, () => {});
db.run(`ALTER TABLE users ADD COLUMN verification_token TEXT`, () => {});
// Wager mode columns
db.run(`ALTER TABLE game_participants ADD COLUMN wager_streak INTEGER DEFAULT 0`, () => { });
// Elemental Markets columns
db.run(`ALTER TABLE game_participants ADD COLUMN mkt_cash REAL DEFAULT 1000`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN mkt_holdings TEXT DEFAULT '{}'`, () => { });
// Cost basis per symbol — weighted-avg price at which the player currently
// holds those shares. Used to show profit/loss on the sell modal so players
// can see what they'd earn or lose before clicking sell.
db.run(`ALTER TABLE game_participants ADD COLUMN mkt_cost_basis TEXT DEFAULT '{}'`, () => { });
// Question image column
db.run(`ALTER TABLE questions ADD COLUMN image_url TEXT`, () => { });
// Inferno Tower columns
db.run(`ALTER TABLE game_participants ADD COLUMN tower_floor INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN is_ghost INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE game_participants ADD COLUMN frozen_until DATETIME`, () => { });
db.run(`CREATE TABLE IF NOT EXISTS inferno_fireballs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER,
  attacker_user_id INTEGER,
  target_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(game_id) REFERENCES games(id)
)`);
// BB economy tracking
db.run(`CREATE TABLE IF NOT EXISTS bb_daily_tracker (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  games_played INTEGER DEFAULT 0,
  bb_earned_today INTEGER DEFAULT 0,
  streak_day INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
)`);
db.run(`ALTER TABLE blazes_bucks ADD COLUMN last_streak_date TEXT`, () => { });
db.run(`ALTER TABLE blazes_bucks ADD COLUMN current_streak INTEGER DEFAULT 0`, () => { });
db.run(`ALTER TABLE bb_daily_tracker ADD COLUMN playtime_seconds INTEGER DEFAULT 0`, () => { });
// Backfill playtime_seconds from game data where it's still 0
db.run(`UPDATE bb_daily_tracker SET playtime_seconds = COALESCE((
  SELECT SUM(CASE WHEN g.started_at IS NOT NULL THEN
    MAX(60, (julianday(COALESCE(g.ended_at, datetime('now'))) - julianday(g.started_at)) * 86400)
  ELSE 300 END)
  FROM game_participants gp
  JOIN games g ON gp.game_id = g.id
  WHERE gp.user_id = bb_daily_tracker.user_id AND DATE(g.created_at) = bb_daily_tracker.date
), 300) WHERE playtime_seconds = 0 AND games_played > 0`, () => { });
// Add carry-over remainder column to blazes_bucks if it doesn't exist yet
db.run(`ALTER TABLE blazes_bucks ADD COLUMN play_time_remainder_seconds INTEGER DEFAULT 0`, () => { });
db.run(`CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  notify_assignments INTEGER DEFAULT 1,
  notify_achievements INTEGER DEFAULT 1,
  notify_game_invites INTEGER DEFAULT 1,
  notify_classroom INTEGER DEFAULT 1,
  sound_enabled INTEGER DEFAULT 1,
  animations_enabled INTEGER DEFAULT 1,
  timer_warnings INTEGER DEFAULT 1,
  font_size TEXT DEFAULT 'medium',
  reduce_motion INTEGER DEFAULT 0,
  leaderboard_visible INTEGER DEFAULT 1,
  activity_visible INTEGER DEFAULT 1,
  music_volume INTEGER DEFAULT 30,
  sfx_volume INTEGER DEFAULT 70,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);
db.run(`ALTER TABLE user_settings ADD COLUMN music_volume INTEGER DEFAULT 30`, () => {});
db.run(`ALTER TABLE user_settings ADD COLUMN sfx_volume INTEGER DEFAULT 70`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS login_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
// Season / XP / Level tables
db.run(`CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_number INTEGER UNIQUE,
  start_date TEXT,
  end_date TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS season_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  season_id INTEGER,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  xp_earned_today INTEGER DEFAULT 0,
  last_xp_date TEXT,
  UNIQUE(user_id, season_id)
)`);
db.run(`CREATE TABLE IF NOT EXISTS season_xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  season_id INTEGER,
  amount INTEGER,
  source TEXT,
  game_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.run(`CREATE TABLE IF NOT EXISTS season_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  season_number INTEGER,
  peak_level INTEGER,
  badge_tier TEXT,
  UNIQUE(user_id, season_number)
)`);

// AI usage tracking — daily limits per feature
db.run(`CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  feature TEXT NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// In-memory rate-limit: tracks when each user last claimed play-time BB (prevents double-awards)
const lastClaimTime = {}; // { userId: Date.now() }

// =========== BASIC SKINS ===========
const BASIC_SKIN_IDS = ['basic-red','basic-orange','basic-yellow','basic-green','basic-blue','basic-purple','basic-white','basic-brown','basic-black'];
const randomBasicSkin = () => BASIC_SKIN_IDS[Math.floor(Math.random() * BASIC_SKIN_IDS.length)];

// =========== DB PROMISE HELPERS ===========
// Turso/libsql refuses to bind `undefined` as a parameter (it throws
// "Unsupported type of value"). The native sqlite3 driver silently coerces
// undefined → null. Many endpoints destructure optional fields off req.body
// and pass them straight through, so when a caller omits a column we'd
// previously hit a runtime error and the INSERT/UPDATE was lost. We patch
// the raw db.run/get/all methods so EVERY endpoint — even the ones using
// the callback API — gets undefined → null sanitisation for free.
const _safeParams = (params) => (Array.isArray(params) ? params : []).map(v => v === undefined ? null : v);
const _origRun = db.run.bind(db);
const _origGet = db.get.bind(db);
const _origAll = db.all.bind(db);
db.run = function (sql, params, cb) {
  if (typeof params === 'function') return _origRun(sql, params); // (sql, cb) form
  if (Array.isArray(params)) return _origRun(sql, _safeParams(params), cb);
  return _origRun(sql, params, cb);
};
db.get = function (sql, params, cb) {
  if (typeof params === 'function') return _origGet(sql, params);
  if (Array.isArray(params)) return _origGet(sql, _safeParams(params), cb);
  return _origGet(sql, params, cb);
};
db.all = function (sql, params, cb) {
  if (typeof params === 'function') return _origAll(sql, params);
  if (Array.isArray(params)) return _origAll(sql, _safeParams(params), cb);
  return _origAll(sql, params, cb);
};
// Treat libsql/Turso network blips (premature close, reset, timeout) as
// retryable — the libsql client routes every query through HTTP, and we've
// been seeing intermittent ERR_STREAM_PREMATURE_CLOSE from cross-fetch.
function isTransientDbError(err) {
  const s = String(err?.code || err?.errno || err?.message || '');
  return /premature[_ ]?close|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(s);
}

// Callback-style db.get with up to 3 retries on transient errors. Backoff is
// 150ms × attempt so the third attempt is at 450ms — far enough that a flaky
// connection has a chance to recover, short enough that the user doesn't
// notice the retry.
function dbGetRetry(sql, params, cb, maxRetries = 3) {
  let attempt = 0;
  const tryOnce = () => {
    db.get(sql, params, (err, row) => {
      if (err && attempt < maxRetries && isTransientDbError(err)) {
        attempt += 1;
        console.warn(`[DB] retry ${attempt}/${maxRetries} on transient error: ${err.code || err.message}`);
        return setTimeout(tryOnce, 150 * attempt);
      }
      cb(err, row);
    });
  };
  tryOnce();
}

// Promise helpers now retry transient libsql errors (premature close, reset,
// timeout) up to 3× with 150/300/450ms backoff. Anything else rejects as
// before, so application logic errors still surface.
async function withRetry(fn, label, maxRetries = 3) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { return await fn(); }
    catch (err) {
      if (attempt < maxRetries && isTransientDbError(err)) {
        attempt += 1;
        console.warn(`[DB ${label}] retry ${attempt}/${maxRetries}: ${err.code || err.message}`);
        await new Promise(r => setTimeout(r, 150 * attempt));
        continue;
      }
      throw err;
    }
  }
}
const dbGet = (sql, params = []) => withRetry(() => new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r))), 'get');
const dbAll = (sql, params = []) => withRetry(() => new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r))), 'all');
const dbRun = (sql, params = []) => withRetry(() => new Promise((res, rej) => db.run(sql, params, function(e) { e ? rej(e) : res(this.changes); })), 'run');
const parseDbDate = (s) => s ? new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null;

// ─── AI DAILY USAGE LIMITS ───
const AI_DAILY_LIMITS = {
  quiz_generate: { blazes_plus: 10, teacher_pro: 25, school: 50 },
  study_overview: { blazes_plus: 15, teacher_pro: 30, school: 50 },
  flashcards:    { blazes_plus: 15, teacher_pro: 30, school: 50 },
};

async function checkAiLimit(userId, feature) {
  const tier = await getUserTier(userId);
  if (!['blazes_plus', 'teacher_pro', 'school'].includes(tier)) {
    return { allowed: false, reason: 'upgrade_required' };
  }
  const limits = AI_DAILY_LIMITS[feature];
  if (!limits) return { allowed: true, tier };
  const dailyLimit = limits[tier] || 0;
  const usage = await dbGet(
    `SELECT COUNT(*) as count FROM ai_usage WHERE user_id = ? AND feature = ? AND date(used_at) = date('now')`,
    [userId, feature]
  );
  const used = usage?.count || 0;
  if (used >= dailyLimit) {
    return { allowed: false, reason: 'limit_reached', used, limit: dailyLimit, tier };
  }
  return { allowed: true, used, limit: dailyLimit, tier };
}

async function trackAiUsage(userId, feature) {
  await dbRun('INSERT INTO ai_usage (user_id, feature) VALUES (?, ?)', [userId, feature]);
}

// ─── SEASON XP SYSTEM ───
function xpForLevel(level) {
  return 75 + (level - 1) * 35;
}

function totalXpForLevel(level) {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * 75 + 35 * (n - 1) * n / 2;
}

function levelFromXp(xp) {
  let level = 1;
  let total = 0;
  while (level < 100) {
    const needed = xpForLevel(level);
    if (total + needed > xp) break;
    total += needed;
    level++;
  }
  return level;
}

async function getCurrentSeason() {
  const today = new Date().toISOString().split('T')[0];
  let season = await dbGet('SELECT * FROM seasons WHERE start_date <= ? AND end_date >= ?', [today, today]);
  if (!season) {
    // Archive old seasons and create new one
    const lastSeason = await dbGet('SELECT * FROM seasons ORDER BY season_number DESC LIMIT 1');
    const newNumber = (lastSeason?.season_number || 0) + 1;
    const endDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    await dbRun('INSERT INTO seasons (season_number, start_date, end_date) VALUES (?, ?, ?)', [newNumber, today, endDate]);
    season = await dbGet('SELECT * FROM seasons WHERE season_number = ?', [newNumber]);
    // Archive badges from last season
    if (lastSeason) {
      const oldProgress = await dbAll('SELECT user_id, level FROM season_progress WHERE season_id = ?', [lastSeason.id]);
      for (const p of oldProgress) {
        const tier = p.level >= 75 ? 'diamond' : p.level >= 50 ? 'gold' : p.level >= 25 ? 'silver' : p.level >= 10 ? 'bronze' : null;
        if (tier) {
          await dbRun('INSERT OR REPLACE INTO season_badges (user_id, season_number, peak_level, badge_tier) VALUES (?, ?, ?, ?)',
            [p.user_id, lastSeason.season_number, p.level, tier]);
        }
      }
    }
  }
  return season;
}

const DAILY_XP_CAP = 2200;

async function awardSeasonXP(userId, amount, source, gameCode) {
  try {
    const season = await getCurrentSeason();
    const today = new Date().toISOString().split('T')[0];

    // Ensure progress row exists
    await dbRun(
      `INSERT OR IGNORE INTO season_progress (user_id, season_id, xp, level, xp_earned_today, last_xp_date) VALUES (?, ?, 0, 1, 0, ?)`,
      [userId, season.id, today]
    );

    let progress = await dbGet('SELECT * FROM season_progress WHERE user_id = ? AND season_id = ?', [userId, season.id]);

    // Reset daily cap if new day
    if (progress.last_xp_date !== today) {
      await dbRun('UPDATE season_progress SET xp_earned_today = 0, last_xp_date = ? WHERE user_id = ? AND season_id = ?',
        [today, userId, season.id]);
      progress.xp_earned_today = 0;
    }

    // Check daily cap
    const remaining = DAILY_XP_CAP - progress.xp_earned_today;
    if (remaining <= 0) return { awarded: 0, levelUp: false, newLevel: progress.level };

    const actual = Math.min(amount, remaining);
    const oldLevel = progress.level;
    const newXp = progress.xp + actual;
    const newLevel = Math.min(100, levelFromXp(newXp));
    const levelsGained = newLevel - oldLevel;

    await dbRun(
      'UPDATE season_progress SET xp = ?, level = ?, xp_earned_today = xp_earned_today + ? WHERE user_id = ? AND season_id = ?',
      [newXp, newLevel, actual, userId, season.id]
    );

    // Also update user_stats for display
    await dbRun('UPDATE user_stats SET currentXP = ?, level = ? WHERE user_id = ?', [newXp, newLevel, userId]);

    if (actual > 0) {
      await dbRun(
        'INSERT INTO season_xp_log (user_id, season_id, amount, source, game_code) VALUES (?, ?, ?, ?, ?)',
        [userId, season.id, actual, source, gameCode || null]
      );
    }

    // Award 50 BB per level-up
    if (levelsGained > 0) {
      const bbReward = levelsGained * 50;
      await awardBBWithCap(userId, bbReward, 'level_up', gameCode || `level_${newLevel}`);
    }

    return { awarded: actual, newXp, newLevel, levelUp: levelsGained > 0, levelsGained };
  } catch (e) {
    console.error('[XP] Error awarding XP:', e);
    return { awarded: 0, levelUp: false, newLevel: 1 };
  }
}

// =========== SURVIVAL ROUND HELPERS ===========
async function endRound(game, questions, caller = 'unknown') {
  // Atomically claim the transition; only one poll wins
  const changed = await dbRun(
    `UPDATE games SET round_status = 'results', round_ended_at = CURRENT_TIMESTAMP WHERE id = ? AND round_status = 'answering'`,
    [game.id]
  );
  if (!changed) return;

  // Increment rounds_played counter
  await dbRun('UPDATE games SET rounds_played = rounds_played + 1 WHERE id = ?', [game.id]);
  const updatedGame = await dbGet('SELECT rounds_played FROM games WHERE id = ?', [game.id]);
  const roundNum = updatedGame?.rounds_played || 1;
  console.log(`[endRound] called by: ${caller}, round: ${roundNum}, question_index: ${game.current_question_index}`);

  const currentQuestion = questions[game.current_question_index || 0];
  if (!currentQuestion) return;

  const participants = await dbAll(
    'SELECT * FROM game_participants WHERE game_id = ? AND eliminated = 0', [game.id]
  );

  for (const p of participants) {
    const answer = await dbGet(
      `SELECT * FROM game_answers WHERE game_id = ? AND user_id = ? AND question_id = ? AND answered_at >= ? ORDER BY answered_at DESC LIMIT 1`,
      [game.id, p.user_id, currentQuestion.id, game.round_started_at || '1970-01-01']
    );
    const isCorrect = answer?.is_correct === 1;
    if (!isCorrect) {
      await dbRun('UPDATE game_participants SET lives = MAX(0, lives - 1) WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
      const updated = await dbGet('SELECT lives FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
      if ((updated?.lives || 0) <= 0) {
        await dbRun('UPDATE game_participants SET eliminated = 1, eliminated_at_round = ? WHERE game_id = ? AND user_id = ?', [roundNum, game.id, p.user_id]);
      }
    }
  }

  const aliveRow = await dbGet('SELECT COUNT(*) as count FROM game_participants WHERE game_id = ? AND eliminated = 0', [game.id]);
  if (aliveRow.count <= 1) {
    // Check for tie: if 0 alive and multiple players just died this round, trigger sudden death
    if (aliveRow.count === 0) {
      // Find players who were eliminated THIS round (had lives > 0 before, now eliminated)
      // These are players who were in the participants list at round start (non-eliminated) and just got eliminated
      const justEliminated = [];
      for (const p of participants) {
        const current = await dbGet('SELECT eliminated FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
        if (current?.eliminated === 1) justEliminated.push(p);
      }
      if (justEliminated.length >= 2) {
        // SUDDEN DEATH: revive all tied players with 1 life
        for (const p of justEliminated) {
          await dbRun('UPDATE game_participants SET eliminated = 0, lives = 1 WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
        }
        await dbRun('UPDATE games SET sudden_death = 1 WHERE id = ?', [game.id]);
        console.log(`[endRound] SUDDEN DEATH triggered — ${justEliminated.length} players revived`);
        return; // Don't end the game
      }
    }
    await dbRun(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [game.id]);
  }
}

async function advanceRound(game, totalQuestions) {
  const nextIndex = ((game.current_question_index || 0) + 1) % totalQuestions;
  await dbRun(
    `UPDATE games SET current_question_index = ?, round_started_at = CURRENT_TIMESTAMP, round_status = 'answering', round_ended_at = NULL WHERE id = ? AND round_status = 'results'`,
    [nextIndex, game.id]
  );
}

// =========== BLAZESBUCKS HELPER ===========

// Award BB to a user and log the transaction
function awardBB(userId, amount, reason, gameCode) {
  return new Promise((resolve) => {
    // Upsert balance
    db.run(
      `INSERT INTO blazes_bucks (user_id, balance) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
      [userId, amount, amount],
      (err) => { if (err) console.error('awardBB balance err:', err.message); }
    );
    // Log transaction
    db.run(
      `INSERT INTO blazes_bucks_log (user_id, amount, reason, game_code) VALUES (?, ?, ?, ?)`,
      [userId, amount, reason, gameCode || null],
      (err) => {
        if (err) console.error('awardBB log err:', err.message);
        resolve();
      }
    );
  });
}

// Get total BB earned today for a user (for daily cap)
async function getBBEarnedToday(userId) {
  const today = new Date().toISOString().split('T')[0];
  const row = await dbGet('SELECT bb_earned_today FROM bb_daily_tracker WHERE user_id = ? AND date = ?', [userId, today]);
  return row?.bb_earned_today || 0;
}

// Award BB with daily cap enforcement (1000 BB/day max)
async function awardBBWithCap(userId, amount, reason, gameCode) {
  const earned = await getBBEarnedToday(userId);
  const remaining = Math.max(0, 1000 - earned);
  if (remaining <= 0) return 0;
  const actual = Math.min(amount, remaining);
  // Round down to nearest 10
  const rounded = Math.floor(actual / 10) * 10;
  if (rounded <= 0) return 0;
  await awardBB(userId, rounded, reason, gameCode);
  // Update daily tracker
  const today = new Date().toISOString().split('T')[0];
  await dbRun(
    `INSERT INTO bb_daily_tracker (user_id, date, bb_earned_today) VALUES (?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET bb_earned_today = bb_earned_today + ?`,
    [userId, today, rounded, rounded]
  );
  return rounded;
}

// ============ AUTH ROUTES ============

// Check whether an email has an existing account (used by login/signup UX).
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email required' });
  try {
    const user = await dbGet('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    res.json({ exists: !!user });
  } catch (err) {
    console.error('[Auth] check-email error:', err);
    res.status(500).json({ error: 'Check failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  console.log('REGISTER attempt:', req.body);

  try {
    let { email, password, role, name } = req.body;
    email = email.toLowerCase();

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password ready');

    db.run(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, role || 'student'],
      function (err) {
        console.log('DB result:', err ? err.message : 'SUCCESS', 'ID:', this?.lastID);
        if (err) {
          return res.status(400).json({ message: 'Email already exists' });
        }

        const userId = this.lastID;
        db.run('INSERT INTO user_stats (user_id) VALUES (?)', [userId], (err) => {
          if (err) console.log('Error creating stats:', err);
        });
        db.run('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);
        db.run('INSERT OR IGNORE INTO user_equipped (user_id, avatar_skin) VALUES (?, ?)', [userId, randomBasicSkin()]);

        // Email verification
        const verifyToken = require('crypto').randomBytes(32).toString('hex');
        db.run('UPDATE users SET email_verified = 0, verification_token = ? WHERE id = ?', [verifyToken, userId]);

        const transporter = require('nodemailer').createTransport({
          service: 'gmail',
          auth: { user: process.env.CONTACT_EMAIL_USER, pass: process.env.CONTACT_EMAIL_PASS },
        });
        const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
        transporter.sendMail({
          from: `"Blazes" <${process.env.CONTACT_EMAIL_USER}>`,
          to: email,
          subject: 'Blazes — Verify Your Email',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
  <h1 style="color:#dc2626;font-size:28px;margin-bottom:8px;">Blazes</h1>
  <h2 style="margin-bottom:16px;">Verify Your Email</h2>
  <p>Welcome to Blazes! Click the button below to verify your email address:</p>
  <a href="${verifyUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;margin:20px 0;">
    Verify Email
  </a>
  <p style="color:#666;font-size:13px;">If you didn't create this account, ignore this email.</p>
</div>`,
        }).catch(err => console.error('[Auth] Verification email error:', err));

        res.json({
          token: 'jwt-token-here',
          user: { id: userId, email, name, role },
          needsVerification: true
        });
      }
    );
  } catch (error) {
    console.log('REGISTER ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const loginAttempts = new Map();
function checkLoginRate(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  // Clean old attempts (last 15 minutes)
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
  loginAttempts.set(ip, recent);
  if (recent.length >= 10) return false; // max 10 attempts per 15 min
  return true;
}
function recordFailedLogin(ip) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}

app.post('/api/auth/login', (req, res) => {
  let { email, password } = req.body;
  email = email.toLowerCase();
  console.log('Login attempt:', email);

  if (!checkLoginRate(req.ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again in 15 minutes.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.log('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User found:', user.email);

    try {
      const valid = await bcrypt.compare(password, user.password);
      console.log('Password match:', valid);

      if (valid) {
        if (user.email_verified === 0) {
          return res.status(403).json({ message: 'Please verify your email before logging in. Check your inbox.', needsVerification: true, email: user.email });
        }
        db.run('INSERT INTO login_activity (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
          [user.id, req.ip, req.headers['user-agent'] || 'Unknown']);
        res.json({
          token: 'jwt-token-here',
          user: { id: user.id, email: user.email, name: user.name, role: user.role }
        });
      } else {
        recordFailedLogin(req.ip);
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.log('Bcrypt error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Verify password for settings unlock (doesn't require email verification)
app.post('/api/auth/verify-password', (req, res) => {
  let { email, password } = req.body;
  email = email.toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.log('Verify password DB error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user) {
      console.log('User not found for password verify');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.password) {
      console.log('User has no password');
      return res.status(401).json({ success: false, message: 'No password set for this account' });
    }

    try {
      const valid = await bcrypt.compare(password, user.password);
      console.log('Password verify match:', valid, 'for user:', email);

      if (valid) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } catch (error) {
      console.log('Verify password bcrypt error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
});

// Forgot password — send reset email or redirect to Google verify
const crypto = require('crypto');
app.post('/api/auth/forgot-password', async (req, res) => {
  let { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  email = email.toLowerCase().trim();

  try {
    const user = await dbGet('SELECT id, email, password, google_access_token FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // If user has a Google account (signed up with Google or has google tokens), offer Google verify
    if (!user.password || user.google_access_token) {
      return res.json({ success: true, useGoogle: true, message: 'This account uses Google sign-in. Verify with Google to set a password.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.CONTACT_EMAIL_USER, pass: process.env.CONTACT_EMAIL_PASS },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `"Blazes" <${process.env.CONTACT_EMAIL_USER}>`,
      to: user.email,
      subject: 'Blazes — Password Reset',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h1 style="color:#dc2626;font-size:28px;margin-bottom:8px;">Blazes</h1>
          <h2 style="margin-bottom:16px;">Password Reset</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;margin:20px 0;">
            Reset Password
          </a>
          <p style="color:#666;font-size:13px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    console.log(`[Auth] Password reset email sent to ${user.email}`);
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] forgot-password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// Google-verified password reset: track pending resets server-side
const pendingGoogleResets = new Set(); // stores session IDs waiting for reset
app.get('/auth/google/reset', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${FRONTEND_URL}/forgot-password?error=google_not_configured`);
  // Generate a one-time reset nonce, store it in a cookie so we can verify on callback
  const nonce = crypto.randomBytes(16).toString('hex');
  pendingGoogleResets.add(nonce);
  // Expire nonce after 5 minutes
  setTimeout(() => pendingGoogleResets.delete(nonce), 5 * 60 * 1000);
  res.cookie('blazes_reset_nonce', nonce, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax' });
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Email-OTP Settings unlock — primary path for accounts without a password.
// Stores the code hashed (not plain) so a memory dump doesn't leak it.
const settingsUnlockCodes = new Map(); // userId -> { hash, expires, attempts }
const SETTINGS_UNLOCK_TTL_MS = 10 * 60 * 1000;
const SETTINGS_UNLOCK_MAX_ATTEMPTS = 5;
const settingsUnlockRateLimit = new Map(); // userId -> last-send timestamp

app.post('/api/auth/request-unlock-code', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const user = await dbGet('SELECT id, email, name FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Rate-limit: at most one code every 30 seconds per user.
    const last = settingsUnlockRateLimit.get(user.id);
    if (last && Date.now() - last < 30 * 1000) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }
    settingsUnlockRateLimit.set(user.id, Date.now());

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    const hash = await bcrypt.hash(code, 8);
    settingsUnlockCodes.set(user.id, { hash, expires: Date.now() + SETTINGS_UNLOCK_TTL_MS, attempts: 0 });
    setTimeout(() => settingsUnlockCodes.delete(user.id), SETTINGS_UNLOCK_TTL_MS);

    if (!process.env.CONTACT_EMAIL_USER || !process.env.CONTACT_EMAIL_PASS) {
      console.warn('[Settings unlock] Email not configured; code for', user.email, 'is', code);
      return res.json({ success: true, devCode: code }); // surface in dev only
    }

    const transporter = require('nodemailer').createTransport({
      service: 'gmail',
      auth: { user: process.env.CONTACT_EMAIL_USER, pass: process.env.CONTACT_EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Blazes" <${process.env.CONTACT_EMAIL_USER}>`,
      to: user.email,
      subject: 'Blazes — Settings verification code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h1 style="color:#dc2626;font-size:28px;margin-bottom:8px;">Blazes</h1>
          <h2 style="margin-bottom:16px;">Settings verification code</h2>
          <p>Use this code to access your Blazes settings:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:20px;border-radius:12px;text-align:center;margin:20px 0;">${code}</div>
          <p style="color:#666;font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });

    console.log(`[Settings unlock] Code sent to ${user.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Settings unlock] request error:', err);
    res.status(500).json({ error: `Failed to send code: ${err.message}` });
  }
});

app.post('/api/auth/verify-unlock-code', async (req, res) => {
  const { userId, code } = req.body || {};
  if (!userId || !code) return res.status(400).json({ error: 'userId and code required' });
  const entry = settingsUnlockCodes.get(Number(userId));
  if (!entry) return res.status(400).json({ error: 'No code requested or it has expired.' });
  if (entry.expires < Date.now()) {
    settingsUnlockCodes.delete(Number(userId));
    return res.status(400).json({ error: 'Code expired. Request a new one.' });
  }
  if (entry.attempts >= SETTINGS_UNLOCK_MAX_ATTEMPTS) {
    settingsUnlockCodes.delete(Number(userId));
    return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  }
  const valid = await bcrypt.compare(String(code), entry.hash);
  if (!valid) {
    entry.attempts++;
    return res.status(400).json({ error: 'Incorrect code' });
  }
  settingsUnlockCodes.delete(Number(userId)); // one-time use
  res.json({ success: true });
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const user = await dbGet('SELECT id, reset_token_expires FROM users WHERE reset_token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

    // Check expiration
    const expires = new Date(user.reset_token_expires).getTime();
    if (Date.now() > expires) {
      await dbRun('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [user.id]);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(password, 10);
    await dbRun('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashed, user.id]);

    console.log(`[Auth] Password reset successful for user ${user.id}`);
    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    console.error('[Auth] reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, name, role FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ============ STATS ROUTES ============

app.get('/api/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    // Check if teacher or student
    const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);
    if (user?.role === 'teacher') {
      // Compute real teacher stats from DB
      const totalGamesHosted = (await dbGet('SELECT COUNT(*) as c FROM games WHERE host_id = ?', [userId]))?.c || 0;
      const activeStudents = (await dbGet(
        `SELECT COUNT(DISTINCT gp.user_id) as c FROM game_participants gp
         JOIN games g ON gp.game_id = g.id WHERE g.host_id = ?`, [userId]
      ))?.c || 0;
      const avgScore = (await dbGet(
        `SELECT AVG(gp.score) as a FROM game_participants gp
         JOIN games g ON gp.game_id = g.id WHERE g.host_id = ? AND gp.score > 0`, [userId]
      ))?.a || 0;
      const totalKits = (await dbGet('SELECT COUNT(*) as c FROM question_kits WHERE teacher_id = ?', [userId]))?.c || 0;
      return res.json({
        totalGames: totalGamesHosted,
        totalGamesHosted,
        activeStudents,
        avgScore: Math.round(avgScore),
        totalClasses: totalKits,
        classesToday: 0,
        gamesWon: 0, dayStreak: 0, accuracyRate: 0, winRate: 0,
        questionsAnswered: 0, currentXP: 0, level: 1
      });
    }
    // Student stats from user_stats table
    const stats = await dbGet('SELECT * FROM user_stats WHERE user_id = ?', [userId]);
    if (!stats) {
      return res.json({
        gamesWon: 0, dayStreak: 0, accuracyRate: 0, totalGames: 0, winRate: 0,
        avgScore: 0, questionsAnswered: 0, currentXP: 0, level: 1, totalCorrectAnswers: 0
      });
    }
    // Compute accuracy live from game_answers (user_stats column drifts from duplicate submissions)
    try {
      const accRow = await dbGet(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct FROM game_answers WHERE user_id = ?`,
        [userId]
      );
      if (accRow && accRow.total > 0) {
        stats.accuracyRate = Math.round(accRow.correct * 1000 / accRow.total) / 10;
        stats.questionsAnswered = accRow.total;
        stats.totalCorrectAnswers = accRow.correct;
      }
    } catch (_) {
      // Fall back to existing accuracyRate
      if (stats.accuracyRate > 100) stats.accuracyRate = 100;
    }

    // Compute day streak live: consecutive days with >= 5 min combined playtime
    try {
      const today = new Date().toISOString().split('T')[0];
      const activeDays = await dbAll(
        `SELECT date FROM bb_daily_tracker WHERE user_id = ? AND playtime_seconds >= 300 ORDER BY date DESC LIMIT 365`,
        [userId]
      );
      let streak = 0;
      let checkDate = new Date(today + 'T00:00:00');
      for (const row of activeDays) {
        if (row.date === checkDate.toISOString().split('T')[0]) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      stats.dayStreak = streak;
    } catch (_) { /* keep existing dayStreak if query fails */ }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stats/:userId', (req, res) => {
  const { userId } = req.params;
  const stats = req.body;
  // Cap accuracy at 100%
  const cappedAccuracy = Math.min(stats.accuracyRate || 0, 100);

  db.run(
    `UPDATE user_stats SET 
      gamesWon = ?, dayStreak = ?, accuracyRate = ?, totalGames = ?, 
      winRate = ?, avgScore = ?, questionsAnswered = ?, currentXP = ?, 
      level = ?, totalGamesHosted = ?, activeStudents = ?, totalCorrectAnswers = ?
    WHERE user_id = ?`,
    [
      stats.gamesWon, stats.dayStreak, cappedAccuracy, stats.totalGames,
      stats.winRate, stats.avgScore, stats.questionsAnswered, stats.currentXP,
      stats.level, stats.totalGamesHosted, stats.activeStudents, stats.totalCorrectAnswers || 0, userId
    ],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Stats updated successfully' });
    }
  );
});

app.get('/api/stats/:userId/games-this-week', async (req, res) => {
  const { userId } = req.params;
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await dbGet(
      'SELECT COALESCE(SUM(games_played), 0) as games_this_week FROM bb_daily_tracker WHERE user_id = ? AND date >= ?',
      [userId, sevenDaysAgo]
    );
    res.json({ games_this_week: result?.games_this_week || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GAME ROUTES ============

app.get('/api/games/active/student/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT g.*, u.name as host_name 
     FROM games g
     JOIN game_participants gp ON g.id = gp.game_id
     JOIN users u ON g.host_id = u.id
     WHERE gp.user_id = ? AND g.status IN ('waiting', 'started')
     ORDER BY g.created_at DESC
     LIMIT 5`,
    [userId],
    (err, games) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(games || []);
    }
  );
});

app.get('/api/games/hosted/:teacherId', (req, res) => {
  const { teacherId } = req.params;

  db.all(
    `SELECT g.*, COUNT(gp.id) as participants
     FROM games g
     LEFT JOIN game_participants gp ON g.id = gp.game_id
     WHERE g.host_id = ? AND g.status IN ('waiting', 'started')
     GROUP BY g.id
     ORDER BY g.created_at DESC
     LIMIT 10`,
    [teacherId],
    (err, games) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(games || []);
    }
  );
});

// ============ ACTIVITY ROUTES ============

app.get('/api/activity/:userId/:limit', async (req, res) => {
  const { userId, limit } = req.params;
  try {
    // Try activity table first
    const activities = await dbAll('SELECT * FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, parseInt(limit) || 10]);
    if (activities && activities.length > 0) return res.json(activities);
    // Fallback: generate activity from game history (for teachers)
    const games = await dbAll(
      `SELECT g.game_code, g.game_mode, g.status, g.created_at, g.started_at,
              COUNT(gp.user_id) as playerCount,
              MAX(gp.score) as topScore
       FROM games g
       LEFT JOIN game_participants gp ON g.id = gp.game_id
       WHERE g.host_id = ?
       GROUP BY g.id
       ORDER BY g.created_at DESC
       LIMIT ?`,
      [userId, parseInt(limit) || 10]
    );
    const mapped = (games || []).map(g => ({
      id: g.game_code,
      description: `${g.game_mode === 'survival' ? 'Survival' : g.game_mode === 'elemental_clash' ? 'Elemental Clash' : g.game_mode === 'inferno_tower' ? 'Inferno Tower' : 'Classic'} game (${g.game_code}) — ${g.playerCount} players${g.topScore ? `, top score: ${g.topScore}` : ''}`,
      xpGained: g.topScore || 0,
      created_at: g.started_at || g.created_at,
      status: g.status,
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT * FROM activity
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
    (err, activities) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(activities || []);
    }
  );
});

// ============ STUDENT ANALYTICS ROUTES ============

app.get('/api/students/top-performers/:teacherId', (req, res) => {
  const { teacherId } = req.params;

  db.all(
    `SELECT u.id, u.name,
            SUM(gp.score) as totalScore,
            COUNT(DISTINCT gp.game_id) as gamesPlayed,
            (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.user_id = u.id AND ga2.is_correct = 1) as correctAnswers,
            (SELECT COUNT(*) FROM game_answers ga3 WHERE ga3.user_id = u.id) as totalAnswers
     FROM users u
     JOIN game_participants gp ON u.id = gp.user_id
     JOIN games g ON gp.game_id = g.id
     LEFT JOIN user_settings us ON u.id = us.user_id
     WHERE g.host_id = ? AND u.role = 'student'
       AND (us.leaderboard_visible IS NULL OR us.leaderboard_visible = 1)
     GROUP BY u.id
     ORDER BY totalScore DESC
     LIMIT 5`,
    [teacherId],
    (err, students) => {
      if (err) return res.status(500).json({ error: err.message });
      const mapped = (students || []).map(s => ({
        id: s.id,
        name: s.name,
        totalXP: s.totalScore || 0,
        level: Math.max(1, Math.floor((s.totalScore || 0) / 100) + 1),
        accuracy: s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0,
        gamesPlayed: s.gamesPlayed || 0,
        trend: s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0
      }));
      res.json(mapped);
    }
  );
});

app.get('/api/students/needing-help/:teacherId', (req, res) => {
  const { teacherId } = req.params;

  db.all(
    `SELECT u.id, u.name,
            (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.user_id = u.id AND ga2.is_correct = 1) as correctAnswers,
            (SELECT COUNT(*) FROM game_answers ga3 WHERE ga3.user_id = u.id) as totalAnswers
     FROM users u
     JOIN game_participants gp ON u.id = gp.user_id
     JOIN games g ON gp.game_id = g.id
     LEFT JOIN user_settings usettings ON u.id = usettings.user_id
     WHERE g.host_id = ? AND u.role = 'student'
       AND (usettings.leaderboard_visible IS NULL OR usettings.leaderboard_visible = 1)
     GROUP BY u.id
     HAVING totalAnswers > 0 AND ROUND(CAST(correctAnswers AS FLOAT) / totalAnswers * 100) < 75
     ORDER BY ROUND(CAST(correctAnswers AS FLOAT) / totalAnswers * 100) ASC`,
    [teacherId],
    (err, students) => {
      if (err) return res.status(500).json({ error: err.message });
      const mapped = (students || []).map(s => ({
        id: s.id,
        name: s.name,
        avgAccuracy: s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0
      }));
      res.json(mapped);
    }
  );
});

// Upload question image (base64)
app.post('/api/upload-image', (req, res) => {
  const { imageData } = req.body; // base64 string like "data:image/png;base64,..."
  if (!imageData) return res.status(400).json({ error: 'No image data' });
  try {
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format' });
    const ext = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload-audio', (req, res) => {
  const { audioData } = req.body;
  if (!audioData) return res.status(400).json({ error: 'No audio data' });
  try {
    const matches = audioData.match(/^data:audio\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid audio format' });
    const ext = matches[1] === 'mpeg' ? 'mp3' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ QUESTION KIT ROUTES ============

// Create a new question kit
app.post('/api/kits/create', async (req, res) => {
  const { teacherId, title, subject, gradeLevel, description } = req.body;

  // Gate: enforce kit limit based on subscription tier
  const kitCount = await new Promise(resolve =>
    db.get('SELECT COUNT(*) as c FROM question_kits WHERE teacher_id = ?', [teacherId], (_, r) => resolve(r?.c || 0))
  );
  const tier = await getUserTier(teacherId);
  const maxKits = ['blazes_plus', 'teacher_pro', 'school'].includes(tier) ? 999 : 10;
  if (kitCount >= maxKits) {
    return res.status(403).json({ error: 'upgrade_required', message: `Free accounts can create up to ${maxKits} kits. Upgrade for unlimited.`, requiredTier: 'blazes_plus' });
  }

  db.run(
    'INSERT INTO question_kits (teacher_id, title, subject, grade_level, description) VALUES (?, ?, ?, ?, ?)',
    [teacherId, title, subject, gradeLevel, description],
    function (err) {
      if (err) {
        console.log('Error creating kit:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        kitId: this.lastID,
        message: 'Kit created successfully'
      });
    }
  );
});

// Add a question to a kit
app.post('/api/kits/:kitId/questions', (req, res) => {
  const { kitId } = req.params;
  const { question_text, answer_type, correct_answer, option_a, option_b, option_c, option_d, image_url } = req.body;

  db.run(
    `INSERT INTO questions (kit_id, question_text, answer_type, correct_answer, option_a, option_b, option_c, option_d, image_url, time_limit, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [kitId, question_text, answer_type, correct_answer, option_a || '', option_b || '', option_c || '', option_d || '', image_url || null, 30, 100],
    function (err) {
      if (err) {
        console.log('Error adding question:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        kitId: kitId,
        questionId: this.lastID,
        message: 'Question added successfully'
      });
    }
  );
});

// Add many questions to a kit in one round-trip — used by Publish Kit.
// Replaces a sequential `for await` loop in CreateKit that took
// (questions × per-call latency) wall-clock; a 20-question kit on Turso
// previously took ~5s and now lands in ~300ms.
app.post('/api/kits/:kitId/questions/bulk', async (req, res) => {
  const { kitId } = req.params;
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array required' });
  }
  try {
    const inserted = await Promise.all(questions.map(q => dbRun(
      `INSERT INTO questions (kit_id, question_text, answer_type, correct_answer, option_a, option_b, option_c, option_d, image_url, time_limit, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kitId,
        q.question_text || '',
        q.answer_type || 'multiple_choice',
        q.correct_answer || '',
        q.option_a || '',
        q.option_b || '',
        q.option_c || '',
        q.option_d || '',
        q.image_url || null,
        30,
        100,
      ]
    )));
    res.json({ kitId, count: inserted.length, message: 'Questions added successfully' });
  } catch (err) {
    console.error('Error bulk-adding questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all kits for a teacher
app.get('/api/kits/teacher/:teacherId', (req, res) => {
  const { teacherId } = req.params;

  db.all(
    `SELECT k.*, COUNT(q.id) as question_count
     FROM question_kits k
     LEFT JOIN questions q ON k.id = q.kit_id
     WHERE k.teacher_id = ?
     GROUP BY k.id
     ORDER BY k.created_at DESC`,
    [teacherId],
    (err, kits) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(kits || []);
    }
  );
});

// Get a specific kit with its questions
app.get('/api/kits/:kitId', (req, res) => {
  const { kitId } = req.params;

  db.get('SELECT * FROM question_kits WHERE id = ?', [kitId], (err, kit) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });

    db.all('SELECT * FROM questions WHERE kit_id = ?', [kitId], (err, questions) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...kit, questions: questions || [] });
    });
  });
});

// Update a kit
app.put('/api/kits/:kitId', (req, res) => {
  const { kitId } = req.params;
  const { title, subject, grade_level, description } = req.body;

  db.run('UPDATE question_kits SET title = ?, subject = ?, grade_level = ?, description = ? WHERE id = ?',
    [title, subject, grade_level, description, kitId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Kit updated successfully' });
    }
  );
});

// Delete a kit (and all its questions).
//
// The previous version failed silently whenever the kit had ever been used
// in a game or referenced by an assignment — every FK pointing at this kit
// or its questions had to be cleared first or the deletes blew up. Now:
//   1. parallel: drop game_answers for these questions, null out games.kit_id,
//      null out assignments.kit_id  (preserves game/assignment history but
//      disconnects them from the soon-to-be-gone questions)
//   2. delete the questions
//   3. delete the kit
app.delete('/api/kits/:kitId', async (req, res) => {
  const { kitId } = req.params;
  try {
    // Phase 1 — clear dependents/references in parallel
    await Promise.all([
      dbRun(
        'DELETE FROM game_answers WHERE question_id IN (SELECT id FROM questions WHERE kit_id = ?)',
        [kitId]
      ),
      dbRun('UPDATE games SET kit_id = NULL WHERE kit_id = ?', [kitId]),
      dbRun('UPDATE assignments SET kit_id = NULL WHERE kit_id = ?', [kitId]),
    ]);
    // Phase 2 — questions
    await dbRun('DELETE FROM questions WHERE kit_id = ?', [kitId]);
    // Phase 3 — the kit itself
    await dbRun('DELETE FROM question_kits WHERE id = ?', [kitId]);
    res.json({ message: 'Kit deleted successfully' });
  } catch (err) {
    console.error('[delete kit]', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a question from a kit. Clears game_answers first so the FK doesn't block.
app.delete('/api/kits/:kitId/questions/:questionId', async (req, res) => {
  const { questionId } = req.params;
  try {
    await dbRun('DELETE FROM game_answers WHERE question_id = ?', [questionId]);
    await dbRun('DELETE FROM questions WHERE id = ?', [questionId]);
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('[delete question]', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a question
app.put('/api/kits/:kitId/questions/:questionId', (req, res) => {
  const { questionId } = req.params;
  const { question_text, correct_answer, options } = req.body;

  if (options && Array.isArray(options)) {
    // For multiple choice questions
    const optionA = options[0] || '';
    const optionB = options[1] || '';
    const optionC = options[2] || '';
    const optionD = options[3] || '';

    db.run(`UPDATE questions SET question_text = ?, correct_answer = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ? WHERE id = ?`,
      [question_text, correct_answer, optionA, optionB, optionC, optionD, questionId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Question updated successfully' });
      }
    );
  } else {
    // For true/false and short answer
    db.run('UPDATE questions SET question_text = ?, correct_answer = ? WHERE id = ?',
      [question_text, correct_answer, questionId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Question updated successfully' });
      }
    );
  }
});

// Create a new game
app.post('/api/games/create', (req, res) => {
  const { hostId, kitId, gameCode, gameMode, settings } = req.body;

  db.run(
    `INSERT INTO games (host_id, kit_id, game_code, game_mode, status, settings)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [hostId, kitId, gameCode, gameMode, 'waiting', JSON.stringify(settings)],
    function (err) {
      if (err) {
        console.error('Error creating game:', err);
        return res.status(500).json({ error: err.message });
      }
      const gameId = this.lastID;
      // Auto-join student hosts as a participant
      db.get('SELECT role, name FROM users WHERE id = ?', [hostId], (err, user) => {
        if (!err && user && user.role === 'student') {
          db.run('INSERT INTO game_participants (game_id, user_id, player_name) VALUES (?, ?, ?)',
            [gameId, hostId, user.name || 'Host']);
        }
      });
      res.json({
        gameId,
        gameCode: gameCode,
        message: 'Game created successfully'
      });
    }
  );
});

// Get game by code (includes questions from kit for gameplay)
app.get('/api/games/:gameCode', (req, res) => {
  const { gameCode } = req.params;

  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], async (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Parse settings if it's a string
    if (typeof game.settings === 'string') {
      game.settings = JSON.parse(game.settings);
    }

    // Auto-end game if time limit has passed
    if (game.status === 'started' && game.settings?.timeLimit && game.started_at) {
      const startedAt = new Date(game.started_at.replace(' ', 'T') + 'Z').getTime();
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsed >= game.settings.timeLimit) {
        await new Promise(resolve => db.run(
          'UPDATE games SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['ended', game.id], resolve
        ));
        game.status = 'ended';
      }
    }

    // Attach the host's equipped avatar skin so clients can render the host's pfp
    // without a separate fetch (and pick up changes on every poll).
    const hostEq = await new Promise(resolve =>
      db.get('SELECT avatar_skin FROM user_equipped WHERE user_id = ?', [game.host_id], (_, row) => resolve(row))
    );
    game.host_avatar_skin = hostEq?.avatar_skin || null;

    // Get participants joined with their equipped avatar skin
    db.all(
      `SELECT gp.*, ue.avatar_skin
       FROM game_participants gp
       LEFT JOIN user_equipped ue ON ue.user_id = gp.user_id
       WHERE gp.game_id = ?`,
      [game.id],
      (err, participants) => {
      if (err) return res.status(500).json({ error: err.message });

      // Get questions from the kit for gameplay
      db.all('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id], (err, rawQuestions) => {
        if (err) return res.status(500).json({ error: err.message });

        const questions = (rawQuestions || []).map((q) => {
          try {
          let opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
          const correctRaw = (q.correct_answer || '').trim();
          const correctUpper = correctRaw.toUpperCase();

          // True/False questions: if no options stored, generate them
          if (opts.length === 0 && (q.answer_type === 'true_false' || correctUpper === 'TRUE' || correctUpper === 'FALSE')) {
            opts = ['True', 'False'];
            const correctIndex = correctUpper === 'FALSE' ? 1 : 0;
            return { id: q.id, text: q.question_text, options: opts, correctAnswer: correctIndex, image_url: q.image_url, answerType: 'true_false' };
          }

          // Short answer (typed)
          if (q.answer_type === 'short_answer') {
            return { id: q.id, text: q.question_text, options: [], correctAnswer: correctRaw, image_url: q.image_url, answerType: 'short_answer' };
          }

          // Fill blank — multiple choice style (has options) or typed fallback
          if (q.answer_type === 'fill_blank') {
            if (opts.length > 0) {
              // Has options — treat like MC
              const letterMatch = correctUpper.match(/[A-D](?!.*[A-D])/);
              const correctIdx = letterMatch ? ['A', 'B', 'C', 'D'].indexOf(letterMatch[0]) : -1;
              if (correctIdx >= 0) {
                return { id: q.id, text: q.question_text, options: opts, correctAnswer: correctIdx, image_url: q.image_url, answerType: 'fill_blank' };
              }
            }
            // Fallback: typed answer
            return { id: q.id, text: q.question_text, options: [], correctAnswer: correctRaw, image_url: q.image_url, answerType: 'fill_blank' };
          }

          // Math equation
          if (q.answer_type === 'math_equation') {
            return { id: q.id, text: q.question_text, options: [], correctAnswer: correctRaw, image_url: q.image_url, answerType: 'math_equation' };
          }

          // Multi-select: correctAnswer is letters like "AB" or "ACD"
          if (q.answer_type === 'multi_select') {
            return { id: q.id, text: q.question_text, options: opts, correctAnswer: correctRaw, image_url: q.image_url, answerType: 'multi_select' };
          }

          // Ordering: correctAnswer is items joined by |||, options are shuffled
          if (q.answer_type === 'ordering') {
            const items = correctRaw.split('|||').filter(Boolean);
            const shuffled = [...items].sort(() => Math.random() - 0.5);
            return { id: q.id, text: q.question_text, options: shuffled, correctAnswer: items, image_url: q.image_url, answerType: 'ordering' };
          }

          // Matching: correctAnswer is pairs joined by ### with ||| between item and match
          if (q.answer_type === 'matching') {
            const pairs = correctRaw.split('###').filter(Boolean).map(p => {
              const [left, right] = p.split('|||');
              return { left: left?.trim(), right: right?.trim() };
            }).filter(p => p.left && p.right);
            const shuffledRight = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
            return { id: q.id, text: q.question_text, options: pairs.map(p => p.left), correctAnswer: pairs, rightOptions: shuffledRight, image_url: q.image_url, answerType: 'matching' };
          }

          // Image labeling: pins with coordinates stored as JSON in correct_answer
          if (q.answer_type === 'image_label') {
            let pins = [];
            try { pins = JSON.parse(correctRaw); } catch { pins = []; }
            if (Array.isArray(pins) && pins.length > 0) {
              // Send pins (with positions) and shuffled labels separately
              const labels = pins.map(p => p.label);
              const shuffledLabels = [...labels].sort(() => Math.random() - 0.5);
              return { id: q.id, text: q.question_text, options: shuffledLabels, correctAnswer: pins, image_url: q.image_url, answerType: 'image_label' };
            }
            // Fallback to old format
            const letterMatch2 = correctUpper.match(/[A-D](?!.*[A-D])/);
            const correctIdx = letterMatch2 ? ['A', 'B', 'C', 'D'].indexOf(letterMatch2[0]) : 0;
            return { id: q.id, text: q.question_text, options: opts, correctAnswer: correctIdx, image_url: q.image_url, answerType: 'image_label' };
          }

          // Audio: same as multiple choice but with audio URL in image_url field
          if (q.answer_type === 'audio') {
            const letterMatch3 = correctUpper.match(/[A-D](?!.*[A-D])/);
            const correctIdx2 = letterMatch3 ? ['A', 'B', 'C', 'D'].indexOf(letterMatch3[0]) : 0;
            return { id: q.id, text: q.question_text, options: opts, correctAnswer: correctIdx2, image_url: q.image_url, answerType: 'audio' };
          }

          // No options and has correct answer text
          if (opts.length === 0 && correctRaw) {
            return { id: q.id, text: q.question_text, options: [], correctAnswer: correctRaw, image_url: q.image_url, answerType: 'short_answer' };
          }

          // Multiple choice: extract A/B/C/D letter from correct_answer
          const letterMatch = correctUpper.match(/[A-D](?!.*[A-D])/);
          const correctIndex = letterMatch ? ['A', 'B', 'C', 'D'].indexOf(letterMatch[0]) : 0;
          return {
            id: q.id,
            text: q.question_text,
            options: opts,
            correctAnswer: correctIndex >= 0 ? correctIndex : 0,
            image_url: q.image_url
          };
          } catch (qe) {
            // A single malformed question would otherwise crash the whole
            // game-fetch with a 500. Swallow it, log, and let the others
            // through. Filtered out below.
            console.error('[questions] normalization failed for id=', q?.id, qe);
            return null;
          }
        }).filter(Boolean);

        res.json({ ...game, participants: participants || [], questions });
      });
    });
  });
});

// LIVE GAME STATE - Teacher bomb + student sync
app.get('/api/games/:gameCode/state', (req, res) => {
  const { gameCode } = req.params;

  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], async (err, game) => { // Made async to use await
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
    const now = new Date();
    const startedAt = game.started_at ? new Date(game.started_at.replace(' ', 'T') + 'Z') : null;
    const gameTimeElapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;

    // Check for game end conditions
    if (game.status === 'started' && settings?.timeLimit && gameTimeElapsed >= settings.timeLimit) {
      // Game ends due to time limit
      await new Promise((resolve, reject) => {
        db.run('UPDATE games SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['ended', game.id], (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      const updatedGame = await new Promise((resolve, reject) => db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], (err, row) => { if (err) reject(err); resolve(row); }));
      game = updatedGame;
    }

    db.all('SELECT * FROM game_participants WHERE game_id = ?', [game.id], (err, participants) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: game.id,
        gameCode,
        status: game.status,
        settings,
        gameTime: gameTimeElapsed,
        participants: participants || [],
        kitId: game.kit_id
      });
    });
  });
});

// Answer checking for short answer / fill blank types — exact match only (case-insensitive)
app.post('/api/check-answer', (req, res) => {
  const { userAnswer, correctAnswer } = req.body;
  if (!userAnswer || !correctAnswer) return res.json({ isCorrect: false });
  const isCorrect = userAnswer.trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
  res.json({ isCorrect });
});

// Student submits answer
app.post('/api/games/:gameCode/answer', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, questionId, selectedAnswer, isCorrect, timeTaken } = req.body;

  try {
    // Get game details
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT id, kit_id, settings, game_mode, round_started_at FROM games WHERE game_code = ?', [gameCode], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Get question details
    const question = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM questions WHERE id = ? AND kit_id = ?', [questionId, game.kit_id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    // Scoring:
    // Arena mode: flat 10 points per correct (no time pressure — answer at your own pace)
    // Other timed modes (classic, survival, wager): 50-100 based on speed. We
    // used to fall back to flat 10 when a question lacked a time_limit, which
    // made classic feel like it just counted by tens. Now we always use the
    // speed curve with a 30s default budget so the score actually reflects
    // how fast the player answered.
    // Wrong answer: 0
    let pointsEarned = 0;
    if (isCorrect) {
      if (game.game_mode === 'arena') {
        pointsEarned = 10;
      } else {
        const questionTimeLimit = question.time_limit || 30;
        const t = typeof timeTaken === 'number' && timeTaken >= 0 ? timeTaken : questionTimeLimit;
        const ratio = Math.min(1, t / questionTimeLimit);
        pointsEarned = Math.round(50 + 50 * (1 - ratio));
      }
    }
    console.log(`[scoring] mode=${game.game_mode} q.time_limit=${question.time_limit} timeTaken=${timeTaken} isCorrect=${isCorrect} → pointsEarned=${pointsEarned}`);

    // Record the answer (with time_taken)
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO game_answers (game_id, user_id, question_id, answer, is_correct, points_earned, time_taken) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [game.id, userId, questionId, selectedAnswer, isCorrect ? 1 : 0, pointsEarned, timeTaken || null],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    // Arena mode: apply combo + double-down + perm bonus
    // Single currency: score IS the currency (used for buying items)
    let arenaInfo = null;
    if (game.game_mode === 'arena') {
      const p = await dbGet('SELECT arena_combo, arena_max_combo, arena_double_down, arena_perm_bonus FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
      let combo = p?.arena_combo || 0;
      let maxCombo = p?.arena_max_combo || 0;
      const doubleDown = p?.arena_double_down || 0;
      const permBonus = p?.arena_perm_bonus || 0;

      if (isCorrect) {
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
        pointsEarned += permBonus;
        if (doubleDown > 0) {
          pointsEarned *= 2;
          await dbRun('UPDATE game_participants SET arena_double_down = arena_double_down - 1 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        }
      } else {
        combo = 0;
      }

      // Combo milestones — bonuses go into score
      // permBonus is capped at 5 (one-time at streak 7, no stacking on later 7s)
      // Ultimate ready flag: client picks target, server applies via attack endpoint
      const milestones = { 3: { bonus: 5 }, 5: { freeItem: true }, 7: { permBonus: 5 }, 10: { ultimate: true } };
      const milestone = milestones[combo];
      let extraPermBonus = 0;
      let ultimateReady = false;
      let freeItemKey = null;
      if (milestone) {
        if (milestone.bonus) pointsEarned += milestone.bonus;
        if (milestone.permBonus && permBonus < 5) {
          // Cap perm bonus at 5 — only awarded the first time you hit streak 7
          extraPermBonus = Math.min(milestone.permBonus, 5 - permBonus);
        }
        if (milestone.freeItem) {
          // Award random attack item (lightning or fireball)
          freeItemKey = Math.random() < 0.5 ? 'lightning' : 'fireball';
          await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, 0)', [game.id, userId, userId, freeItemKey]);
        }
        if (milestone.ultimate) {
          ultimateReady = true;
          // Award an Ultimate Strike to inventory (pick target via shop UI)
          await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, 0)', [game.id, userId, userId, 'ultimate']);
          // Reset combo so they have to rebuild for the next ultimate
          combo = 0;
        }
      }

      await dbRun(
        'UPDATE game_participants SET arena_combo = ?, arena_max_combo = ?, arena_perm_bonus = arena_perm_bonus + ? WHERE game_id = ? AND user_id = ?',
        [combo, maxCombo, extraPermBonus, game.id, userId]
      );

      arenaInfo = {
        combo,
        milestone: milestone ? Object.keys(milestones).find(k => milestones[k] === milestone) : null,
        freeItem: freeItemKey,
        ultimateReady,
      };
    }

    // Update participant's score
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE game_participants SET score = score + ? WHERE game_id = ? AND user_id = ?',
        [pointsEarned, game.id, userId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Survival mode: check if all non-eliminated players have answered this round → trigger early round end
    if (game.game_mode === 'survival') {
      // Re-fetch fresh game state so round_started_at is current (not stale from handler start)
      const freshGame = await dbGet('SELECT * FROM games WHERE id = ?', [game.id]);
      if (freshGame.round_status !== 'answering') {
        // Round already ended (timer or another request), skip
      } else {
        const [participants, answeredCount] = await Promise.all([
          dbAll('SELECT user_id FROM game_participants WHERE game_id = ? AND eliminated = 0', [game.id]),
          dbGet(
            `SELECT COUNT(DISTINCT ga.user_id) as count FROM game_answers ga
             JOIN game_participants gp ON ga.user_id = gp.user_id AND gp.game_id = ga.game_id
             WHERE ga.game_id = ? AND ga.question_id = ? AND ga.answered_at >= ? AND gp.eliminated = 0`,
            [game.id, questionId, freshGame.round_started_at || '1970-01-01']
          )
        ]);
        console.log(`[answer] all-answered check: ${answeredCount.count}/${participants.length} answered, round_started_at=${freshGame.round_started_at}, questionId=${questionId}`);
        if (answeredCount.count >= participants.length) {
          const allQuestions = await dbAll('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id]);
          await endRound(freshGame, allQuestions, 'all-answered');
        }
      }
    }

    res.json({ success: true, isCorrect, pointsEarned, arenaInfo });
  } catch (err) {
    console.error('Error processing answer:', err);
    res.status(500).json({ error: err.message });
  }
});

// Join a game
app.post('/api/games/:gameCode/join', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, playerName } = req.body;

  // Guests join with a negative id that does not exist in `users`, which trips
  // the FK constraint on game_participants. Insert a placeholder user row so
  // the FK is satisfied. INSERT OR IGNORE makes this safe to call repeatedly.
  if (userId < 0) {
    try {
      await dbRun(
        `INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, 'guest')`,
        [userId, playerName || 'Guest']
      );
    } catch (e) { console.error('[join] guest user insert failed', e); }
  }

  // First get the game + host role
  db.get(
    `SELECT g.*, u.role AS host_role FROM games g JOIN users u ON g.host_id = u.id WHERE g.game_code = ?`,
    [gameCode], (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // A rejoin within the leave grace window cancels the pending "Left" mark.
    const key = `${game.id}:${userId}`;
    if (pendingLeaves.has(key)) {
      clearTimeout(pendingLeaves.get(key));
      pendingLeaves.delete(key);
    }
    // Clear any prior left_at so the rejoin shows them as active again.
    db.run('UPDATE game_participants SET left_at = NULL WHERE game_id = ? AND user_id = ?', [game.id, userId], () => {});

    // Check if player already joined
    db.get('SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });

      if (existing) {
        return res.json({ participantId: existing.id, alreadyJoined: true });
      }

      // Display-name uniqueness within a game. Account names can collide
      // freely (two real users named "Alex" both signing up is fine), but a
      // single game with two "Alex"es on the leaderboard is confusing for
      // the teacher and the room. Compare case-insensitively against any
      // already-joined player who isn't this same user. If a guest is using
      // a default "Guest"/"Player" name, skip the check — collisions there
      // are expected and the teacher can spot them visually.
      const trimmedName = String(playerName || '').trim();
      const isPlaceholder = !trimmedName || /^(guest|player)$/i.test(trimmedName);
      // The host always wins any name collision in their own game — their
      // account name is theirs, and silently failing their auto-join (so they
      // never appear on the leaderboard) is much worse than a duplicate label
      // for the teacher to notice.
      const isHostJoining = Number(userId) === Number(game.host_id);
      const checkNameAndInsert = (insertFn) => {
        if (isPlaceholder || isHostJoining) return insertFn();
        db.get(
          `SELECT 1 FROM game_participants WHERE game_id = ? AND user_id != ?
             AND LOWER(TRIM(player_name)) = LOWER(?) LIMIT 1`,
          [game.id, userId, trimmedName],
          (err, dup) => {
            if (err) return res.status(500).json({ error: err.message });
            if (dup) {
              return res.status(409).json({
                error: `The name "${trimmedName}" is already taken in this game. Try another.`,
                code: 'name_taken',
              });
            }
            insertFn();
          }
        );
      };

      // Enforce player limit for student-hosted games (tier-based)
      if (game.host_role === 'student') {
        db.get('SELECT COUNT(*) AS count FROM game_participants WHERE game_id = ?', [game.id], async (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          const hostTier = await getUserTier(game.host_id);
          const maxPlayers = ['blazes_plus'].includes(hostTier) ? 15 : 5;
          if (row.count >= maxPlayers) {
            return res.status(400).json({ error: `This game is full (${maxPlayers} player max)` });
          }
          checkNameAndInsert(() => {
            db.run(
              'INSERT INTO game_participants (game_id, user_id, player_name) VALUES (?, ?, ?)',
              [game.id, userId, playerName || 'Player'],
              function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ participantId: this.lastID, message: 'Joined successfully' });
              }
            );
          });
        });
      } else {
        // Teacher-hosted: no limit
        checkNameAndInsert(() => {
          db.run(
            'INSERT INTO game_participants (game_id, user_id, player_name) VALUES (?, ?, ?)',
            [game.id, userId, playerName || 'Player'],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ participantId: this.lastID, message: 'Joined successfully' });
            }
          );
        });
      }
    });
  });
});

// Pending-leave timers — give players a 5s grace period after a tab close so a
// quick refresh doesn't show them as "Left" to the teacher. Cleared if the
// player rejoins within the window. In-memory map; if the server restarts the
// pending leaves are dropped, which is fine — the player's UI will rejoin.
const pendingLeaves = new Map(); // key: `${gameId}:${userId}` -> timeoutId
const LEAVE_GRACE_MS = 5000;

// Mark a participant as left after a 5s grace period.
app.post('/api/games/:gameCode/leave', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const game = await dbGet('SELECT id FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const key = `${game.id}:${userId}`;
    if (pendingLeaves.has(key)) clearTimeout(pendingLeaves.get(key));
    pendingLeaves.set(key, setTimeout(async () => {
      try {
        await dbRun(`UPDATE game_participants SET left_at = datetime('now') WHERE game_id = ? AND user_id = ? AND left_at IS NULL`, [game.id, userId]);
      } catch (_) {}
      pendingLeaves.delete(key);
    }, LEAVE_GRACE_MS));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start a game (ONLY the host who must be a teacher can start - students can NEVER start)
app.put('/api/games/:gameCode/start', (req, res) => {
  const { gameCode } = req.params;
  const { userId } = req.body;

  console.log(`[START GAME] gameCode=${gameCode}, userId=${userId}, type=${typeof userId}`);

  // Verify the requesting user is the host of this game AND is a teacher
  db.get(
    `SELECT g.host_id, g.game_mode, u.role, u.email FROM games g
     JOIN users u ON g.host_id = u.id
     WHERE g.game_code = ?`,
    [gameCode],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Game not found' });

      console.log(`[START GAME] host_id=${row.host_id} (${row.email}, role=${row.role}), requesting userId=${userId}`);

      if (parseInt(userId) !== row.host_id) {
        return res.status(403).json({ error: `Only the game host can start the game (host: ${row.host_id}, you: ${userId})` });
      }

      const extraFields = row.game_mode === 'survival'
        ? `, current_question_index = 0, round_started_at = datetime('now', '+5 seconds'), round_status = 'answering', round_ended_at = NULL`
        : '';
      db.run(`UPDATE games SET status = 'started', started_at = CURRENT_TIMESTAMP${extraFields} WHERE game_code = ?`,
        [gameCode],
        async (err) => {
          if (err) return res.status(500).json({ error: err.message });

          // Elemental Clash: assign teams
          if (row.game_mode === 'elemental_clash') {
            try {
              const game = await dbGet('SELECT id FROM games WHERE game_code = ?', [gameCode]);
              const participants = await dbAll('SELECT user_id FROM game_participants WHERE game_id = ?', [game.id]);
              // Shuffle and split into 2 teams
              const shuffled = participants.sort(() => Math.random() - 0.5);
              for (let i = 0; i < shuffled.length; i++) {
                const team = i < Math.ceil(shuffled.length / 2) ? 1 : 2;
                await dbRun('UPDATE game_participants SET team = ?, energy_points = 0 WHERE game_id = ? AND user_id = ?', [team, game.id, shuffled[i].user_id]);
              }
            } catch (e) { console.error('[elemental_clash] team assignment error:', e); }
          }

          // Inferno Tower: init all players
          if (row.game_mode === 'inferno_tower') {
            try {
              const game = await dbGet('SELECT id FROM games WHERE game_code = ?', [gameCode]);
              await dbRun('UPDATE game_participants SET tower_floor = 0, is_ghost = 0, frozen_until = NULL WHERE game_id = ?', [game.id]);
            } catch (e) { console.error('[inferno_tower] init error:', e); }
          }

          res.json({ message: 'Game started' });
        }
      );
    }
  );
});



// Cancel a game (teacher leaves lobby before starting)
app.put("/api/games/:gameCode/cancel", (req, res) => {
  const { gameCode } = req.params;
  db.run("UPDATE games SET status = ? WHERE game_code = ?",
    ["cancelled", gameCode],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      console.log("[Game] Game " + gameCode + " cancelled by host");
      res.json({ message: "Game cancelled" });
    }
  );
});

// End a game — awards placement BB if 10+ participants
app.put('/api/games/:gameCode/end', (req, res) => {
  const { gameCode } = req.params;

  db.run('UPDATE games SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE game_code = ?',
    ['ended', gameCode],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // For Elemental Markets games, lock in portfolio values as final scores
      try { await app.locals.settleMarketsScores?.(gameCode); } catch (_) {}

      // Placement BB: 10+ participants, game >= 5 min
      db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], (err, game) => {
        if (err || !game) return;
        const gameDuration = game.started_at ? (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000 : 0;
        if (gameDuration < 300) return; // under 5 min = no BB

        db.all(
          `SELECT user_id, score FROM game_participants WHERE game_id = ? ORDER BY score DESC`,
          [game.id],
          async (err, participants) => {
            if (err || !participants) return;

            // Host BB: any host (teacher or student) gets BB for running a game ≥ 5 min with at least one non-host player
            try {
              const hostId = game.host_id;
              if (hostId) {
                const alreadyAwarded = await dbGet(
                  `SELECT id FROM blazes_bucks_log WHERE user_id = ? AND game_code = ? AND reason = 'host_game' LIMIT 1`,
                  [hostId, gameCode]
                );
                if (!alreadyAwarded) {
                  const nonHostCount = participants.filter(p => p.user_id !== hostId).length;
                  if (nonHostCount >= 1) {
                    // 15 BB base + 3 per non-host player, capped at 60 BB per game
                    const hostBB = Math.min(60, 15 + nonHostCount * 3);
                    await awardBBWithCap(hostId, hostBB, 'host_game', gameCode);
                    console.log(`[BB] Host bonus: +${hostBB} BB to user ${hostId} (${nonHostCount} players, game ${gameCode})`);
                  }
                }
              }
            } catch (hbErr) { console.error('[BB] host bonus error:', hbErr); }

            if (participants.length < 10) return;
            const prizes = [50, 30, 20];
            const reasons = ['placement_1st', 'placement_2nd', 'placement_3rd'];
            for (let i = 0; i < Math.min(3, participants.length); i++) {
              const earned = await getBBEarnedToday(participants[i].user_id);
              if (earned >= 1000) continue; // daily cap
              await awardBBWithCap(participants[i].user_id, prizes[i], reasons[i], gameCode);
            }
            // 4th+ get 10 BB
            for (let i = 3; i < participants.length; i++) {
              const earned = await getBBEarnedToday(participants[i].user_id);
              if (earned >= 1000) continue;
              await awardBBWithCap(participants[i].user_id, 10, 'placement_other', gameCode);
            }
          }
        );
      });

      res.json({ message: 'Game ended' });
    }
  );
});

// Host bailed out mid-game. Marks status='ended' and abandoned=1 so the results
// page can show a "host ended early" message instead of the placement leaderboard.
// No placement BB awarded — the game wasn't completed normally.
app.put('/api/games/:gameCode/abandon', (req, res) => {
  const { gameCode } = req.params;
  db.run(
    `UPDATE games SET status = 'ended', abandoned = 1, ended_at = CURRENT_TIMESTAMP WHERE game_code = ? AND status != 'ended'`,
    [gameCode],
    async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      try { await app.locals.settleMarketsScores?.(gameCode); } catch (_) {}
      res.json({ message: 'Game abandoned', changed: this.changes });
    }
  );
});

// Submit final score for game — awards BB based on new economy
app.post('/api/games/:gameCode/answers', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, finalScore, questionsAnswered, correctCount, totalQuestions } = req.body;

  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], async (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const answeredAccuracy = (questionsAnswered || 0) > 0 ? Math.round(((correctCount || 0) / (questionsAnswered || 1)) * 100) : 0;

    // Update user_stats with cumulative accuracy calculation
    db.run(
      `UPDATE user_stats SET
         totalGames = totalGames + 1,
         questionsAnswered = questionsAnswered + ?,
         totalCorrectAnswers = totalCorrectAnswers + ?,
         accuracyRate = CASE WHEN (questionsAnswered + ?) > 0 THEN CAST(ROUND((CAST(totalCorrectAnswers + ? AS FLOAT) / (questionsAnswered + ?)) * 100) AS INTEGER) ELSE 0 END,
         avgScore = (avgScore + ?) / 2
       WHERE user_id = ?`,
      [questionsAnswered || 0, correctCount || 0, questionsAnswered || 0, correctCount || 0, questionsAnswered || 0, finalScore || 0, userId],
      (err) => { if (err) console.error('Error updating user_stats:', err); }
    );

    // We intentionally do NOT overwrite game_participants.score here. The
    // server already accumulated the correct value via /api/games/:gameCode/answer
    // (which applies the 50-100 speed curve per correct answer). The client-
    // computed `finalScore` uses a different formula (pointsPerCorrectAnswer
    // default 100) and overwriting clobbered the real tally — that's why
    // classic-mode results were showing 10 instead of the real score.

    // Assignment completion check — must run before BB economy early returns
    if (game.assignment_id) {
      try {
        const assignment = await dbGet('SELECT * FROM assignments WHERE id = ?', [game.assignment_id]);
        if (assignment) {
          const reqs = typeof assignment.requirements === 'string' ? JSON.parse(assignment.requirements) : (assignment.requirements || {});
          let completed = true;
          if (reqs.min_questions && (questionsAnswered || 0) < reqs.min_questions) completed = false;
          if (reqs.min_accuracy && answeredAccuracy < reqs.min_accuracy) completed = false;
          const status = completed ? 'completed' : 'in_progress';

          // Ensure submission record exists
          await dbRun(
            `INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id, status) VALUES (?, ?, 'pending')`,
            [game.assignment_id, userId]);

          // Get existing values to compare
          const existing = await dbGet(
            `SELECT questions_answered, correct_answers, score FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
            [game.assignment_id, userId]);
          const newQA = Math.max(existing?.questions_answered || 0, questionsAnswered || 0);
          const newCA = Math.max(existing?.correct_answers || 0, correctCount || 0);
          const newScore = Math.max(existing?.score || 0, finalScore || 0);
          console.log(`[Assignment] Updating: id=${game.assignment_id}, student=${userId}, status=${status}, qa=${newQA}, ca=${newCA}, score=${newScore}`);
          await dbRun(
            `UPDATE assignment_submissions SET status = ?, questions_answered = ?, correct_answers = ?, score = ?, completed_at = ?
             WHERE assignment_id = ? AND student_id = ?`,
            [status, newQA, newCA, newScore, completed ? new Date().toISOString() : null, game.assignment_id, userId]);
          console.log(`[Assignment] Update completed for assignment ${game.assignment_id}, status: ${status}`);
          if (completed) {
            const classroom = await dbGet('SELECT teacher_id, name FROM classrooms WHERE id = ?', [assignment.classroom_id]);
            const student = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);
            if (classroom) {
              if (await shouldNotify(classroom.teacher_id, 'student_completed')) {
                await dbRun('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                  [classroom.teacher_id, 'student_completed', 'Assignment Completed', `${student?.name || 'Student'} completed "${assignment.title}" in ${classroom.name}`]);
              }
            }
            // Award assignment XP
            try {
              let assignXP = 40; // base completion XP
              if (assignment.due_date && new Date(assignment.due_date) > new Date()) assignXP += 15; // before due date
              if (answeredAccuracy >= 100) assignXP += 20; // perfect accuracy
              await awardSeasonXP(userId, assignXP, 'assignment_complete', gameCode);
            } catch (_) {}
          }
          console.log(`[Assignment] ${status} for user ${userId}, assignment ${game.assignment_id} (${questionsAnswered}q, ${answeredAccuracy}%)`);
        }
      } catch (e) { console.error('[Assignment] completion check error:', e); }
    }

    // ─── PLAYTIME & STREAK TRACKING (runs before BB gates) ───
    const today = new Date().toISOString().split('T')[0];
    const gameDuration = game.started_at
      ? (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000
      : 0;

    // Track daily playtime (always, regardless of BB eligibility)
    try {
      await dbRun(
        `INSERT INTO bb_daily_tracker (user_id, date, games_played, bb_earned_today, playtime_seconds)
         VALUES (?, ?, 1, 0, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET
           games_played = games_played + 1,
           playtime_seconds = playtime_seconds + ?`,
        [userId, today, Math.round(gameDuration), Math.round(gameDuration)]
      );

      // Compute day streak: consecutive days (including today) with >= 300s playtime
      const activeDays = await dbAll(
        `SELECT date FROM bb_daily_tracker WHERE user_id = ? AND playtime_seconds >= 300 ORDER BY date DESC LIMIT 365`,
        [userId]
      );
      let streak = 0;
      let checkDate = new Date(today + 'T00:00:00');
      for (const row of activeDays) {
        const rowDate = row.date;
        const expected = checkDate.toISOString().split('T')[0];
        if (rowDate === expected) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      await dbRun('UPDATE user_stats SET dayStreak = ? WHERE user_id = ?', [streak, userId]);
    } catch (e) { console.error('[Streak] tracking error:', e); }

    // ─── SEASON XP AWARDING ───
    let totalXPEarned = 0;
    try {
      let xpEarned = 0;
      const minQuestionsForXP = 5;
      const gameAccuracy = (questionsAnswered || 0) > 0 ? (correctCount || 0) / (questionsAnswered || 1) * 100 : 0;

      // Anti-farming: must answer 5+ questions and have 20%+ accuracy
      if ((questionsAnswered || 0) >= minQuestionsForXP && gameAccuracy >= 20) {
        // Anti-farming: same kit 3 plays/day max
        const season = await getCurrentSeason();
        const kitPlaysToday = await dbGet(
          `SELECT COUNT(*) AS c FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'game_complete' AND game_code IN (
            SELECT game_code FROM games WHERE kit_id = ? AND DATE(created_at) = ?
          )`, [userId, season.id, game.kit_id, today]
        );
        const kitCapped = (kitPlaysToday?.c || 0) >= 3;

        if (!kitCapped) {
          const xpParticipantCount = (await dbGet('SELECT COUNT(*) AS c FROM game_participants WHERE game_id = ?', [game.id]))?.c || 0;
          const isSolo = xpParticipantCount <= 1;

          // Check hidden sub-caps for today
          const soloXPToday = (await dbGet(
            `SELECT COALESCE(SUM(amount), 0) AS s FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'game_complete_solo' AND DATE(created_at) = ?`,
            [userId, season.id, today]
          ))?.s || 0;
          const answerXPToday = (await dbGet(
            `SELECT COALESCE(SUM(amount), 0) AS s FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'correct_answers' AND DATE(created_at) = ?`,
            [userId, season.id, today]
          ))?.s || 0;

          // Correct answers: +5 XP each (min 0.5s answer time enforced), sub-cap 300/day
          const validCorrect = await dbGet(
            `SELECT COUNT(*) AS c FROM game_answers WHERE game_id = ? AND user_id = ? AND is_correct = 1 AND (time_taken >= 0.5 OR time_taken IS NULL)`,
            [game.id, userId]
          );
          let answerXP = (validCorrect?.c || 0) * 5;

          // Speed bonus: correct + under 2s = +2 XP each, under 1s = +5 XP each
          const fastAnswers = await dbGet(
            `SELECT
              SUM(CASE WHEN is_correct = 1 AND time_taken < 1 AND time_taken >= 0.5 THEN 1 ELSE 0 END) AS ultra_fast,
              SUM(CASE WHEN is_correct = 1 AND time_taken >= 1 AND time_taken < 2 THEN 1 ELSE 0 END) AS fast
            FROM game_answers WHERE game_id = ? AND user_id = ?`,
            [game.id, userId]
          );
          answerXP += (fastAnswers?.ultra_fast || 0) * 5;
          answerXP += (fastAnswers?.fast || 0) * 2;

          // Correct answer streaks
          const answers = await dbAll(
            'SELECT is_correct FROM game_answers WHERE game_id = ? AND user_id = ? ORDER BY answered_at ASC',
            [game.id, userId]
          );
          let xpStreak = 0, maxXpStreak = 0;
          for (const a of answers) {
            if (a.is_correct) { xpStreak++; maxXpStreak = Math.max(maxXpStreak, xpStreak); }
            else xpStreak = 0;
          }
          if (maxXpStreak >= 10) answerXP += 10;
          else if (maxXpStreak >= 3) answerXP += 3;

          // Apply hidden 300/day cap on answer-based XP
          answerXP = Math.min(answerXP, Math.max(0, 300 - answerXPToday));
          if (answerXP > 0) {
            const r = await awardSeasonXP(userId, answerXP, 'correct_answers', gameCode);
            totalXPEarned += r.awarded || 0;
          }

          // Game completion + bonus XP (separate from answer XP)
          let gameXP = 15; // Finish game

          // Accuracy bonuses (min 10 questions)
          if ((questionsAnswered || 0) >= 10) {
            if (gameAccuracy >= 100) gameXP += 30;
            else if (gameAccuracy >= 90) gameXP += 15;
            else if (gameAccuracy >= 80) gameXP += 8;
          }

          // Multiplayer bonuses
          if (xpParticipantCount >= 5) gameXP += 20;
          else if (xpParticipantCount >= 3) gameXP += 10;

          // Win bonus (1st place in multiplayer with 3+ players)
          if (xpParticipantCount >= 3) {
            const rankings = await dbAll(
              'SELECT user_id, score FROM game_participants WHERE game_id = ? ORDER BY score DESC',
              [game.id]
            );
            const rank = rankings.findIndex(r => r.user_id === parseInt(userId)) + 1;
            if (rank === 1) gameXP += 25;
            else if (rank === 2) gameXP += 15;
            else if (rank === 3) gameXP += 10;
          }

          // Host bonus (student hosting their own game)
          if (game.host_id === parseInt(userId)) gameXP += 10;

          // Apply hidden 500/day cap on solo game XP
          if (isSolo) {
            gameXP = Math.min(gameXP, Math.max(0, 500 - soloXPToday));
            if (gameXP > 0) { const r = await awardSeasonXP(userId, gameXP, 'game_complete_solo', gameCode); totalXPEarned += r.awarded || 0; }
          } else {
            xpEarned += gameXP;
          }
        }

        // Daily play bonus (once per day, not affected by kit cap)
        const dailyPlayCheck = await dbGet(
          `SELECT COUNT(*) AS c FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'daily_play' AND DATE(created_at) = ?`,
          [userId, season.id, today]
        );
        if ((dailyPlayCheck?.c || 0) === 0) {
          const r = await awardSeasonXP(userId, 10, 'daily_play', gameCode);
          totalXPEarned += r.awarded || 0;
        }

        // Daily 5+ min bonus (once per day)
        if (gameDuration >= 300) {
          const dailyTimeCheck = await dbGet(
            `SELECT COUNT(*) AS c FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'daily_5min' AND DATE(created_at) = ?`,
            [userId, season.id, today]
          );
          if ((dailyTimeCheck?.c || 0) === 0) {
            const r = await awardSeasonXP(userId, 10, 'daily_5min', gameCode);
            totalXPEarned += r.awarded || 0;
          }
        }

        // Streak day bonus
        const bbStreakRow = await dbGet('SELECT current_streak FROM blazes_bucks WHERE user_id = ?', [userId]);
        const currentDayStreak = bbStreakRow?.current_streak || 0;
        if (currentDayStreak > 0) {
          const streakCheck = await dbGet(
            `SELECT COUNT(*) AS c FROM season_xp_log WHERE user_id = ? AND season_id = ? AND source = 'streak_day' AND DATE(created_at) = ?`,
            [userId, season.id, today]
          );
          if ((streakCheck?.c || 0) === 0) {
            const r = await awardSeasonXP(userId, Math.min(currentDayStreak * 5, 175), 'streak_day', gameCode);
            totalXPEarned += r.awarded || 0;
          }
        }

        // Apply season pass XP multiplier
        const userTierForXP = await getUserTier(userId);
        if (['blazes_plus'].includes(userTierForXP)) {
          xpEarned = Math.round(xpEarned * 1.5);
        }

        // Award main game XP (multiplayer)
        if (xpEarned > 0) {
          const r = await awardSeasonXP(userId, xpEarned, 'game_complete', gameCode);
          totalXPEarned += r.awarded || 0;
        }
      }
    } catch (xpErr) { console.error('[XP] Season XP error:', xpErr); }

    // ─── NEW BB ECONOMY ───
    let bbEarned = 0;
    const earnedToday = await getBBEarnedToday(userId);
    if (earnedToday >= 1000) {
      return res.json({ message: 'Score submitted', score: finalScore, bbEarned: 0, xpEarned: totalXPEarned });
    }

    if (gameDuration < 300) {
      return res.json({ message: 'Score submitted', score: finalScore, bbEarned: 0, xpEarned: totalXPEarned });
    }

    // Check accuracy >= 30%
    if (accuracy < 30) {
      return res.json({ message: 'Score submitted', score: finalScore, bbEarned: 0, xpEarned: totalXPEarned });
    }

    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : (game.settings || {});
    const participantCount = (await dbGet('SELECT COUNT(*) as c FROM game_participants WHERE game_id = ?', [game.id]))?.c || 0;

    // 1. Correct answer bonus: every 10 correct = +20 BB
    const correctBonusSets = Math.floor((correctCount || 0) / 10);
    if (correctBonusSets > 0) {
      const correctBB = correctBonusSets * 20;
      bbEarned += correctBB;
      await awardBBWithCap(userId, correctBB, 'correct_answers', gameCode);
    }

    // 2. Playtime bonus: +20 BB per 20 min (any player count)
    const playtimeMinutes = gameDuration / 60;
    const playtimeSets = Math.floor(playtimeMinutes / 20);
    if (playtimeSets > 0) {
      const ptBB = playtimeSets * 20;
      bbEarned += ptBB;
      await awardBBWithCap(userId, ptBB, 'playtime', gameCode);
    }

    // 3. Accuracy bonus: 100% = +10 BB
    if (accuracy === 100 && (correctCount || 0) >= 5) {
      bbEarned += 10;
      await awardBBWithCap(userId, 10, 'perfect_accuracy', gameCode);
    }

    // 4. Speed bonus: more than (game_seconds / 1.5) correct answers = +50 BB
    const speedThreshold = Math.floor(gameDuration / 1.5);
    if ((correctCount || 0) > speedThreshold && speedThreshold > 0) {
      bbEarned += 50;
      await awardBBWithCap(userId, 50, 'speed_bonus', gameCode);
    }

    // 5. Track BB earned today (games_played already incremented in playtime tracking above)
    await dbRun(
      `INSERT INTO bb_daily_tracker (user_id, date, games_played, bb_earned_today) VALUES (?, ?, 0, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET bb_earned_today = bb_earned_today + ?`,
      [userId, today, bbEarned, bbEarned]
    );

    // 6. Daily streak check (need 1+ game today)
    const todayTracker = await dbGet('SELECT games_played FROM bb_daily_tracker WHERE user_id = ? AND date = ?', [userId, today]);
    if ((todayTracker?.games_played || 0) >= 1) {
      const bbRow = await dbGet('SELECT last_streak_date, current_streak FROM blazes_bucks WHERE user_id = ?', [userId]);
      const lastDate = bbRow?.last_streak_date;
      const currentStreak = bbRow?.current_streak || 0;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      let newStreak;
      if (lastDate === today) {
        newStreak = currentStreak; // already counted today
      } else if (lastDate === yesterday) {
        newStreak = currentStreak + 1; // consecutive day
      } else {
        newStreak = 1; // streak reset
      }

      if (lastDate !== today) {
        // Award daily streak BB
        const streakDay = ((newStreak - 1) % 7) + 1; // 1-7 cycle
        const streakBB = streakDay === 7 ? 50 : 10;
        bbEarned += streakBB;
        await awardBBWithCap(userId, streakBB, `daily_streak_day${streakDay}`, gameCode);
        // Update streak tracking
        await dbRun(
          `INSERT INTO blazes_bucks (user_id, balance, last_streak_date, current_streak) VALUES (?, 0, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET last_streak_date = ?, current_streak = ?`,
          [userId, today, newStreak, today, newStreak]
        );
        console.log(`[BB] Daily streak day ${streakDay} for user ${userId}: +${streakBB} BB`);
      }
    }

    // Apply season pass BB multiplier
    if (['blazes_plus'].includes(await getUserTier(userId))) {
      bbEarned = Math.round(bbEarned * 2);
    }

    console.log(`[BB] Game end: user ${userId} earned ${bbEarned} BB total (accuracy: ${accuracy}%, correct: ${correctCount}, duration: ${Math.round(gameDuration)}s)`);

    res.json({ message: 'Score submitted', score: finalScore, bbEarned, xpEarned: totalXPEarned });
  });
});

// Get full game results (all participants) — used by teacher results page
app.get('/api/games/:gameCode/results', (req, res) => {
  const { gameCode } = req.params;

  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    db.all(
      `SELECT gp.user_id, gp.player_name, gp.score, gp.lives, gp.eliminated, gp.eliminated_at_round, gp.left_at,
              u.name, u.role,
              (SELECT COUNT(*) FROM game_answers WHERE game_id = gp.game_id AND user_id = gp.user_id AND is_correct = 1) AS correct_answers,
              (SELECT COUNT(*) FROM game_answers WHERE game_id = gp.game_id AND user_id = gp.user_id) AS questions_answered,
              (SELECT AVG(time_taken) FROM game_answers WHERE game_id = gp.game_id AND user_id = gp.user_id) AS avg_time
       FROM game_participants gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.game_id = ?
       ORDER BY gp.score DESC, (CASE WHEN questions_answered > 0 THEN CAST(correct_answers AS FLOAT) / questions_answered ELSE 0 END) DESC, questions_answered DESC`,
      [game.id],
      (err, participants) => {
        if (err) return res.status(500).json({ error: err.message });

        const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
        res.json({
          gameCode,
          gameMode: game.game_mode,
          status: game.status,
          abandoned: !!game.abandoned,
          settings,
          totalRoundsPlayed: game.rounds_played || 0,
          participants: participants || []
        });
      }
    );
  });
});

// Get detailed game analytics for teachers (Pro feature)
app.get('/api/games/:gameCode/details', (req, res) => {
  const { gameCode } = req.params;

  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], async (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    try {
      // Get kit info
      const kitInfo = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM question_kits WHERE id = ?', [game.kit_id], (err, kit) => {
          err ? reject(err) : resolve(kit);
        });
      });

      // Get all game participants
      const allParticipants = await new Promise((resolve, reject) => {
        db.all(
          `SELECT gp.user_id, gp.player_name, gp.score, u.name as user_name
           FROM game_participants gp
           LEFT JOIN users u ON gp.user_id = u.id
           WHERE gp.game_id = ?
           ORDER BY gp.score DESC`,
          [game.id],
          (err, data) => {
            err ? reject(err) : resolve(data || []);
          }
        );
      });

      // Get detailed answers for each participant
      const participants = await Promise.all(
        allParticipants.map(async (p) => {
          const answers = await new Promise((resolve, reject) => {
            db.all(
              `SELECT 
                ga.question_id,
                ga.answer,
                ga.is_correct,
                ga.time_taken,
                ga.points_earned,
                q.question_text
              FROM game_answers ga
              LEFT JOIN questions q ON ga.question_id = q.id
              WHERE ga.game_id = ? AND ga.user_id = ?
              ORDER BY ga.answered_at ASC`,
              [game.id, p.user_id],
              (err, data) => {
                err ? reject(err) : resolve(data || []);
              }
            );
          });

          const totalAnswered = answers.length;
          const correctAnswers = answers.filter(a => a.is_correct).length;

          return {
            user_id: p.user_id,
            player_name: p.player_name,
            user_name: p.user_name,
            score: p.score,
            total_answered: totalAnswered,
            correct_answers: correctAnswers,
            accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
            answers: answers
          };
        })
      );

      // Get overall game stats
      const gameStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
            COUNT(*) as total_questions,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
            AVG(time_taken) as avg_time
          FROM game_answers
          WHERE game_id = ?`,
          [game.id],
          (err, stats) => {
            err ? reject(err) : resolve(stats || {});
          }
        );
      });

      const totalQuestions = gameStats.total_questions || 0;
      const correctAnswers = gameStats.correct_answers || 0;

      let gameName = null;
      try {
        const s = typeof game.settings === 'string' ? JSON.parse(game.settings) : (game.settings || {});
        gameName = s?.gameName || null;
      } catch (_) {}
      res.json({
        game_code: gameCode,
        game_mode: game.game_mode,
        game_name: gameName,
        created_at: game.created_at,
        status: game.status,
        kit_title: kitInfo?.title || 'Unknown Kit',
        kit_subject: kitInfo?.subject,
        players: participants.length,
        participants,
        total: totalQuestions,
        correct: correctAnswers,
        avg_score: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) : 0,
        avg_time: gameStats.avg_time || 0
      });
    } catch (err) {
      console.error('Game details error:', err);
      res.status(500).json({ error: 'Failed to fetch game details' });
    }
  });
});




// Get student's answers for a game
app.get('/api/games/:gameCode/student/:userId/answers', (req, res) => {
  const { gameCode, userId } = req.params;

  // Get game
  db.get('SELECT * FROM games WHERE game_code = ?', [gameCode], (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Get answers — join with questions so the client can render the FULL
    // question (text + options + which one was correct) alongside what the
    // student picked. This is what powers the Plus-tier "review your game"
    // detail view.
    db.all(
      `SELECT
        ga.id,
        ga.user_id,
        ga.question_id,
        ga.answer,
        ga.is_correct,
        ga.time_taken,
        ga.points_earned,
        ga.answered_at,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        q.answer_type,
        q.image_url
      FROM game_answers ga
      LEFT JOIN questions q ON ga.question_id = q.id
      WHERE ga.game_id = ? AND ga.user_id = ?
      ORDER BY ga.answered_at ASC`,
      [game.id, userId],
      (err, answers) => {
        if (err) return res.status(500).json({ error: err.message });
        // Calculate score and correct count
        const totalScore = (answers || []).reduce((sum, a) => sum + (a.points_earned || 0), 0);
        const correctCount = (answers || []).filter(a => a.is_correct).length;
        res.json({
          game: { game_code: game.game_code, game_mode: game.game_mode, started_at: game.started_at, ended_at: game.ended_at },
          answers: answers || [],
          totalScore,
          correctCount,
        });
      }
    );
  });
});

// AI Game Overview
app.get('/api/games/:gameCode/ai-overview/:userId', async (req, res) => {
  const { gameCode, userId } = req.params;
  try {
    const limit = await checkAiLimit(parseInt(userId), 'study_overview');
    if (!limit.allowed) {
      if (limit.reason === 'upgrade_required') return res.status(403).json({ error: 'upgrade_required', message: 'AI Study Overview requires Blazes Plus', requiredTier: 'blazes_plus' });
      return res.status(429).json({ error: 'daily_limit', message: `AI overview limit reached (${limit.used}/${limit.limit} today). Resets at midnight.`, used: limit.used, limit: limit.limit });
    }
    const game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const answers = await dbAll(
      `SELECT ga.answer, ga.is_correct, ga.time_taken, q.question_text, q.answer_type, q.correct_answer,
              q.option_a, q.option_b, q.option_c, q.option_d
       FROM game_answers ga
       LEFT JOIN questions q ON ga.question_id = q.id
       WHERE ga.game_id = ? AND ga.user_id = ?
       ORDER BY ga.answered_at ASC`,
      [game.id, userId]
    );

    if (!answers || answers.length === 0) return res.json({ overview: 'No answers to analyze.' });
    if (!groq) return res.json({ overview: 'AI not available.' });

    const correct = answers.filter(a => a.is_correct).length;
    const total = answers.length;
    const accuracy = Math.round((correct / total) * 100);

    const summary = answers.map((a, i) => {
      let correctAns = a.correct_answer || '';
      if ((a.answer_type === 'multiple_choice' || a.answer_type === 'audio') && correctAns.match(/^[A-D]$/i)) {
        const idx = 'ABCD'.indexOf(correctAns.toUpperCase());
        correctAns = [a.option_a, a.option_b, a.option_c, a.option_d][idx] || correctAns;
      }
      return `${i + 1}. "${a.question_text}" — Student answered: "${a.answer}" — ${a.is_correct ? 'CORRECT' : `WRONG (correct: ${correctAns})`} — ${a.time_taken ? a.time_taken + 's' : 'N/A'}`;
    }).join('\n');

    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a friendly, encouraging study coach giving a student a quick review of their quiz performance. Be concise and helpful. Use a warm, supportive tone — this is for students aged 10-16.

Format your response exactly like this:
1. Start with a one-line overall verdict (encouraging even if they did poorly)
2. "Strengths:" — 1-2 bullet points on what they did well
3. "To Improve:" — 1-2 bullet points on what to study more, referencing specific topics they got wrong
4. "Quick Tip:" — One actionable study tip based on their mistakes

Keep the entire response under 150 words. No markdown headers, just plain text with the labels above.`
        },
        {
          role: 'user',
          content: `Student scored ${correct}/${total} (${accuracy}%). Here are their answers:\n\n${summary}`
        }
      ],
      temperature: 0.5,
      max_tokens: 400,
    });

    const overview = result.choices[0]?.message?.content?.trim() || 'Could not generate overview.';
    await trackAiUsage(parseInt(userId), 'study_overview');
    res.json({ overview });
  } catch (err) {
    console.error('[AI Overview] Error:', err.message);
    res.json({ overview: 'Could not generate overview right now.' });
  }
});

// ============ BLAZESBUCKS API ============

// Get a student's BlazesBucks balance and recent transactions
app.get('/api/blazesbucks/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId], (err, row) => {
    const balance = row?.balance || 0;
    db.all(
      `SELECT amount, reason, game_code, created_at
       FROM blazes_bucks_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [userId],
      (err2, log) => {
        res.json({ balance, recentLog: log || [] });
      }
    );
  });
});

// Config: tells the client how long one period is (so the timer matches the env var)
app.get('/api/blazesbucks/config', (req, res) => {
  const periodMinutes = parseInt(process.env.PLAYTIME_PERIOD_MINUTES) || 1;
  res.json({ periodSeconds: periodMinutes * 60, periodMinutes });
});

// Claim one period of play-time BB mid-game (called by the client timer)
app.post('/api/blazesbucks/claim-playtime', async (req, res) => {
  const { userId, gameCode } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const PERIOD_SECONDS = (parseInt(process.env.PLAYTIME_PERIOD_MINUTES) || 1) * 60;
  const now = Date.now();
  const last = lastClaimTime[userId] || 0;
  const secondsSinceLast = (now - last) / 1000;

  if (secondsSinceLast < PERIOD_SECONDS * 0.9) {
    // Too soon — duplicate call, ignore it
    console.log(`[BB] Rejected duplicate claim for user ${userId} (${secondsSinceLast.toFixed(1)}s since last claim, period=${PERIOD_SECONDS}s)`);
    db.get('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId], (err, row) => {
      res.json({ bbEarned: 0, balance: row?.balance || 0 });
    });
    return;
  }

  lastClaimTime[userId] = now;
  await awardBB(userId, 100, 'play_time', gameCode || null);

  db.get('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId], (err, row) => {
    const balance = row?.balance || 0;
    console.log(`[BB] Mid-game claim: 100 BB for user ${userId} (new balance: ${balance})`);
    res.json({ bbEarned: 100, balance });
  });
});



// =========== SKINS ===========

// ── Skin probabilities (% chance each skin appears in any given stock rotation)
const SKIN_CHANCES = {
  air:0, fire:0, earth:0, water:0, light:0, ice:0, lightning:0, shadow:0, wood:0, sound:0,
  metal:0, poison:0, crystal:0, plasma:0, gravity:0, mist:0, time:0, storm:0, sand:0, lava:0, spirit:0, tech:0, cosmic:0, nature:0, void:0,
  order:0, astral:0, chaos:0, neon:0, mythic:0, ember:0, wave:0, gale:0, stone:0, vine:0,
  thunder:0, frost:0, quake:0, tempest:0, inferno:0, aurora:0,
  rift:0, nova:0, singularity:0, ethereal:0, chrono:0,
  celestial:0, star:0, apex:0, omega:0, blaze:0
};
// Assign real percentages
Object.assign(SKIN_CHANCES, {
  air:13.5,
  fire:14.0,
  earth:13.0,
  water:13.5,
  light:12.5,
  ice:12.0,
  lightning:14.5,
  shadow:12.0,
  wood:11.5,
  sound:11.0,
  metal:9.5,
  poison:8.5,
  crystal:8.0,
  plasma:8.0,
  gravity:7.5,
  mist:7.5,
  time:7.0,
  storm:7.5,
  sand:7.0,
  lava:7.0,
  spirit:6.8,
  tech:6.8,
  cosmic:6.5,
  nature:6.5,
  void:6.3,
  order:6.0,
  astral:5.9,
  chaos:5.8,
  neon:5.8,
  mythic:5.7,
  ember:5.7,
  wave:5.6,
  gale:5.6,
  stone:5.5,
  vine:5.5,
  thunder:3.3,
  frost:3.2,
  quake:3.2,
  tempest:3.1,
  inferno:3.0,
  aurora:3.0,
  rift:2.9,
  nova:2.9,
  singularity:2.8,
  ethereal:2.8,
  chrono:2.7,
  celestial:1.6,
  star:1.3,
  apex:1.0,
  omega:0.9,
  blaze:0.1
});

function getNextRotationTime() {
  const now = new Date();
  const slots = [0, 3, 6, 9, 12, 15, 18, 21]; // 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm
  const currentHour = now.getHours();
  const nextSlot = slots.find(h => h > currentHour) ?? slots[0]; // wrap to midnight
  const next = new Date(now);
  next.setHours(nextSlot, 0, 0, 0);
  if (nextSlot <= currentHour) next.setDate(next.getDate() + 1); // next day midnight
  return next;
}

function generateNewStock() {
  const expiresAt = getNextRotationTime().toISOString();
  // Each skin rolls its own % chance independently; guarantee at least 6 skins
  let inStock = Object.entries(SKIN_CHANCES)
    .filter(([, chance]) => Math.random() * 100 < chance)
    .map(([id]) => id);
  // If too few, top up with a random weighted pick from remaining
  if (inStock.length < 6) {
    const notIn = Object.entries(SKIN_CHANCES)
      .filter(([id]) => !inStock.includes(id))
      .sort(() => Math.random() - 0.5);
    inStock = [...inStock, ...notIn.slice(0, 6 - inStock.length).map(([id]) => id)];
  }
  const skinIds = JSON.stringify(inStock);
  db.run('DELETE FROM skin_stock'); // only ever keep one row
  db.run('INSERT INTO skin_stock (skin_ids, expires_at) VALUES (?, ?)', [skinIds, expiresAt]);
  return { skinIds: inStock, expiresAt };
}


// Force-refresh stock (for dev/testing)
app.post('/api/skins/stock/refresh', (req, res) => {
  db.run('DELETE FROM skin_stock', [], () => {
    const fresh = generateNewStock();
    res.json({ skinIds: fresh.skinIds, expiresAt: fresh.expiresAt });
  });
});

// GET current stock
app.get('/api/skins/stock', (req, res) => {
  db.get('SELECT skin_ids, expires_at FROM skin_stock ORDER BY id DESC LIMIT 1', [], (err, row) => {
    const now = Date.now();
    if (row && new Date(row.expires_at).getTime() > now) {
      return res.json({ skinIds: JSON.parse(row.skin_ids), expiresAt: row.expires_at });
    }
    // Generate fresh stock
    const fresh = generateNewStock();
    res.json({ skinIds: fresh.skinIds, expiresAt: fresh.expiresAt });
  });
});



// Get user's owned skins and equipped selection
app.get('/api/skins/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const owned = await new Promise(resolve =>
    db.all('SELECT skin_id, skin_type, COUNT(*) as count FROM user_skins WHERE user_id = ? GROUP BY skin_id, skin_type', [userId], (_, rows) => resolve(rows || []))
  );
  let equipped = await new Promise(resolve =>
    db.get('SELECT avatar_skin, bar_skin FROM user_equipped WHERE user_id = ?', [userId], (_, row) => resolve(row))
  );

  // Auto-assign a random basic skin if user has no equipped row or still has 'default'
  if (!equipped || equipped.avatar_skin === 'default') {
    const skin = randomBasicSkin();
    await new Promise(resolve =>
      db.run(`INSERT INTO user_equipped (user_id, avatar_skin) VALUES (?, ?)
              ON CONFLICT(user_id) DO UPDATE SET avatar_skin = ?, updated_at = CURRENT_TIMESTAMP`,
        [userId, skin, skin], resolve)
    );
    equipped = { avatar_skin: skin, bar_skin: equipped?.bar_skin || 'default' };
  }

  const userTier = await dbGet('SELECT subscription_tier FROM users WHERE id=?', [userId]);
  res.json({ owned, equipped, tier: userTier?.subscription_tier || 'free' });
});

// Purchase a skin (deduct BB)
app.post('/api/skins/purchase', async (req, res) => {
  const { userId, skinId, skinType = 'avatar', cost } = req.body;
  if (!userId || !skinId || !cost) return res.status(400).json({ error: 'Missing fields' });

  // Check balance
  const bbRow = await new Promise(resolve =>
    db.get('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId], (_, r) => resolve(r))
  );
  const balance = bbRow?.balance || 0;
  if (balance < cost) return res.status(400).json({ error: 'Insufficient BlazesBucks' });

  // Compute current stock rotation ID (3-hour windows)
  const now = Date.now();
  const rotationId = Math.floor(now / (3 * 60 * 60 * 1000)).toString();

  // Check if already bought this skin in this rotation
  const boughtThisRotation = await new Promise(resolve =>
    db.get('SELECT id FROM user_skins WHERE user_id = ? AND skin_id = ? AND stock_rotation = ?', [userId, skinId, rotationId], (_, r) => resolve(r))
  );
  if (boughtThisRotation) return res.status(400).json({ error: 'Already purchased this rotation. Wait for the shop to reset.' });

  // Deduct BB and record purchase
  await new Promise(resolve =>
    db.run('UPDATE blazes_bucks SET balance = balance - ? WHERE user_id = ?', [cost, userId], resolve)
  );
  await new Promise(resolve =>
    db.run('INSERT INTO blazes_bucks_log (user_id, amount, reason) VALUES (?, ?, ?)', [userId, -cost, 'skin_purchase_' + skinId], resolve)
  );
  await new Promise(resolve =>
    db.run('INSERT INTO user_skins (user_id, skin_id, skin_type, stock_rotation) VALUES (?, ?, ?, ?)', [userId, skinId, skinType, rotationId], resolve)
  );

  const newBalance = balance - cost;
  console.log(`[Skins] User ${userId} purchased ${skinId} for ${cost} BB (balance: ${newBalance})`);
  res.json({ success: true, balance: newBalance });
});

// Equip a skin
app.post('/api/skins/equip', async (req, res) => {
  const { userId, skinId, skinType = 'avatar' } = req.body;
  if (!userId || !skinId) return res.status(400).json({ error: 'Missing fields' });

  const col = skinType === 'bar' ? 'bar_skin' : 'avatar_skin';
  await new Promise(resolve =>
    db.run(`INSERT INTO user_equipped (user_id, ${col}) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET ${col} = ?, updated_at = CURRENT_TIMESTAMP`,
      [userId, skinId, skinId], resolve)
  );
  res.json({ success: true });
});

// =========== ACHIEVEMENTS ===========

const ACHIEVEMENTS = [
  // Existing
  { id: 'first_steps',           bb: 20,  name: 'First Steps' },
  { id: 'getting_the_hang',      bb: 30,  name: 'Getting the Hang of It' },
  { id: 'practice_progress',     bb: 40,  name: 'Practice Makes Progress' },
  { id: 'century_club',          bb: 60,  name: 'Century Club' },
  { id: 'accuracy_apprentice',   bb: 40,  name: 'Accuracy Apprentice' },
  { id: 'sharpshooter',          bb: 80,  name: 'Sharpshooter' },
  { id: 'perfect_session',       bb: 100, name: 'Perfect Session' },
  { id: 'lightning_brain',       bb: 30,  name: 'Lightning Brain' },
  { id: 'focused_mind',          bb: 40,  name: 'Focused Mind' },
  { id: 'daily_grinder',         bb: 40,  name: 'Daily Grinder' },
  { id: 'weekly_warrior',        bb: 70,  name: 'Weekly Warrior' },
  { id: 'comeback_learner',      bb: 50,  name: 'Comeback Learner' },
  { id: 'subject_explorer',      bb: 30,  name: 'Subject Explorer' },
  { id: 'subject_specialist',    bb: 60,  name: 'Subject Specialist' },
  { id: 'marathon_session',      bb: 70,  name: 'Marathon Session' },
  { id: 'error_analyst',         bb: 40,  name: 'Error Analyst' },
  { id: 'steady_climber',        bb: 60,  name: 'Steady Climber' },
  { id: 'xp_collector',          bb: 50,  name: 'XP Collector' },
  { id: 'teachers_favorite',     bb: 80,  name: "Teacher's Favorite" },
  { id: 'master_learner',        bb: 150, name: 'Master Learner' },
  // Getting Started
  { id: 'welcome_aboard',        bb: 20,  name: 'Welcome Aboard' },
  { id: 'mode_hopper',           bb: 50,  name: 'Mode Hopper' },
  { id: 'dressed_up',            bb: 30,  name: 'Dressed Up' },
  { id: 'collector',             bb: 60,  name: 'Collector' },
  { id: 'wardrobe',              bb: 100, name: 'Wardrobe' },
  // Answer Milestones
  { id: 'club_250',              bb: 40,  name: '250 Club' },
  { id: 'club_500',              bb: 60,  name: '500 Club' },
  { id: 'club_1000',             bb: 100, name: 'Thousand' },
  { id: 'club_5000',             bb: 150, name: '5K' },
  { id: 'club_10000',            bb: 300, name: '10K' },
  // Streaks
  { id: 'warm_up',               bb: 10,  name: 'Warm Up' },
  { id: 'on_fire',               bb: 40,  name: 'On Fire' },
  { id: 'unstoppable',           bb: 80,  name: 'Unstoppable' },
  { id: 'inhuman',               bb: 150, name: 'Inhuman' },
  // Accuracy
  { id: 'sharp',                 bb: 20,  name: 'Sharp' },
  { id: 'sniper',                bb: 40,  name: 'Sniper' },
  { id: 'consistent',            bb: 60,  name: 'Consistent' },
  { id: 'never_wrong',           bb: 100, name: 'Never Wrong' },
  // Wins
  { id: 'first_win',             bb: 30,  name: 'First Win' },
  { id: 'triple_crown',          bb: 50,  name: 'Triple Crown' },
  { id: 'champion',              bb: 80,  name: 'Champion' },
  { id: 'dominant',              bb: 120, name: 'Dominant' },
  { id: 'legend',                bb: 200, name: 'Legend' },
  // Survival
  { id: 'survivor',              bb: 30,  name: 'Survivor' },
  { id: 'clutch',                bb: 50,  name: 'Clutch' },
  { id: 'untouchable',           bb: 80,  name: 'Untouchable' },
  { id: 'sudden_death_victor',   bb: 60,  name: 'Sudden Death Victor' },
  { id: 'tiebreaker_champion',   bb: 80,  name: 'Tiebreaker Champion' },
  { id: 'endurance',             bb: 40,  name: 'Endurance' },
  { id: 'iron_will',             bb: 70,  name: 'Iron Will' },
  // Inferno Tower
  { id: 'floor_10',              bb: 10,  name: 'Floor 10' },
  { id: 'floor_25',              bb: 20,  name: 'Floor 25' },
  { id: 'floor_50',              bb: 40,  name: 'Floor 50' },
  { id: 'floor_100',             bb: 80,  name: 'Floor 100' },
  { id: 'skyscraper',            bb: 150, name: 'Skyscraper' },
  { id: 'tower_master',          bb: 30,  name: 'Tower Master' },
  { id: 'ghost_hunter',          bb: 20,  name: 'Ghost Hunter' },
  { id: 'phantom',               bb: 50,  name: 'Phantom' },
  { id: 'fire_walker',           bb: 40,  name: 'Fire Walker' },
  // Elemental Clash
  { id: 'team_player',           bb: 30,  name: 'Team Player' },
  { id: 'artillery',             bb: 20,  name: 'Artillery' },
  { id: 'bombardment',           bb: 50,  name: 'Bombardment' },
  { id: 'full_arsenal',          bb: 40,  name: 'Full Arsenal' },
  { id: 'energy_hoarder',        bb: 30,  name: 'Energy Hoarder' },
  { id: 'clash_mvp',             bb: 60,  name: 'Clash MVP' },
  // Risk & Reward
  { id: 'tier_2',                bb: 10,  name: 'Tier 2' },
  { id: 'tier_3',                bb: 30,  name: 'Tier 3' },
  { id: 'tier_4',                bb: 100, name: 'Tier 4' },
  { id: 'high_roller',           bb: 20,  name: 'High Roller' },
  { id: 'jackpot',               bb: 50,  name: 'Jackpot' },
  { id: 'fortune',               bb: 100, name: 'Fortune' },
  { id: 'all_in',                bb: 80,  name: 'All In' },
  { id: 'burned',                bb: 10,  name: 'Burned' },
  // BlazesBucks
  { id: 'first_hundred',         bb: 10,  name: 'First Hundred' },
  { id: 'thousand_club',         bb: 30,  name: 'Thousand Club' },
  { id: 'five_grand',            bb: 60,  name: 'Five Grand' },
  { id: 'baller',                bb: 100, name: 'Baller' },
  { id: 'rich',                  bb: 200, name: 'Rich' },
  // Daily Streaks
  { id: 'two_weeks',             bb: 80,  name: 'Two Weeks' },
  { id: 'one_month',             bb: 150, name: 'One Month' },
  { id: 'semester',              bb: 300, name: 'Semester' },
  // Games Played
  { id: 'regular',               bb: 20,  name: 'Regular' },
  { id: 'dedicated',             bb: 40,  name: 'Dedicated' },
  { id: 'veteran',               bb: 60,  name: 'Veteran' },
  { id: 'addict',                bb: 100, name: 'Addict' },
  { id: 'no_life',               bb: 200, name: 'No Life' },
  // Speed
  { id: 'quick_thinker',         bb: 20,  name: 'Quick Thinker' },
  { id: 'lightning_fast',        bb: 50,  name: 'Lightning' },
  // Master
  { id: 'half_way',              bb: 100, name: 'Half Way' },
  { id: 'completionist',         bb: 200, name: 'Completionist' },
  { id: 'blazes_master',         bb: 500, name: 'Blazes Master' },
  // Season Levels
  { id: 'level_5',               bb: 30,  name: 'Getting Started' },
  { id: 'level_10',              bb: 50,  name: 'Bronze Player' },
  { id: 'level_15',              bb: 60,  name: 'Warming Up' },
  { id: 'level_20',              bb: 70,  name: 'Dedicated Learner' },
  { id: 'level_25',              bb: 80,  name: 'Silver Player' },
  { id: 'level_30',              bb: 100, name: 'Committed' },
  { id: 'level_40',              bb: 120, name: 'Powerhouse' },
  { id: 'level_50',              bb: 150, name: 'Gold Player' },
  { id: 'level_60',              bb: 200, name: 'Elite' },
  { id: 'level_75',              bb: 300, name: 'Diamond Player' },
  { id: 'level_85',              bb: 400, name: 'Mythic' },
  { id: 'level_100',             bb: 1000, name: 'Godlike' },
];

// Get all unlocked achievements for a user
app.get('/api/achievements/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  db.all('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ unlocked: rows || [] });
  });
});

// Increment review counter for Error Analyst
app.post('/api/achievements/review/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  await new Promise(resolve =>
    db.run(`INSERT INTO review_events (user_id, review_count) VALUES (?, 1)
            ON CONFLICT(user_id) DO UPDATE SET review_count = review_count + 1`, [userId], resolve)
  );
  const row = await new Promise(resolve =>
    db.get('SELECT review_count FROM review_events WHERE user_id = ?', [userId], (_, r) => resolve(r))
  );
  res.json({ reviewCount: row?.review_count || 0 });
});

// Check and award newly unlocked achievements
app.post('/api/achievements/check/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const q = (sql, params = []) => new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  );
  const qAll = (sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
  );

  try {
    // Already unlocked
    const unlocked = new Set((await qAll('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId])).map(r => r.achievement_id));

    // --- Gather stats ---
    const totalAnswers = (await q('SELECT COUNT(*) as c FROM game_answers WHERE user_id = ?', [userId]))?.c || 0;
    const correctAnswers = (await q('SELECT COUNT(*) as c FROM game_answers WHERE user_id = ? AND is_correct = 1', [userId]))?.c || 0;
    const accuracy = totalAnswers >= 10 ? correctAnswers / totalAnswers : 0;
    const totalXP = (await q('SELECT SUM(points_earned) as s FROM game_answers WHERE user_id = ?', [userId]))?.s || 0;

    // Lightning Brain: any correct answer in ≤ 3 seconds
    const lightning = await q('SELECT id FROM game_answers WHERE user_id = ? AND is_correct = 1 AND time_taken <= 3 LIMIT 1', [userId]);

    // Focused Mind: any game with ≥ 15 answers
    const focusedRow = await q('SELECT game_id, COUNT(*) as c FROM game_answers WHERE user_id = ? GROUP BY game_id HAVING c >= 15 LIMIT 1', [userId]);

    // Marathon: any game with ≥ 40 answers
    const marathonRow = await q('SELECT game_id, COUNT(*) as c FROM game_answers WHERE user_id = ? GROUP BY game_id HAVING c >= 40 LIMIT 1', [userId]);

    // Perfect session: within any game, find streak of 10 consecutive correct answers
    let perfectSession = false;
    const gameIds = (await qAll('SELECT DISTINCT game_id FROM game_answers WHERE user_id = ?', [userId])).map(r => r.game_id);
    for (const gid of gameIds) {
      const answers = await qAll('SELECT is_correct FROM game_answers WHERE user_id = ? AND game_id = ? ORDER BY id ASC', [userId, gid]);
      let streak = 0;
      for (const a of answers) {
        streak = a.is_correct ? streak + 1 : 0;
        if (streak >= 10) { perfectSession = true; break; }
      }
      if (perfectSession) break;
    }

    // Comeback Learner: miss 3 in a row, then get next 5 right
    let comebackLearner = false;
    for (const gid of gameIds) {
      const answers = await qAll('SELECT is_correct FROM game_answers WHERE user_id = ? AND game_id = ? ORDER BY id ASC', [userId, gid]);
      let missStreak = 0, hitStreak = 0, inComeback = false;
      for (const a of answers) {
        if (!inComeback) {
          if (!a.is_correct) { missStreak++; if (missStreak >= 3) inComeback = true; }
          else missStreak = 0;
        } else {
          if (a.is_correct) { hitStreak++; if (hitStreak >= 5) { comebackLearner = true; break; } }
          else { hitStreak = 0; missStreak = 1; inComeback = false; }
        }
      }
      if (comebackLearner) break;
    }

    // Play dates for streaks
    const playDates = (await qAll(
      `SELECT DISTINCT date(answered_at) as d FROM game_answers WHERE user_id = ? ORDER BY d ASC`, [userId]
    )).map(r => r.d);
    const distinctDates7 = playDates.filter(d => {
      const dt = new Date(d + 'T00:00:00Z');
      return (Date.now() - dt.getTime()) <= 7 * 24 * 3600 * 1000;
    });
    const dailyGrinder = distinctDates7.length >= 3;
    // Weekly warrior: 7 consecutive distinct play dates
    let weeklyWarrior = false;
    for (let i = 6; i < playDates.length; i++) {
      const span = (new Date(playDates[i] + 'T00:00:00Z') - new Date(playDates[i-6] + 'T00:00:00Z')) / 86400000;
      if (span === 6) { weeklyWarrior = true; break; }
    }

    // Subject Explorer: at least 3 distinct subjects answered
    const subjects = await qAll(
      `SELECT DISTINCT qk.subject FROM game_answers ga
       JOIN questions q ON ga.question_id = q.id
       JOIN question_kits qk ON q.kit_id = qk.id
       WHERE ga.user_id = ? AND qk.subject IS NOT NULL AND qk.subject != ''`, [userId]
    );
    const subjectExplorer = subjects.length >= 3;

    // Subject Specialist: 80% accuracy in a single subject with >= 10 answers
    let subjectSpecialist = false;
    const subjectStats = await qAll(
      `SELECT qk.subject, COUNT(*) as total, SUM(ga.is_correct) as correct
       FROM game_answers ga
       JOIN questions q ON ga.question_id = q.id
       JOIN question_kits qk ON q.kit_id = qk.id
       WHERE ga.user_id = ?
       GROUP BY qk.subject`, [userId]
    );
    for (const s of subjectStats) {
      if (s.total >= 10 && (s.correct / s.total) >= 0.8) { subjectSpecialist = true; break; }
    }

    // Steady Climber: accuracy improved by 10pp vs last week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const lastWeek = await q(`SELECT COUNT(*) as t, SUM(is_correct) as c FROM game_answers WHERE user_id = ? AND date(answered_at) >= ?`, [userId, oneWeekAgo]);
    const prevWeek = await q(`SELECT COUNT(*) as t, SUM(is_correct) as c FROM game_answers WHERE user_id = ? AND date(answered_at) >= ? AND date(answered_at) < ?`, [userId, twoWeeksAgo, oneWeekAgo]);
    const lastAcc = lastWeek?.t >= 5 ? (lastWeek.c / lastWeek.t) : null;
    const prevAcc = prevWeek?.t >= 5 ? (prevWeek.c / prevWeek.t) : null;
    const steadyClimber = lastAcc !== null && prevAcc !== null && (lastAcc - prevAcc) >= 0.10;

    // Teacher's Favorite: completed 5 games
    const gamesCompleted = (await q('SELECT COUNT(DISTINCT game_id) as c FROM game_answers WHERE user_id = ?', [userId]))?.c || 0;
    const teachersFavorite = gamesCompleted >= 5;

    // Error Analyst
    const reviewRow = await q('SELECT review_count FROM review_events WHERE user_id = ?', [userId]);
    const errorAnalyst = (reviewRow?.review_count || 0) >= 20;

    // --- Additional stats for new achievements ---
    // Games played (3+ min duration)
    const gamesPlayed3min = (await q(
      `SELECT COUNT(DISTINCT g.id) as c FROM games g
       JOIN game_participants gp ON g.id = gp.game_id
       WHERE gp.user_id = ? AND g.started_at IS NOT NULL
       AND (julianday(COALESCE(g.ended_at, datetime('now'))) - julianday(g.started_at)) * 86400 >= 180`, [userId]
    ))?.c || 0;

    // Multiplayer games (5+ players)
    const multiplayerGames = await qAll(
      `SELECT g.id, g.game_mode, g.sudden_death,
              (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id) as pcount
       FROM games g JOIN game_participants gp ON g.id = gp.game_id
       WHERE gp.user_id = ? AND g.status = 'ended'`, [userId]
    );
    const multiGames5 = multiplayerGames.filter(g => g.pcount >= 5);
    const joinedMulti = multiplayerGames.some(g => g.pcount >= 5);

    // Wins in multiplayer (5+ players) — check if user is top scorer
    let multiWins = 0;
    for (const g of multiGames5) {
      const top = await q('SELECT user_id FROM game_participants WHERE game_id = ? ORDER BY score DESC LIMIT 1', [g.id]);
      if (top?.user_id === userId) multiWins++;
    }

    // Distinct game modes played
    const modesPlayed = (await qAll(
      `SELECT DISTINCT g.game_mode FROM games g JOIN game_participants gp ON g.id = gp.game_id WHERE gp.user_id = ?`, [userId]
    )).length;

    // Skins owned
    const skinsOwned = (await q('SELECT COUNT(*) as c FROM user_skins WHERE user_id = ?', [userId]))?.c || 0;

    // Max streak across all games
    let maxStreak = 0;
    for (const gid of gameIds) {
      const answers = await qAll('SELECT is_correct FROM game_answers WHERE user_id = ? AND game_id = ? ORDER BY id ASC', [userId, gid]);
      let s = 0;
      for (const a of answers) { s = a.is_correct ? s + 1 : 0; if (s > maxStreak) maxStreak = s; }
    }

    // Games with 90%+ and 100% accuracy (10+ questions)
    let games90 = 0, games100 = 0, consecutive90 = 0, maxConsecutive90 = 0;
    for (const gid of gameIds) {
      const ga = await q('SELECT COUNT(*) as t, SUM(is_correct) as c FROM game_answers WHERE user_id = ? AND game_id = ?', [userId, gid]);
      if (ga.t >= 10) {
        const acc = ga.c / ga.t;
        if (acc >= 0.9) { games90++; consecutive90++; if (consecutive90 > maxConsecutive90) maxConsecutive90 = consecutive90; }
        else { consecutive90 = 0; }
        if (acc >= 1.0) games100++;
      }
    }

    // Survival stats
    let survivalWins = 0, clutchWin = false, untouchableWin = false, suddenDeathWin = false, tiebreakerWin = false;
    let maxRoundsSurvived = 0;
    const survivalGames = multiplayerGames.filter(g => g.game_mode === 'survival' && g.pcount >= 5);
    for (const g of survivalGames) {
      const myP = await q('SELECT eliminated, lives, eliminated_at_round FROM game_participants WHERE game_id = ? AND user_id = ?', [g.id, userId]);
      const settings = await q('SELECT settings, rounds_played, sudden_death FROM games WHERE id = ?', [g.id]);
      const s = typeof settings?.settings === 'string' ? JSON.parse(settings.settings) : (settings?.settings || {});
      if (!myP?.eliminated) {
        survivalWins++;
        if (myP.lives === 1) clutchWin = true;
        if (myP.lives === (s.livesPerPlayer || 3)) untouchableWin = true;
        if (settings?.sudden_death === 1) suddenDeathWin = true;
        if (settings?.sudden_death === 2) tiebreakerWin = true;
      }
      const rounds = myP?.eliminated ? (myP.eliminated_at_round || 0) : (settings?.rounds_played || 0);
      if (rounds > maxRoundsSurvived) maxRoundsSurvived = rounds;
    }

    // Inferno Tower stats
    let maxFloor = 0, towerWins = 0, totalFireballs = 0;
    const towerGames = multiplayerGames.filter(g => g.game_mode === 'inferno_tower');
    for (const g of towerGames) {
      const myP = await q('SELECT tower_floor, is_ghost FROM game_participants WHERE game_id = ? AND user_id = ?', [g.id, userId]);
      if (myP?.tower_floor > maxFloor) maxFloor = myP.tower_floor;
      if (!myP?.is_ghost && g.pcount >= 2) towerWins++;
    }
    totalFireballs = (await q('SELECT COUNT(*) as c FROM inferno_fireballs WHERE attacker_user_id = ?', [userId]))?.c || 0;

    // Elemental Clash stats
    let clashWins = 0, maxAttacksInGame = 0, maxEnergyEver = 0, usedAllAttackTypes = false, clashMvp = false;
    const clashGames = multiplayerGames.filter(g => g.game_mode === 'elemental_clash');
    for (const g of clashGames) {
      const myP = await q('SELECT team, score FROM game_participants WHERE game_id = ? AND user_id = ?', [g.id, userId]);
      const scores = await q('SELECT team_1_score, team_2_score FROM games WHERE id = ?', [g.id]);
      if (myP && scores) {
        const myTeamScore = myP.team === 1 ? scores.team_1_score : scores.team_2_score;
        const enemyScore = myP.team === 1 ? scores.team_2_score : scores.team_1_score;
        if (myTeamScore > enemyScore) {
          clashWins++;
          const teamTop = await q('SELECT user_id FROM game_participants WHERE game_id = ? AND team = ? ORDER BY score DESC LIMIT 1', [g.id, myP.team]);
          if (teamTop?.user_id === userId) clashMvp = true;
        }
      }
      const attacks = await qAll('SELECT attack_type FROM elemental_attacks WHERE game_id = ? AND attacker_user_id = ?', [g.id, userId]);
      if (attacks.length > maxAttacksInGame) maxAttacksInGame = attacks.length;
      const types = new Set(attacks.map(a => a.attack_type));
      if (types.size >= 4) usedAllAttackTypes = true;
    }
    const maxEnergyRow = await q('SELECT MAX(energy_points) as m FROM game_participants WHERE user_id = ?', [userId]);
    maxEnergyEver = maxEnergyRow?.m || 0;

    // Risk & Reward stats (tracked via wager_streak and score)
    const wagerGames = multiplayerGames.filter(g => g.game_mode === 'elemental_wager');
    let maxWagerStreak = 0, maxWagerScore = 0;
    for (const g of wagerGames) {
      const myP = await q('SELECT score, wager_streak FROM game_participants WHERE game_id = ? AND user_id = ?', [g.id, userId]);
      if (myP?.score > maxWagerScore) maxWagerScore = myP.score;
      if (myP?.wager_streak > maxWagerStreak) maxWagerStreak = myP.wager_streak;
    }
    // Also check all games for max streak (wager streak is separate from answer streak)
    // For tier tracking: tier = min(4, 1 + floor(streak / 10))

    // BB total earned
    const totalBBEarned = (await q('SELECT SUM(amount) as s FROM blazes_bucks_log WHERE user_id = ? AND amount > 0', [userId]))?.s || 0;

    // Daily streak
    const bbStreak = await q('SELECT current_streak FROM blazes_bucks WHERE user_id = ?', [userId]);
    const currentDayStreak = bbStreak?.current_streak || 0;

    // Speed
    const quickThinker = await q('SELECT id FROM game_answers WHERE user_id = ? AND is_correct = 1 AND time_taken <= 2 AND time_taken > 0 LIMIT 1', [userId]);
    const lightningFast = await q('SELECT id FROM game_answers WHERE user_id = ? AND is_correct = 1 AND time_taken <= 1 AND time_taken > 0 LIMIT 1', [userId]);

    // Season level
    const seasonLevel = (await q('SELECT level FROM season_progress sp JOIN seasons s ON sp.season_id = s.id WHERE sp.user_id = ? ORDER BY s.season_number DESC LIMIT 1', [userId]))?.level || 0;

    // --- Determine newly unlocked ---
    const conditions = {
      // Existing
      first_steps:         totalAnswers >= 1,
      getting_the_hang:    totalAnswers >= 10,
      practice_progress:   totalAnswers >= 50,
      century_club:        totalAnswers >= 100,
      accuracy_apprentice: totalAnswers >= 10 && accuracy >= 0.6,
      sharpshooter:        totalAnswers >= 20 && accuracy >= 0.8,
      perfect_session:     perfectSession,
      lightning_brain:     !!lightning,
      focused_mind:        !!focusedRow,
      daily_grinder:       dailyGrinder,
      weekly_warrior:      weeklyWarrior,
      comeback_learner:    comebackLearner,
      subject_explorer:    subjectExplorer,
      subject_specialist:  subjectSpecialist,
      marathon_session:    !!marathonRow,
      error_analyst:       errorAnalyst,
      steady_climber:      steadyClimber,
      xp_collector:        totalXP >= 1000,
      teachers_favorite:   teachersFavorite,
      // Getting Started
      welcome_aboard:      joinedMulti,
      mode_hopper:         modesPlayed >= 4,
      dressed_up:          skinsOwned >= 1,
      collector:           skinsOwned >= 10,
      wardrobe:            skinsOwned >= 25,
      // Answer Milestones
      club_250:            correctAnswers >= 250,
      club_500:            correctAnswers >= 500,
      club_1000:           correctAnswers >= 1000,
      club_5000:           correctAnswers >= 5000,
      club_10000:          correctAnswers >= 10000,
      // Streaks
      warm_up:             maxStreak >= 5,
      on_fire:             maxStreak >= 20,
      unstoppable:         maxStreak >= 30,
      inhuman:             maxStreak >= 50,
      // Accuracy
      sharp:               games90 >= 1,
      sniper:              games100 >= 1,
      consistent:          maxConsecutive90 >= 3,
      never_wrong:         games100 >= 5,
      // Wins
      first_win:           multiWins >= 1,
      triple_crown:        multiWins >= 3,
      champion:            multiWins >= 10,
      dominant:            multiWins >= 25,
      legend:              multiWins >= 50,
      // Survival
      survivor:            survivalWins >= 1,
      clutch:              clutchWin,
      untouchable:         untouchableWin,
      sudden_death_victor: suddenDeathWin,
      tiebreaker_champion: tiebreakerWin,
      endurance:           maxRoundsSurvived >= 15,
      iron_will:           maxRoundsSurvived >= 25,
      // Inferno Tower
      floor_10:            maxFloor >= 10,
      floor_25:            maxFloor >= 25,
      floor_50:            maxFloor >= 50,
      floor_100:           maxFloor >= 100,
      skyscraper:          maxFloor >= 200,
      tower_master:        towerWins >= 1,
      ghost_hunter:        totalFireballs >= 5,
      phantom:             totalFireballs >= 20,
      fire_walker:         false, // TODO: tracked in-game
      // Elemental Clash
      team_player:         clashWins >= 1,
      artillery:           maxAttacksInGame >= 5,
      bombardment:         maxAttacksInGame >= 10,
      full_arsenal:        usedAllAttackTypes,
      energy_hoarder:      maxEnergyEver >= 20,
      clash_mvp:           clashMvp,
      // Risk & Reward
      tier_2:              maxWagerStreak >= 10,
      tier_3:              maxWagerStreak >= 20,
      tier_4:              maxWagerStreak >= 30,
      high_roller:         maxWagerScore >= 500,
      jackpot:             maxWagerScore >= 1000,
      fortune:             maxWagerScore >= 2500,
      all_in:              false, // TODO: tracked in-game
      burned:              false, // TODO: tracked in-game
      // BlazesBucks
      first_hundred:       totalBBEarned >= 100,
      thousand_club:       totalBBEarned >= 1000,
      five_grand:          totalBBEarned >= 5000,
      baller:              totalBBEarned >= 10000,
      rich:                totalBBEarned >= 50000,
      // Daily Streaks
      two_weeks:           currentDayStreak >= 14,
      one_month:           currentDayStreak >= 30,
      semester:            currentDayStreak >= 90,
      // Games Played
      regular:             gamesPlayed3min >= 10,
      dedicated:           gamesPlayed3min >= 25,
      veteran:             gamesPlayed3min >= 50,
      addict:              gamesPlayed3min >= 100,
      no_life:             gamesPlayed3min >= 250,
      // Speed
      quick_thinker:       !!quickThinker,
      lightning_fast:      !!lightningFast,
      // Season Levels
      level_5:             seasonLevel >= 5,
      level_10:            seasonLevel >= 10,
      level_15:            seasonLevel >= 15,
      level_20:            seasonLevel >= 20,
      level_25:            seasonLevel >= 25,
      level_30:            seasonLevel >= 30,
      level_40:            seasonLevel >= 40,
      level_50:            seasonLevel >= 50,
      level_60:            seasonLevel >= 60,
      level_75:            seasonLevel >= 75,
      level_85:            seasonLevel >= 85,
      level_100:           seasonLevel >= 100,
    };

    // Master achievements: count how many are unlocked
    const currentlyUnlocked = Object.keys(conditions).filter(k => conditions[k] || unlocked.has(k));
    conditions.master_learner = currentlyUnlocked.length >= 10;
    conditions.half_way = currentlyUnlocked.length >= 25;
    conditions.completionist = currentlyUnlocked.length >= 50;
    conditions.blazes_master = currentlyUnlocked.length >= 75;

    // Award newly unlocked
    const newlyUnlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (!unlocked.has(ach.id) && conditions[ach.id]) {
        await new Promise(resolve =>
          db.run('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', [userId, ach.id], resolve)
        );
        await awardBB(userId, ach.bb, 'achievement_' + ach.id, null);
        newlyUnlocked.push({ id: ach.id, name: ach.name, bb: ach.bb });
        // Send notification for achievement
        if (await shouldNotify(userId, 'achievement')) {
          await dbRun('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [userId, 'achievement', 'Achievement Unlocked!', `"${ach.name}" — +${ach.bb} BlazesBucks`]);
        }
        console.log('[Achievement] Unlocked', ach.id, 'for user', userId, '(+' + ach.bb + ' BB)');
      }
    }

    res.json({ newlyUnlocked });
  } catch (err) {
    console.error('[Achievement] check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Contact form ────────────────────────────────────────────────────────────
// Start an assignment game (student self-start, creates + joins + starts in one call)
app.post('/api/assignments/:assignmentId/play', async (req, res) => {
  const { studentId } = req.body;
  try {
    const assignment = await dbGet(
      `SELECT a.*, qk.title as kit_title FROM assignments a JOIN question_kits qk ON a.kit_id = qk.id WHERE a.id = ?`,
      [req.params.assignmentId]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    // Verify student is in the classroom
    const enrolled = await dbGet('SELECT id FROM classroom_students WHERE classroom_id = ? AND student_id = ?',
      [assignment.classroom_id, studentId]);
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this classroom' });

    // Check if there's already an in-progress game for this assignment
    const existingGame = await dbGet(
      'SELECT game_code FROM games WHERE assignment_id = ? AND host_id = ? AND status = ?',
      [assignment.id, studentId, 'started']);
    
    if (existingGame) {
      // Resume existing game
      return res.json({ gameCode: existingGame.game_code });
    }

    // Create new game with no time limit for assignments
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const settings = JSON.stringify({
      gameName: assignment.title,
      pointsPerCorrectAnswer: 10,
      endless: false,
    });

    // Create game
    const gameId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO games (host_id, kit_id, game_code, game_mode, status, settings, started_at, assignment_id) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
        [studentId, assignment.kit_id, gameCode, 'classic_timed', 'started', settings, assignment.id],
        function(err) { err ? reject(err) : resolve(this.lastID); });
    });

    // Add student as participant
    await dbRun('INSERT INTO game_participants (game_id, user_id, player_name) VALUES (?, ?, ?)',
      [gameId, studentId, (await dbGet('SELECT name FROM users WHERE id = ?', [studentId]))?.name || 'Student']);

    // Ensure submission record exists and update to in_progress
    await dbRun('INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id, status) VALUES (?, ?, ?)',
      [assignment.id, studentId, 'pending']);
    await dbRun('UPDATE assignment_submissions SET status = ? WHERE assignment_id = ? AND student_id = ?',
      ['in_progress', assignment.id, studentId]);

    res.json({ gameCode, gameId });
  } catch (err) {
    console.error('[assignment play]', err);
    res.status(500).json({ error: err.message });
  }
});

// =========== CLASSROOMS ===========
// Helper: check if a teacher owns or co-teaches a classroom
async function teacherHasClassroom(teacherId, classroomId) {
  const owned = await dbGet('SELECT id FROM classrooms WHERE id=? AND teacher_id=?', [classroomId, teacherId]);
  if (owned) return 'owner';
  const coTeach = await dbGet('SELECT id FROM classroom_teachers WHERE classroom_id=? AND teacher_id=?', [classroomId, teacherId]);
  return coTeach ? 'co-teacher' : null;
}

// Helper: get all classroom IDs a teacher has access to (owner + co-teacher)
async function getTeacherClassroomIds(teacherId) {
  const owned = await dbAll('SELECT id FROM classrooms WHERE teacher_id=?', [teacherId]);
  const coTeaching = await dbAll('SELECT classroom_id as id FROM classroom_teachers WHERE teacher_id=?', [teacherId]);
  return [...new Set([...(owned || []).map(c => c.id), ...(coTeaching || []).map(c => c.id)])];
}

app.post('/api/classrooms', async (req, res) => {
  const { teacherId, name, subject, gradeLevel, imageUrl } = req.body;
  if (!teacherId || !name) return res.status(400).json({ error: 'Teacher ID and name required' });
  try {
    const id = await new Promise((resolve, reject) => {
      db.run('INSERT INTO classrooms (teacher_id, name, subject, grade_level, image_url) VALUES (?, ?, ?, ?, ?)',
        [teacherId, name, subject || '', gradeLevel || '', imageUrl || null], function(err) { err ? reject(err) : resolve(this.lastID); });
    });
    res.json({ id, message: 'Classroom created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/classrooms/teacher/:teacherId', async (req, res) => {
  try {
    const tid = req.params.teacherId;
    const classrooms = await dbAll(
      `SELECT c.*,
        COUNT(cs.student_id) as student_count,
        CASE WHEN c.teacher_id = ? THEN 'owner' ELSE 'co-teacher' END as my_role,
        (SELECT u.name FROM users u WHERE u.id = c.teacher_id) as owner_name
       FROM classrooms c
       LEFT JOIN classroom_students cs ON c.id = cs.classroom_id
       WHERE c.teacher_id = ? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id = ?)
       GROUP BY c.id ORDER BY c.created_at DESC`, [tid, tid, tid]);
    res.json(classrooms || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all assignments across a teacher's classrooms
app.get('/api/assignments/teacher/:teacherId', async (req, res) => {
  try {
    const assignments = await dbAll(
      `SELECT a.*, c.name as classroom_name, qk.title as kit_title,
              (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'completed') as completed_count,
              (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_count
       FROM assignments a
       JOIN classrooms c ON a.classroom_id = c.id
       LEFT JOIN question_kits qk ON a.kit_id = qk.id
       WHERE c.teacher_id = ? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id = ?)
       ORDER BY a.created_at DESC`, [req.params.teacherId, req.params.teacherId]);
    res.json(assignments || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/classrooms/student/:studentId', async (req, res) => {
  try {
    const classrooms = await dbAll(
      `SELECT c.*, u.name as teacher_name, COUNT(cs2.student_id) as student_count
       FROM classroom_students cs
       JOIN classrooms c ON cs.classroom_id = c.id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN classroom_students cs2 ON c.id = cs2.classroom_id
       WHERE cs.student_id = ? GROUP BY c.id ORDER BY c.created_at DESC`, [req.params.studentId]);
    res.json(classrooms || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/classrooms/:classroomId', async (req, res) => {
  try {
    const classroom = await dbGet('SELECT * FROM classrooms WHERE id = ?', [req.params.classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    const students = await dbAll(
      `SELECT u.id, u.name, u.email, cs.joined_at, cs.status FROM classroom_students cs
       JOIN users u ON cs.student_id = u.id WHERE cs.classroom_id = ? ORDER BY u.name`, [req.params.classroomId]);
    res.json({ ...classroom, students: students || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/classrooms/:classroomId/students', async (req, res) => {
  const { emails } = req.body; // array of email strings
  if (!emails?.length) return res.status(400).json({ error: 'Emails required' });
  try {
    const classroom = await dbGet('SELECT id, teacher_id FROM classrooms WHERE id = ?', [req.params.classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    // Teacher Pro gate: free teachers limited to 35 students per classroom
    if (classroom.teacher_id) {
      const teacherTier = await getUserTier(classroom.teacher_id);
      if (!['teacher_pro', 'school'].includes(teacherTier)) {
        const studentCount = await dbGet('SELECT COUNT(*) as c FROM classroom_students WHERE classroom_id = ?', [req.params.classroomId]);
        if ((studentCount?.c || 0) >= 35) {
          return res.status(403).json({ error: 'upgrade_required', message: 'Free classrooms are limited to 35 students. Upgrade to Teacher Pro for unlimited.', requiredTier: 'teacher_pro' });
        }
      }
    }
    let added = 0, notFound = [];
    for (const email of emails) {
      const user = await dbGet('SELECT id FROM users WHERE email = ? AND role = ?', [email.trim().toLowerCase(), 'student']);
      if (!user) { notFound.push(email.trim()); continue; }
      try {
        const inserted = await dbRun('INSERT OR IGNORE INTO classroom_students (classroom_id, student_id, status) VALUES (?, ?, ?)', [classroom.id, user.id, 'pending']);
        if (inserted) {
          added++;
          // Notify student with invite
          const classroomInfo = await dbGet('SELECT name FROM classrooms WHERE id = ?', [classroom.id]);
          const teacherInfo = await dbGet('SELECT u.name FROM classrooms c JOIN users u ON c.teacher_id = u.id WHERE c.id = ?', [classroom.id]);
          if (await shouldNotify(user.id, 'classroom_invite')) {
            await dbRun('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
              [user.id, 'classroom_invite', 'Classroom Invitation', `${teacherInfo?.name || 'Your teacher'} invited you to "${classroomInfo?.name || 'a classroom'}"`, `classroom_invite:${classroom.id}`]);
          }
          // Create submissions for existing assignments
          const assignments = await dbAll('SELECT id FROM assignments WHERE classroom_id = ?', [classroom.id]);
          for (const a of assignments) {
            await dbRun('INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id) VALUES (?, ?)', [a.id, user.id]);
          }
        }
      } catch (_) { }
    }
    res.json({ added, notFound });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update classroom (image, name, etc)
app.put('/api/classrooms/:classroomId', async (req, res) => {
  const { name, subject, gradeLevel, imageUrl } = req.body;
  try {
    await dbRun('UPDATE classrooms SET name = COALESCE(?, name), subject = COALESCE(?, subject), grade_level = COALESCE(?, grade_level), image_url = ? WHERE id = ?',
      [name, subject, gradeLevel, imageUrl || null, req.params.classroomId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Co-teacher management ──
// Add co-teacher to classroom
app.post('/api/classrooms/:classroomId/co-teachers', async (req, res) => {
  const { email, teacherId } = req.body;
  const classroomId = req.params.classroomId;
  try {
    // Only the owner can add co-teachers
    const classroom = await dbGet('SELECT * FROM classrooms WHERE id=?', [classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom.teacher_id !== parseInt(teacherId)) return res.status(403).json({ error: 'Only the classroom owner can add co-teachers' });

    const coTeacher = await dbGet('SELECT id, name, role FROM users WHERE email=?', [email]);
    if (!coTeacher) return res.status(404).json({ error: 'No user found with that email' });
    if (coTeacher.role !== 'teacher') return res.status(400).json({ error: 'That user is not a teacher' });
    if (coTeacher.id === classroom.teacher_id) return res.status(400).json({ error: 'That teacher already owns this classroom' });

    const existing = await dbGet('SELECT id FROM classroom_teachers WHERE classroom_id=? AND teacher_id=?', [classroomId, coTeacher.id]);
    if (existing) return res.status(400).json({ error: 'Already a co-teacher' });

    await dbRun('INSERT INTO classroom_teachers (classroom_id, teacher_id, role) VALUES (?, ?, ?)', [classroomId, coTeacher.id, 'co-teacher']);

    // Notify the co-teacher
    if (await shouldNotify(coTeacher.id, 'classroom_invite')) {
      await dbRun('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [coTeacher.id, 'co_teacher_added', 'Co-Teacher Invite', `You've been added as a co-teacher to "${classroom.name}"`]);
    }

    res.json({ success: true, coTeacherId: coTeacher.id, coTeacherName: coTeacher.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get co-teachers for a classroom
app.get('/api/classrooms/:classroomId/co-teachers', async (req, res) => {
  try {
    const coTeachers = await dbAll(
      `SELECT u.id, u.name, u.email, ct.role, ct.added_at
       FROM classroom_teachers ct JOIN users u ON ct.teacher_id = u.id
       WHERE ct.classroom_id = ? ORDER BY ct.added_at`, [req.params.classroomId]);
    res.json(coTeachers || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remove co-teacher
app.delete('/api/classrooms/:classroomId/co-teachers/:coTeacherId', async (req, res) => {
  const { classroomId, coTeacherId } = req.params;
  const { teacherId } = req.body;
  try {
    const classroom = await dbGet('SELECT teacher_id FROM classrooms WHERE id=?', [classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    // Only owner or the co-teacher themselves can remove
    if (classroom.teacher_id !== parseInt(teacherId) && parseInt(coTeacherId) !== parseInt(teacherId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await dbRun('DELETE FROM classroom_teachers WHERE classroom_id=? AND teacher_id=?', [classroomId, coTeacherId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Accept classroom invite
app.post('/api/classrooms/:classroomId/accept', async (req, res) => {
  const { studentId } = req.body;
  try {
    await dbRun('UPDATE classroom_students SET status = ?, joined_at = CURRENT_TIMESTAMP WHERE classroom_id = ? AND student_id = ?',
      ['accepted', req.params.classroomId, studentId]);
    // Notify teacher
    const classroom = await dbGet('SELECT teacher_id, name FROM classrooms WHERE id = ?', [req.params.classroomId]);
    const student = await dbGet('SELECT name FROM users WHERE id = ?', [studentId]);
    if (classroom) {
      if (await shouldNotify(classroom.teacher_id, 'student_joined')) {
        await dbRun('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
          [classroom.teacher_id, 'student_joined', 'Student Joined', `${student?.name || 'A student'} accepted the invite to "${classroom.name}"`]);
      }
    }
    // Create submissions for existing assignments
    const assignments = await dbAll('SELECT id FROM assignments WHERE classroom_id = ?', [req.params.classroomId]);
    for (const a of assignments) {
      await dbRun('INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id) VALUES (?, ?)', [a.id, studentId]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Decline classroom invite
app.post('/api/classrooms/:classroomId/decline', async (req, res) => {
  const { studentId } = req.body;
  try {
    await dbRun('DELETE FROM classroom_students WHERE classroom_id = ? AND student_id = ?', [req.params.classroomId, studentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/classrooms/:classroomId/students/:studentId', async (req, res) => {
  try {
    await dbRun('DELETE FROM classroom_students WHERE classroom_id = ? AND student_id = ?', [req.params.classroomId, req.params.studentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/classrooms/:classroomId', async (req, res) => {
  try {
    await dbRun('DELETE FROM classroom_students WHERE classroom_id = ?', [req.params.classroomId]);
    await dbRun('DELETE FROM assignment_submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE classroom_id = ?)', [req.params.classroomId]);
    await dbRun('DELETE FROM assignments WHERE classroom_id = ?', [req.params.classroomId]);
    await dbRun('DELETE FROM classrooms WHERE id = ?', [req.params.classroomId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Teacher reset student password
app.post('/api/classrooms/:classroomId/students/:studentId/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const classroom = await dbGet('SELECT teacher_id FROM classrooms WHERE id = ?', [req.params.classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    const enrolled = await dbGet('SELECT id FROM classroom_students WHERE classroom_id = ? AND student_id = ?', [req.params.classroomId, req.params.studentId]);
    if (!enrolled) return res.status(403).json({ error: 'Student not in this classroom' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, req.params.studentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== ASSIGNMENTS ===========
app.post('/api/classrooms/:classroomId/assignments', async (req, res) => {
  const { kitId, title, instructions, dueDate, dueTime, requirements } = req.body;
  if (!kitId || !title) return res.status(400).json({ error: 'Kit and title required' });
  if (!requirements?.min_questions) return res.status(400).json({ error: 'Min questions required' });
  try {
    const classroom = await dbGet('SELECT * FROM classrooms WHERE id = ?', [req.params.classroomId]);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    const id = await new Promise((resolve, reject) => {
      db.run('INSERT INTO assignments (classroom_id, kit_id, game_mode, title, instructions, due_date, due_time, requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.params.classroomId, kitId, 'classic_timed', title, instructions || '', dueDate || null, dueTime || null, JSON.stringify(requirements || {})],
        function(err) { err ? reject(err) : resolve(this.lastID); });
    });
    // Create submissions for all students
    const students = await dbAll('SELECT student_id FROM classroom_students WHERE classroom_id = ?', [req.params.classroomId]);
    for (const s of students) {
      await dbRun('INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id) VALUES (?, ?)', [id, s.student_id]);
      // Notify student
      if (await shouldNotify(s.student_id, 'new_assignment')) {
        await dbRun('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
          [s.student_id, 'new_assignment', 'New Assignment', `"${title}" in ${classroom.name}`, `/classroom/${req.params.classroomId}`]);
      }
    }
    res.json({ id, message: 'Assignment created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/classrooms/:classroomId/assignments', async (req, res) => {
  try {
    const assignments = await dbAll(
      `SELECT a.*, qk.title as kit_title, qk.subject as kit_subject,
              (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'completed') as completed_count,
              (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_count
       FROM assignments a LEFT JOIN question_kits qk ON a.kit_id = qk.id
       WHERE a.classroom_id = ? ORDER BY a.created_at DESC`, [req.params.classroomId]);
    res.json(assignments || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/assignments/:assignmentId', async (req, res) => {
  try {
    const assignment = await dbGet(
      `SELECT a.*, qk.title as kit_title, qk.subject as kit_subject, c.name as classroom_name
       FROM assignments a LEFT JOIN question_kits qk ON a.kit_id = qk.id
       LEFT JOIN classrooms c ON a.classroom_id = c.id WHERE a.id = ?`, [req.params.assignmentId]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const submissions = await dbAll(
      `SELECT s.*, u.name, u.email FROM assignment_submissions s
       JOIN users u ON s.student_id = u.id WHERE s.assignment_id = ? ORDER BY u.name`, [req.params.assignmentId]);
    if (assignment.requirements) assignment.requirements = JSON.parse(assignment.requirements);
    res.json({ ...assignment, submissions: submissions || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/assignments/student/:studentId', async (req, res) => {
  try {
    const assignments = await dbAll(
      `SELECT a.*, s.status, s.questions_answered, s.correct_answers, s.score, s.completed_at,
              qk.title as kit_title, qk.subject as kit_subject, c.name as classroom_name, c.id as classroom_id,
              COALESCE((SELECT COUNT(DISTINCT question_id) FROM game_answers WHERE game_id IN (SELECT id FROM games WHERE assignment_id = a.id AND host_id = s.student_id AND status = 'started')), s.questions_answered) as live_questions_answered
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       LEFT JOIN question_kits qk ON a.kit_id = qk.id
       LEFT JOIN classrooms c ON a.classroom_id = c.id
       WHERE s.student_id = ? ORDER BY a.due_date ASC`, [req.params.studentId]);
    for (const a of assignments) { 
      if (a.requirements) a.requirements = JSON.parse(a.requirements);
      // Use live progress for in-progress assignments
      if (a.status === 'in_progress' && a.live_questions_answered) {
        a.questions_answered = a.live_questions_answered;
      }
    }
    res.json(assignments || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/assignments/:assignmentId/submit', async (req, res) => {
  const { studentId, questionsAnswered, correctAnswers, score } = req.body;
  try {
    const assignment = await dbGet('SELECT * FROM assignments WHERE id = ?', [req.params.assignmentId]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const reqs = typeof assignment.requirements === 'string' ? JSON.parse(assignment.requirements) : (assignment.requirements || {});
    const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;
    // Check requirements
    let completed = true;
    if (reqs.min_questions && questionsAnswered < reqs.min_questions) completed = false;
    if (reqs.min_accuracy && accuracy < reqs.min_accuracy) completed = false;
    const status = completed ? 'completed' : 'in_progress';
    
    // Ensure submission record exists
    await dbRun(
      `INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id, status) VALUES (?, ?, 'pending')`,
      [req.params.assignmentId, studentId]);
    
    // Get existing values to compare and keep max
    const existing = await dbGet(
      `SELECT questions_answered, correct_answers, score FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
      [req.params.assignmentId, studentId]);
    const newQA = Math.max(existing?.questions_answered || 0, questionsAnswered || 0);
    const newCA = Math.max(existing?.correct_answers || 0, correctAnswers || 0);
    const newScore = Math.max(existing?.score || 0, score || 0);
    await dbRun(
      `UPDATE assignment_submissions SET status = ?, questions_answered = ?, correct_answers = ?, score = ?, completed_at = ?
       WHERE assignment_id = ? AND student_id = ?`,
      [status, newQA, newCA, newScore, completed ? new Date().toISOString() : null, req.params.assignmentId, studentId]);
    // Notify teacher if completed
    if (completed) {
      const classroom = await dbGet('SELECT teacher_id, name FROM classrooms WHERE id = ?', [assignment.classroom_id]);
      const student = await dbGet('SELECT name FROM users WHERE id = ?', [studentId]);
      if (classroom) {
        if (await shouldNotify(classroom.teacher_id, 'student_completed')) {
          await dbRun('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [classroom.teacher_id, 'student_completed', 'Assignment Completed', `${student?.name || 'Student'} completed "${assignment.title}" in ${classroom.name}`]);
        }
      }
    }
    res.json({ success: true, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/assignments/:assignmentId', async (req, res) => {
  try {
    await dbRun('DELETE FROM assignment_submissions WHERE assignment_id = ?', [req.params.assignmentId]);
    await dbRun('DELETE FROM assignments WHERE id = ?', [req.params.assignmentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== ANALYTICS ===========

// Teacher Analytics
// Subject → Category mapping
const SUBJECT_CATEGORIES = {};
const catMap = {
  'Math': ['Math','Algebra 1','Algebra 2','Geometry','Trigonometry','Pre-Calculus','Calculus','AP Calculus AB','AP Calculus BC','Statistics','AP Statistics','Probability','Arithmetic','Number Theory','Linear Algebra','Discrete Math','Multivariable Calculus'],
  'Science': ['Science','Biology','AP Biology','Chemistry','AP Chemistry','Honors Chemistry','Organic Chemistry','Physics','AP Physics 1','AP Physics 2','AP Physics C','Honors Physics','Earth Science','Environmental Science','AP Environmental Science','Anatomy','Physiology','Human Biology','Astronomy','Geology','Ecology','Genetics','Microbiology','Zoology','Botany','Marine Biology','Forensic Science','Meteorology','Oceanography','Paleontology'],
  'English': ['English','English 1','English 2','English 3','English 4','AP English Language','AP English Literature','Literature','American Literature','British Literature','World Literature','Grammar','Writing','Creative Writing','Reading','Reading Comprehension','Vocabulary','Spelling','Phonics','Poetry','Journalism','Public Speaking','Debate','Speech','Communications'],
  'History': ['History','World History','US History','AP US History','AP World History','AP European History','European History','Ancient History','Medieval History','Modern History','American Government','AP Government','Civics','Political Science','Economics','AP Economics','Geography','AP Human Geography','Civil War','American Revolution','Cold War','World War I','World War II'],
  'Languages': ['Spanish 1','Spanish 2','Spanish 3','AP Spanish','Spanish','French 1','French 2','French 3','AP French','French','German','AP German','Mandarin','Chinese','Japanese','Korean','Italian','Portuguese','Latin','Arabic','Russian','Hindi','ESL','ELL'],
  'Arts': ['Art','Studio Art','AP Studio Art','Drawing','Painting','Sculpture','Ceramics','Photography','Digital Art','Graphic Design','Animation','Film Studies','Music','Music Theory','AP Music Theory','Band','Orchestra','Choir','Theater','Drama','Dance','Art History','AP Art History'],
  'Computer Science': ['Computer Science','AP Computer Science A','AP Computer Science Principles','Programming','Web Development','App Development','Python','Java','JavaScript','C++','HTML/CSS','SQL','Cybersecurity','Robotics','AI','Data Science','Game Design','Game Development'],
  'Other': [],
};
Object.entries(catMap).forEach(([cat, subjects]) => { subjects.forEach(s => { SUBJECT_CATEGORIES[s.toLowerCase()] = cat; }); });
function getSubjectCategory(subject) {
  if (!subject) return 'Other';
  return SUBJECT_CATEGORIES[subject.toLowerCase()] || SUBJECT_CATEGORIES[subject.toLowerCase().split(' ')[0]] || 'Other';
}

app.get('/api/analytics/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Get all classroom student IDs first — most other queries depend on the studentIds list.
    const classroomStudents = await dbAll(`
      SELECT DISTINCT cs.student_id, u.name, u.email, c.name AS classroom_name, c.id AS classroom_id
      FROM classroom_students cs
      JOIN classrooms c ON cs.classroom_id = c.id
      JOIN users u ON cs.student_id = u.id
      WHERE c.teacher_id = ? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id = ?)
    `, [teacherId, teacherId]);
    const studentIds = classroomStudents.map(s => s.student_id);
    const hasStudents = studentIds.length > 0;
    const studentIdList = hasStudents ? studentIds.join(',') : '0';
    const placeholders = hasStudents ? studentIds.map(() => '?').join(',') : '';
    const teacherScope = `(g.host_id=${parseInt(teacherId)} OR g.kit_id IN (SELECT k.id FROM question_kits k WHERE k.teacher_id=${parseInt(teacherId)}))`;

    // Run every independent query in parallel — drops wall time from sum-of-queries to slowest-query.
    const [
      studentsRaw,
      assignmentStats,
      classPerformance,
      subjectPerf,
      questionTypePerf,
      hardestQuestions,
      kitPerf,
      assignmentPerf,
      recentGames,
      assignmentDeadlines,
      questionDifficultyMap,
      classProgressTimeline,
    ] = await Promise.all([
      hasStudents ? dbAll(`
        SELECT
          u.id, u.name, u.email, u.subscription_tier,
          COUNT(ga.id) AS total_questions,
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers,
          CASE WHEN COUNT(ga.id) > 0
            THEN ROUND(SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(ga.id), 1)
            ELSE 0 END AS accuracy,
          COUNT(DISTINCT ga.game_id) AS games_played,
          COALESCE(ROUND(AVG(CASE WHEN ga.time_taken > 0 THEN ga.time_taken END), 1), 0) AS avg_speed,
          MAX(ga.answered_at) AS last_active
        FROM users u
        LEFT JOIN game_answers ga ON ga.user_id = u.id
          AND ga.game_id IN (SELECT g.id FROM games g WHERE g.host_id = ? OR g.kit_id IN (SELECT k.id FROM question_kits k WHERE k.teacher_id = ?))
        WHERE u.id IN (${placeholders})
        GROUP BY u.id
        ORDER BY u.name ASC
      `, [teacherId, teacherId, ...studentIds]) : Promise.resolve([]),

      hasStudents ? dbAll(`
        SELECT asub.student_id,
          COUNT(*) AS total_assignments,
          SUM(CASE WHEN asub.status = 'completed' THEN 1 ELSE 0 END) AS completed_assignments
        FROM assignment_submissions asub
        JOIN assignments a ON asub.assignment_id = a.id
        JOIN classrooms c ON a.classroom_id = c.id
        WHERE (c.teacher_id = ? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id = ?)) AND asub.student_id IN (${placeholders})
        GROUP BY asub.student_id
      `, [teacherId, teacherId, ...studentIds]) : Promise.resolve([]),

      dbAll(`
        SELECT
          c.id AS classroom_id,
          c.name AS classroom_name,
          COUNT(DISTINCT cs.student_id) AS student_count,
          COUNT(DISTINCT a.id) AS assignment_count
        FROM classrooms c
        LEFT JOIN classroom_students cs ON cs.classroom_id = c.id
        LEFT JOIN assignments a ON a.classroom_id = c.id
        WHERE c.teacher_id = ? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id = ?)
        GROUP BY c.id
      `, [teacherId, teacherId]),

      dbAll(`
        SELECT qk.subject, COUNT(ga.id) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time, COUNT(DISTINCT ga.user_id) as unique_students
        FROM game_answers ga JOIN games g ON ga.game_id=g.id JOIN question_kits qk ON g.kit_id=qk.id
        WHERE ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY qk.subject ORDER BY total DESC
      `, []),

      dbAll(`
        SELECT q.answer_type, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id
        WHERE ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY q.answer_type ORDER BY total DESC
      `, []),

      dbAll(`
        SELECT q.id as question_id, k.id as kit_id, q.question_text, q.answer_type, k.title as kit_name,
          COUNT(*) as times_answered, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id
        LEFT JOIN question_kits k ON q.kit_id=k.id
        WHERE ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY ga.question_id HAVING times_answered>=3
        ORDER BY CAST(correct AS FLOAT)/times_answered ASC LIMIT 15
      `, []),

      dbAll(`
        SELECT k.id as kit_id, k.title, k.subject, COUNT(DISTINCT gp.user_id) as unique_players,
          COUNT(DISTINCT gp.game_id) as times_played, AVG(gp.score) as avg_score,
          (SELECT COUNT(*) FROM game_answers ga2 JOIN games g2 ON ga2.game_id=g2.id WHERE g2.kit_id=k.id AND ga2.user_id IN (${studentIdList})) as q_total,
          (SELECT SUM(CASE WHEN ga3.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga3 JOIN games g3 ON ga3.game_id=g3.id WHERE g3.kit_id=k.id AND ga3.user_id IN (${studentIdList})) as q_correct
        FROM game_participants gp JOIN games g ON gp.game_id=g.id JOIN question_kits k ON g.kit_id=k.id
        WHERE ${teacherScope} AND gp.user_id IN (${studentIdList})
        GROUP BY k.id ORDER BY times_played DESC LIMIT 30
      `, []),

      dbAll(`
        SELECT a.title, c.name as classroom, a.due_date,
          COUNT(asub.id) as total_students,
          SUM(CASE WHEN asub.status='completed' THEN 1 ELSE 0 END) as completed,
          AVG(CASE WHEN asub.status='completed' THEN asub.score END) as avg_score,
          AVG(CASE WHEN asub.status='completed' AND asub.questions_answered>0 THEN CAST(asub.correct_answers AS FLOAT)/asub.questions_answered*100 END) as avg_accuracy
        FROM assignments a JOIN classrooms c ON a.classroom_id=c.id
        LEFT JOIN assignment_submissions asub ON asub.assignment_id=a.id
        WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?))
        GROUP BY a.id ORDER BY a.due_date DESC LIMIT 20
      `, [teacherId, teacherId]),

      // Recent games — only include games where at least one answer was
      // submitted. A teacher who clicked Start but no students answered
      // anything is noise, not a "recent game" worth showing.
      // game_name is pulled out of the settings JSON (every setup page writes
      // settings.gameName) so the teacher can tell two same-kit games apart.
      dbAll(`
        SELECT g.game_code, g.game_mode, g.created_at, k.title as kit,
          json_extract(g.settings, '$.gameName') as game_name,
          (SELECT COUNT(*) FROM game_participants gp WHERE gp.game_id=g.id) as players,
          (SELECT AVG(gp2.score) FROM game_participants gp2 WHERE gp2.game_id=g.id) as avg_score,
          (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.is_correct=1) as correct,
          (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.game_id=g.id) as total
        FROM games g LEFT JOIN question_kits k ON g.kit_id=k.id
        WHERE g.host_id=?
          AND EXISTS (SELECT 1 FROM game_answers gax WHERE gax.game_id=g.id)
        ORDER BY g.created_at DESC LIMIT 10
      `, [teacherId]),

      dbAll(`
        SELECT a.id, a.title, a.due_date, a.due_time, c.name as classroom,
          (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.assignment_id=a.id) as total_students,
          (SELECT COUNT(*) FROM assignment_submissions asub2 WHERE asub2.assignment_id=a.id AND asub2.status='completed') as completed,
          (SELECT COUNT(*) FROM assignment_submissions asub3 WHERE asub3.assignment_id=a.id AND asub3.status='pending') as not_started,
          (SELECT COUNT(*) FROM assignment_submissions asub4 WHERE asub4.assignment_id=a.id AND asub4.status='in_progress') as in_progress
        FROM assignments a JOIN classrooms c ON a.classroom_id=c.id
        WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) AND (a.due_date >= date('now') OR a.due_date IS NULL)
        ORDER BY a.due_date ASC, a.due_time ASC LIMIT 15
      `, [teacherId, teacherId]),

      dbAll(`
        SELECT q.id as question_id, k.id as kit_id, q.question_text, q.answer_type, k.title as kit_name, k.subject,
          COUNT(*) as times_answered,
          SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
          COUNT(DISTINCT ga.user_id) as unique_students,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id
        LEFT JOIN question_kits k ON q.kit_id=k.id
        WHERE ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY ga.question_id HAVING times_answered>=5
        ORDER BY CAST(correct AS FLOAT)/times_answered ASC LIMIT 20
      `, []),

      dbAll(`
        SELECT strftime('%Y-W%W', ga.answered_at) as week,
          MIN(DATE(ga.answered_at)) as week_start,
          COUNT(*) as questions,
          SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
          COUNT(DISTINCT ga.user_id) as active_students,
          COUNT(DISTINCT ga.game_id) as games,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga JOIN games g ON ga.game_id=g.id
        WHERE ${teacherScope} AND ga.user_id IN (${studentIdList})
          AND ga.answered_at >= datetime('now', '-16 weeks')
        GROUP BY week ORDER BY week ASC
      `, []),
    ]);

    // --- Stitch per-student data: classrooms + assignment counts ---
    const studentClassMap = {};
    classroomStudents.forEach(cs => {
      if (!studentClassMap[cs.student_id]) studentClassMap[cs.student_id] = [];
      if (!studentClassMap[cs.student_id].includes(cs.classroom_name)) {
        studentClassMap[cs.student_id].push(cs.classroom_name);
      }
    });
    const assignMap = {};
    (assignmentStats || []).forEach(a => { assignMap[a.student_id] = a; });
    const students = (studentsRaw || []).map(s => ({
      ...s,
      classrooms: studentClassMap[s.id] || [],
      total_assignments: assignMap[s.id]?.total_assignments || 0,
      completed_assignments: assignMap[s.id]?.completed_assignments || 0,
    }));

    // --- Accuracy distribution ---
    const buckets = [
      { range: '0-20', min: 0, max: 20 },
      { range: '20-40', min: 20, max: 40 },
      { range: '40-60', min: 40, max: 60 },
      { range: '60-80', min: 60, max: 80 },
      { range: '80-100', min: 80, max: 101 }
    ];
    const accuracyDistribution = buckets.map(b => ({
      range: b.range,
      count: students.filter(s => s.accuracy >= b.min && s.accuracy < b.max && s.total_questions > 0).length
    }));

    const totalQuestionsAnswered = students.reduce((sum, s) => sum + s.total_questions, 0);
    const totalCorrect = students.reduce((sum, s) => sum + s.correct_answers, 0);
    const overallAvgAccuracy = totalQuestionsAnswered > 0 ? Math.round(totalCorrect * 100.0 / totalQuestionsAnswered * 10) / 10 : 0;

    // --- Category breakdown derived from subject performance ---
    const subjectWithCategories = (subjectPerf || []).map(s => ({
      ...s, category: getSubjectCategory(s.subject),
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
    }));
    const categoryPerf = {};
    subjectWithCategories.forEach(s => {
      if (!categoryPerf[s.category]) categoryPerf[s.category] = { category: s.category, total: 0, correct: 0, subjects: [] };
      categoryPerf[s.category].total += s.total;
      categoryPerf[s.category].correct += s.correct;
      categoryPerf[s.category].subjects.push(s);
    });
    const categoryBreakdown = Object.values(categoryPerf).map(c => ({
      category: c.category, total: c.total, correct: c.correct,
      accuracy: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
      subjectCount: c.subjects.length, subjects: c.subjects,
    })).sort((a, b) => b.total - a.total);

    const needsAttention = students.filter(s =>
      (s.total_questions >= 10 && s.accuracy < 50) ||
      (!s.last_active || new Date(s.last_active) < new Date(Date.now() - 7 * 86400000))
    ).map(s => ({
      ...s,
      reason: !s.last_active ? 'Never played' :
        new Date(s.last_active) < new Date(Date.now() - 14 * 86400000) ? 'Inactive 14+ days' :
        new Date(s.last_active) < new Date(Date.now() - 7 * 86400000) ? 'Inactive 7+ days' :
        s.accuracy < 30 ? 'Very low accuracy' : 'Below 50% accuracy'
    }));

    const topPerformers = [...students].filter(s => s.total_questions >= 5).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);

    res.json({
      students,
      classPerformance,
      accuracyDistribution,
      totalQuestionsAnswered,
      overallAvgAccuracy,
      categoryBreakdown,
      questionTypePerf,
      hardestQuestions,
      kitPerf,
      assignmentPerf,
      needsAttention,
      topPerformers,
      recentGames,
      assignmentDeadlines,
      questionDifficultyMap,
      classProgressTimeline,
    });
  } catch (err) {
    console.error('Teacher analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher analytics' });
  }
});

// Pro-tier deep drill-down on any analytics card. Single endpoint, four shapes
// based on `type`:
//   question      → per-student attempts on one question (who got it, what
//                   they answered, time taken)
//   kit           → every game played with this kit + per-question accuracy
//                   inside the kit
//   student       → student profile: all games they played for this teacher
//                   plus their weakest questions
//   question_type → all questions of this answer_type, hardest first
//
// We always scope by the teacher's students so a teacher can't accidentally
// peek at another teacher's data even with a guessed id.
app.get('/api/analytics/teacher/:teacherId/detail', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { type, id } = req.query;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });

    // Resolve the set of students this teacher can see (their classroom roster +
    // any students who've played in games they hosted). The drill-downs union-
    // filter on this set so we never leak data across teachers.
    const studentIds = await dbAll(`
      SELECT DISTINCT student_id AS id FROM classroom_students cs
        JOIN classrooms c ON c.id = cs.classroom_id
        WHERE c.teacher_id = ? AND cs.status = 'accepted'
      UNION
      SELECT DISTINCT gp.user_id AS id FROM game_participants gp
        JOIN games g ON g.id = gp.game_id
        WHERE g.host_id = ?
    `, [teacherId, teacherId]);
    const idSet = (studentIds || []).map(r => r.id).filter(Number.isFinite);
    if (idSet.length === 0) return res.json({ type, attempts: [], rows: [] });
    const studentIdList = idSet.join(',') || '0';
    const teacherScope = `(g.host_id = ${parseInt(teacherId, 10)} OR g.kit_id IN (SELECT id FROM question_kits WHERE teacher_id = ${parseInt(teacherId, 10)}))`;

    if (type === 'question') {
      const qid = parseInt(id, 10);
      const question = await dbGet(`SELECT q.*, k.title as kit_title, k.subject FROM questions q LEFT JOIN question_kits k ON q.kit_id = k.id WHERE q.id = ?`, [qid]);
      if (!question) return res.status(404).json({ error: 'Question not found' });
      const attempts = await dbAll(`
        SELECT ga.user_id, ga.answer, ga.is_correct, ga.time_taken, ga.points_earned, ga.answered_at,
          u.name as student_name, g.game_code, g.game_mode, g.created_at as game_at
        FROM game_answers ga
        JOIN users u ON u.id = ga.user_id
        JOIN games g ON g.id = ga.game_id
        WHERE ga.question_id = ? AND ${teacherScope} AND ga.user_id IN (${studentIdList})
        ORDER BY ga.answered_at DESC LIMIT 500
      `, [qid]);
      return res.json({ type, question, attempts });
    }

    if (type === 'kit') {
      const kid = parseInt(id, 10);
      const kit = await dbGet(`SELECT id, title, subject, grade_level FROM question_kits WHERE id = ?`, [kid]);
      if (!kit) return res.status(404).json({ error: 'Kit not found' });
      const games = await dbAll(`
        SELECT g.id, g.game_code, g.game_mode, g.created_at, g.status,
          (SELECT COUNT(*) FROM game_participants gp WHERE gp.game_id = g.id) as players,
          (SELECT AVG(gp2.score) FROM game_participants gp2 WHERE gp2.game_id = g.id) as avg_score,
          (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id = g.id AND ga.is_correct = 1) as correct,
          (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.game_id = g.id) as total
        FROM games g WHERE g.kit_id = ? AND g.host_id = ?
        ORDER BY g.created_at DESC LIMIT 50
      `, [kid, teacherId]);
      const perQuestion = await dbAll(`
        SELECT q.id, q.question_text, q.answer_type,
          COUNT(*) as times_answered,
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga
        JOIN questions q ON q.id = ga.question_id
        JOIN games g ON g.id = ga.game_id
        WHERE q.kit_id = ? AND ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY ga.question_id
        ORDER BY CAST(correct AS FLOAT)/times_answered ASC LIMIT 100
      `, [kid]);
      const topPlayers = await dbAll(`
        SELECT u.id, u.name,
          COUNT(*) as total, SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga
        JOIN games g ON g.id = ga.game_id
        JOIN users u ON u.id = ga.user_id
        WHERE g.kit_id = ? AND ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY ga.user_id ORDER BY (CAST(correct AS FLOAT)/total) DESC LIMIT 25
      `, [kid]);
      return res.json({ type, kit, games, perQuestion, topPlayers });
    }

    if (type === 'student') {
      const sid = parseInt(id, 10);
      if (!idSet.includes(sid)) return res.status(403).json({ error: 'Student not in your roster' });
      const student = await dbGet(`SELECT id, name, email, subscription_tier FROM users WHERE id = ?`, [sid]);
      const games = await dbAll(`
        SELECT g.game_code, g.game_mode, g.created_at, k.title as kit_title, gp.score,
          (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id = g.id AND ga.user_id = ?) as total,
          (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.game_id = g.id AND ga2.user_id = ? AND ga2.is_correct = 1) as correct,
          (SELECT AVG(ga3.time_taken) FROM game_answers ga3 WHERE ga3.game_id = g.id AND ga3.user_id = ?) as avg_time
        FROM game_participants gp
        JOIN games g ON g.id = gp.game_id
        LEFT JOIN question_kits k ON k.id = g.kit_id
        WHERE gp.user_id = ? AND ${teacherScope}
        ORDER BY g.created_at DESC LIMIT 50
      `, [sid, sid, sid, sid]);
      const weakest = await dbAll(`
        SELECT q.id, q.question_text, k.title as kit_title,
          COUNT(*) as times_answered,
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga
        JOIN questions q ON q.id = ga.question_id
        LEFT JOIN question_kits k ON k.id = q.kit_id
        JOIN games g ON g.id = ga.game_id
        WHERE ga.user_id = ? AND ${teacherScope}
        GROUP BY ga.question_id HAVING times_answered >= 2
        ORDER BY CAST(correct AS FLOAT)/times_answered ASC LIMIT 20
      `, [sid]);
      const byType = await dbAll(`
        SELECT q.answer_type,
          COUNT(*) as total,
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga
        JOIN questions q ON q.id = ga.question_id
        JOIN games g ON g.id = ga.game_id
        WHERE ga.user_id = ? AND ${teacherScope}
        GROUP BY q.answer_type ORDER BY total DESC
      `, [sid]);
      return res.json({ type, student, games, weakest, byType });
    }

    if (type === 'question_type') {
      const at = String(id);
      const rows = await dbAll(`
        SELECT q.id as question_id, q.question_text, k.title as kit_name,
          COUNT(*) as times_answered,
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) as correct,
          AVG(ga.time_taken) as avg_time
        FROM game_answers ga
        JOIN questions q ON q.id = ga.question_id
        JOIN games g ON g.id = ga.game_id
        LEFT JOIN question_kits k ON k.id = q.kit_id
        WHERE q.answer_type = ? AND ${teacherScope} AND ga.user_id IN (${studentIdList})
        GROUP BY ga.question_id HAVING times_answered >= 1
        ORDER BY CAST(correct AS FLOAT)/times_answered ASC LIMIT 100
      `, [at]);
      return res.json({ type, answer_type: at, rows });
    }

    return res.status(400).json({ error: 'unknown type' });
  } catch (err) {
    console.error('[analytics/detail]', err);
    res.status(500).json({ error: err.message });
  }
});

// Student Analytics (optional ?teacherId= to scope to that teacher's games only)
app.get('/api/analytics/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { teacherId } = req.query;
    // If teacherId is provided, scope all queries to only games hosted by or using kits from that teacher
    const scopeFilter = teacherId
      ? `AND ga.game_id IN (SELECT g2.id FROM games g2 WHERE g2.host_id = ${parseInt(teacherId)} OR g2.kit_id IN (SELECT k2.id FROM question_kits k2 WHERE k2.teacher_id = ${parseInt(teacherId)}))`
      : '';
    const gameScopeFilter = teacherId
      ? `AND g.id IN (SELECT g2.id FROM games g2 WHERE g2.host_id = ${parseInt(teacherId)} OR g2.kit_id IN (SELECT k2.id FROM question_kits k2 WHERE k2.teacher_id = ${parseInt(teacherId)}))`
      : '';

    // --- subjectPerformance ---
    const subjectPerformance = await dbAll(`
      SELECT
        qk.subject,
        COUNT(DISTINCT g.id) AS games_played,
        COALESCE(ROUND(
          SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ga.id), 0)
        , 1), 0) AS accuracy,
        COALESCE(ROUND(AVG(ga.points_earned), 1), 0) AS avg_score,
        COUNT(ga.id) AS total_questions
      FROM game_answers ga
      JOIN games g ON ga.game_id = g.id
      JOIN question_kits qk ON g.kit_id = qk.id
      WHERE ga.user_id = ? ${scopeFilter}
      GROUP BY qk.subject
    `, [studentId]);

    // --- recentGames ---
    const recentGames = await dbAll(`
      SELECT
        g.game_code,
        qk.title AS kit_title,
        gp.score,
        COUNT(ga.id) AS questions_answered,
        SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers,
        CASE WHEN COUNT(ga.id) > 0
          THEN ROUND(SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(ga.id), 1)
          ELSE 0
        END AS accuracy,
        g.created_at AS date,
        g.game_mode
      FROM games g
      JOIN game_participants gp ON gp.game_id = g.id AND gp.user_id = ?
      LEFT JOIN question_kits qk ON g.kit_id = qk.id
      LEFT JOIN game_answers ga ON ga.game_id = g.id AND ga.user_id = ?
      WHERE 1=1 ${gameScopeFilter}
      GROUP BY g.id
      HAVING COUNT(ga.id) > 0
      ORDER BY g.created_at DESC
      LIMIT 15
    `, [studentId, studentId]);

    // --- dailyActivity (last 30 days) ---
    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
    const dailyRows = await dbAll(`
      SELECT date, games_played, bb_earned_today, streak_day, playtime_seconds
      FROM bb_daily_tracker
      WHERE user_id = ? AND date >= ?
      ORDER BY date ASC
    `, [studentId, thirtyDaysAgo]);

    const dailyAnswersRows = await dbAll(`
      SELECT
        DATE(ga.answered_at) AS date,
        COUNT(ga.id) AS questions_answered,
        SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers
      FROM game_answers ga
      WHERE ga.user_id = ? AND DATE(ga.answered_at) >= ? ${scopeFilter}
      GROUP BY DATE(ga.answered_at)
    `, [studentId, thirtyDaysAgo]);

    const dailyMap = {};
    dailyRows.forEach(r => { dailyMap[r.date] = r; });
    const answersMap = {};
    dailyAnswersRows.forEach(r => { answersMap[r.date] = r; });

    const dailyActivity = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const tracker = dailyMap[dateStr];
      const answers = answersMap[dateStr];
      dailyActivity.push({
        date: dateStr,
        questions_answered: answers ? answers.questions_answered : 0,
        correct_answers: answers ? answers.correct_answers : 0,
        playtime_seconds: tracker ? tracker.playtime_seconds : 0,
        games_played: tracker ? tracker.games_played : 0
      });
    }

    // --- speedStats ---
    const speedStats = await dbGet(`
      SELECT
        COALESCE(ROUND(AVG(ga.time_taken), 2), 0) AS avg_time_per_question,
        COALESCE(MIN(CASE WHEN ga.time_taken > 0.5 THEN ga.time_taken END), 0) AS fastest_answer,
        COALESCE(SUM(ga.time_taken), 0) AS total_time_played
      FROM game_answers ga
      WHERE ga.user_id = ? ${scopeFilter}
    `, [studentId]);

    // --- accuracyByDate ---
    const accuracyByDate = await dbAll(`
      SELECT
        DATE(ga.answered_at) AS date,
        COUNT(ga.id) AS total,
        SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) AS correct
      FROM game_answers ga
      WHERE ga.user_id = ? AND ga.answered_at IS NOT NULL ${scopeFilter}
      GROUP BY DATE(ga.answered_at)
      ORDER BY date ASC
    `, [studentId]);

    // --- bestSubject ---
    const bestSubjectRow = await dbGet(`
      SELECT
        qk.subject,
        ROUND(SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(ga.id), 1) AS accuracy
      FROM game_answers ga
      JOIN games g ON ga.game_id = g.id
      JOIN question_kits qk ON g.kit_id = qk.id
      WHERE ga.user_id = ? ${scopeFilter}
      GROUP BY qk.subject
      HAVING COUNT(ga.id) >= 5
      ORDER BY accuracy DESC
      LIMIT 1
    `, [studentId]);

    // --- totals ---
    const answerTotals = await dbGet(`
      SELECT
        SUM(CASE WHEN ga.is_correct = 1 THEN 1 ELSE 0 END) AS totalCorrectAnswers,
        COUNT(ga.id) AS totalAnswers
      FROM game_answers ga
      WHERE ga.user_id = ? ${scopeFilter}
    `, [studentId]);

    // --- longestStreak ---
    const allAnswersData = await dbAll(`
      SELECT ga.is_correct
      FROM game_answers ga
      WHERE ga.user_id = ? ${scopeFilter}
      ORDER BY ga.answered_at ASC
    `, [studentId]);

    let longestStreak = 0;
    let currentStreak = 0;
    for (const ans of allAnswersData) {
      if (ans.is_correct) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // --- Advanced: question type breakdown ---
    const questionTypeBreakdown = await dbAll(`
      SELECT q.answer_type, COUNT(*) as total,
        SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga JOIN questions q ON ga.question_id=q.id
      WHERE ga.user_id=? ${scopeFilter}
      GROUP BY q.answer_type ORDER BY total DESC
    `, [studentId]);

    // --- Advanced: weakest questions ---
    const weakestQuestions = await dbAll(`
      SELECT q.question_text, q.answer_type, k.title as kit_name,
        COUNT(*) as times_seen,
        SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as times_correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga JOIN questions q ON ga.question_id=q.id
      LEFT JOIN question_kits k ON q.kit_id=k.id
      WHERE ga.user_id=? ${scopeFilter}
      GROUP BY ga.question_id HAVING times_seen>=2
      ORDER BY CAST(times_correct AS FLOAT)/times_seen ASC LIMIT 10
    `, [studentId]);

    // --- Advanced: improvement (compare last 7 days vs prev 7 days) ---
    const recent7 = await dbGet(`
      SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','-7 days') ${scopeFilter}
    `, [studentId]);
    const prev7 = await dbGet(`
      SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','-14 days') AND ga.answered_at<datetime('now','-7 days') ${scopeFilter}
    `, [studentId]);

    // --- Advanced: hourly activity pattern ---
    const hourlyPattern = await dbAll(`
      SELECT CAST(strftime('%H', ga.answered_at) AS INTEGER) as hour,
        COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct
      FROM game_answers ga WHERE ga.user_id=? ${scopeFilter}
      GROUP BY hour ORDER BY hour
    `, [studentId]);

    // --- Advanced: game mode breakdown ---
    const modeBreakdown = await dbAll(`
      SELECT g.game_mode, COUNT(DISTINCT g.id) as games,
        COUNT(ga.id) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga JOIN games g ON ga.game_id=g.id
      WHERE ga.user_id=? ${scopeFilter}
      GROUP BY g.game_mode
    `, [studentId]);

    // --- Advanced: perfect games count ---
    const perfectGames = await dbGet(`
      SELECT COUNT(*) as c FROM (
        SELECT ga.game_id FROM game_answers ga
        WHERE ga.user_id=? ${scopeFilter}
        GROUP BY ga.game_id HAVING COUNT(*)=SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) AND COUNT(*)>=3
      )
    `, [studentId]);

    const recentAcc = recent7?.total > 0 ? Math.round((recent7.correct / recent7.total) * 100) : null;
    const prevAcc = prev7?.total > 0 ? Math.round((prev7.correct / prev7.total) * 100) : null;

    // --- Advanced: strongest questions ---
    const strongestQuestions = await dbAll(`
      SELECT q.question_text, q.answer_type, k.title as kit_name,
        COUNT(*) as times_seen, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as times_correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga JOIN questions q ON ga.question_id=q.id LEFT JOIN question_kits k ON q.kit_id=k.id
      WHERE ga.user_id=? ${scopeFilter}
      GROUP BY ga.question_id HAVING times_seen>=2
      ORDER BY CAST(times_correct AS FLOAT)/times_seen DESC, avg_time ASC LIMIT 10
    `, [studentId]);

    // --- Advanced: retry improvement (first attempt vs later attempts per question) ---
    const retryImprovement = await dbGet(`
      SELECT
        (SELECT AVG(CASE WHEN sub.rn=1 AND sub.is_correct=1 THEN 100.0 WHEN sub.rn=1 THEN 0.0 END)
         FROM (SELECT ga2.question_id, ga2.is_correct, ROW_NUMBER() OVER (PARTITION BY ga2.question_id ORDER BY ga2.answered_at) as rn
               FROM game_answers ga2 WHERE ga2.user_id=? ${scopeFilter.replace(/ga\./g, 'ga2.')}) sub) as first_attempt_acc,
        (SELECT AVG(CASE WHEN sub2.rn>1 AND sub2.is_correct=1 THEN 100.0 WHEN sub2.rn>1 THEN 0.0 END)
         FROM (SELECT ga3.question_id, ga3.is_correct, ROW_NUMBER() OVER (PARTITION BY ga3.question_id ORDER BY ga3.answered_at) as rn
               FROM game_answers ga3 WHERE ga3.user_id=? ${scopeFilter.replace(/ga\./g, 'ga3.')}) sub2) as retry_acc
    `, [studentId, studentId]);

    // --- Advanced: 90-day activity grid (GitHub-style) ---
    const activityGrid = await dbAll(`
      SELECT DATE(ga.answered_at) as day, COUNT(*) as questions,
        SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct
      FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','-90 days') ${scopeFilter}
      GROUP BY day ORDER BY day ASC
    `, [studentId]);

    // --- Advanced: speed trend over time (weekly avg response time) ---
    const speedTrend = await dbAll(`
      SELECT strftime('%Y-W%W', ga.answered_at) as week,
        AVG(ga.time_taken) as avg_time, COUNT(*) as questions
      FROM game_answers ga WHERE ga.user_id=? AND ga.time_taken>0 ${scopeFilter}
      GROUP BY week ORDER BY week DESC LIMIT 12
    `, [studentId]);

    // --- Advanced: response time distribution (histogram buckets) ---
    const timeDistribution = await dbAll(`
      SELECT
        CASE
          WHEN ga.time_taken <= 2 THEN '0-2s'
          WHEN ga.time_taken <= 5 THEN '2-5s'
          WHEN ga.time_taken <= 10 THEN '5-10s'
          WHEN ga.time_taken <= 20 THEN '10-20s'
          WHEN ga.time_taken <= 30 THEN '20-30s'
          ELSE '30s+'
        END as bucket,
        COUNT(*) as total,
        SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct
      FROM game_answers ga WHERE ga.user_id=? AND ga.time_taken>0 ${scopeFilter}
      GROUP BY bucket
      ORDER BY MIN(ga.time_taken)
    `, [studentId]);

    // --- Advanced: per-kit accuracy trend (last 5 plays per kit) ---
    const kitTrends = await dbAll(`
      SELECT k.title as kit_name, g.created_at,
        COUNT(ga.id) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct
      FROM game_answers ga JOIN games g ON ga.game_id=g.id JOIN question_kits k ON g.kit_id=k.id
      WHERE ga.user_id=? ${scopeFilter}
      GROUP BY g.id ORDER BY g.created_at DESC LIMIT 50
    `, [studentId]);

    // --- Advanced: multiplayer stats ---
    const mpStats = await dbGet(`
      SELECT COUNT(DISTINCT g.id) as mp_games,
        (SELECT COUNT(*) FROM game_participants gp2 JOIN games g2 ON gp2.game_id=g2.id
         WHERE gp2.user_id=? AND (SELECT COUNT(*) FROM game_participants gp3 WHERE gp3.game_id=g2.id)>=2
         AND gp2.score=(SELECT MAX(gp4.score) FROM game_participants gp4 WHERE gp4.game_id=g2.id)) as mp_wins
      FROM game_participants gp JOIN games g ON gp.game_id=g.id
      WHERE gp.user_id=? AND (SELECT COUNT(*) FROM game_participants gp5 WHERE gp5.game_id=g.id)>=2
    `, [studentId, studentId]);

    // --- Advanced: personal records ---
    const highScore = await dbGet('SELECT MAX(gp.score) as s, g.game_mode, k.title as kit FROM game_participants gp JOIN games g ON gp.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE gp.user_id=?', [studentId]);
    const mostQuestionsInGame = await dbGet(`SELECT COUNT(*) as c, g.game_code, k.title as kit FROM game_answers ga JOIN games g ON ga.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE ga.user_id=? ${scopeFilter} GROUP BY ga.game_id ORDER BY c DESC LIMIT 1`, [studentId]);
    const fastestGame = await dbGet(`SELECT AVG(ga.time_taken) as avg_t, g.game_code, k.title as kit FROM game_answers ga JOIN games g ON ga.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE ga.user_id=? AND ga.time_taken>0 ${scopeFilter} GROUP BY ga.game_id HAVING COUNT(*)>=5 ORDER BY avg_t ASC LIMIT 1`, [studentId]);

    // --- Advanced: monthly comparison (this month vs last month) ---
    const thisMonth = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, COUNT(DISTINCT ga.game_id) as games FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','start of month') ${scopeFilter}`, [studentId]);
    const lastMonth = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, COUNT(DISTINCT ga.game_id) as games FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','start of month','-1 month') AND ga.answered_at<datetime('now','start of month') ${scopeFilter}`, [studentId]);

    // --- Advanced: accuracy by time-of-day (morning/afternoon/evening/night) ---
    const timeOfDayPerf = await dbAll(`
      SELECT
        CASE
          WHEN CAST(strftime('%H',ga.answered_at) AS INTEGER) BETWEEN 6 AND 11 THEN 'Morning'
          WHEN CAST(strftime('%H',ga.answered_at) AS INTEGER) BETWEEN 12 AND 16 THEN 'Afternoon'
          WHEN CAST(strftime('%H',ga.answered_at) AS INTEGER) BETWEEN 17 AND 21 THEN 'Evening'
          ELSE 'Night'
        END as period,
        COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct,
        AVG(ga.time_taken) as avg_time
      FROM game_answers ga WHERE ga.user_id=? ${scopeFilter}
      GROUP BY period ORDER BY MIN(CAST(strftime('%H',ga.answered_at) AS INTEGER))
    `, [studentId]);

    res.json({
      subjectPerformance: (subjectPerformance || []).map(s => ({ ...s, category: getSubjectCategory(s.subject) })),
      recentGames,
      dailyActivity,
      speedStats: {
        avg_time_per_question: speedStats.avg_time_per_question,
        fastest_answer: speedStats.fastest_answer,
        total_time_played: speedStats.total_time_played
      },
      accuracyByDate,
      bestSubject: bestSubjectRow ? bestSubjectRow.subject : null,
      totalCorrectAnswers: answerTotals.totalCorrectAnswers || 0,
      totalAnswers: answerTotals.totalAnswers || 0,
      longestStreak,
      // Advanced (for Blazes Plus)
      questionTypeBreakdown,
      weakestQuestions,
      strongestQuestions,
      improvement: {
        recent7Accuracy: recentAcc,
        prev7Accuracy: prevAcc,
        trend: recentAcc !== null && prevAcc !== null ? recentAcc - prevAcc : null,
        recent7Questions: recent7?.total || 0,
        prev7Questions: prev7?.total || 0,
        recent7AvgTime: recent7?.avg_time ? Number(Number(recent7.avg_time).toFixed(1)) : null,
        prev7AvgTime: prev7?.avg_time ? Number(Number(prev7.avg_time).toFixed(1)) : null,
      },
      monthlyComparison: {
        thisMonth: { questions: thisMonth?.total || 0, correct: thisMonth?.correct || 0, accuracy: thisMonth?.total > 0 ? Math.round((thisMonth.correct / thisMonth.total) * 100) : null, avgTime: thisMonth?.avg_time ? Number(Number(thisMonth.avg_time).toFixed(1)) : null, games: thisMonth?.games || 0 },
        lastMonth: { questions: lastMonth?.total || 0, correct: lastMonth?.correct || 0, accuracy: lastMonth?.total > 0 ? Math.round((lastMonth.correct / lastMonth.total) * 100) : null, avgTime: lastMonth?.avg_time ? Number(Number(lastMonth.avg_time).toFixed(1)) : null, games: lastMonth?.games || 0 },
      },
      hourlyPattern,
      modeBreakdown,
      perfectGames: perfectGames?.c || 0,
      retryImprovement: {
        firstAttemptAcc: retryImprovement?.first_attempt_acc ? Math.round(retryImprovement.first_attempt_acc) : null,
        retryAcc: retryImprovement?.retry_acc ? Math.round(retryImprovement.retry_acc) : null,
      },
      activityGrid,
      speedTrend: (speedTrend || []).reverse(),
      timeDistribution,
      kitTrends,
      multiplayerStats: { games: mpStats?.mp_games || 0, wins: mpStats?.mp_wins || 0 },
      personalRecords: {
        highScore: highScore?.s || 0,
        highScoreKit: highScore?.kit || '',
        mostQuestions: mostQuestionsInGame?.c || 0,
        mostQuestionsKit: mostQuestionsInGame?.kit || '',
        fastestAvgTime: fastestGame?.avg_t ? Number(Number(fastestGame.avg_t).toFixed(1)) : null,
        fastestKit: fastestGame?.kit || '',
      },
      timeOfDayPerf,
    });
  } catch (err) {
    console.error('Student analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch student analytics' });
  }
});

// ─── SEASON ENDPOINTS ───
app.get('/api/season/current', async (req, res) => {
  try {
    const season = await getCurrentSeason();
    res.json(season);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/season/progress/:userId', async (req, res) => {
  try {
    const season = await getCurrentSeason();
    const progress = await dbGet(
      'SELECT * FROM season_progress WHERE user_id = ? AND season_id = ?',
      [req.params.userId, season.id]
    );
    const xpForNext = progress ? xpForLevel(progress.level) : xpForLevel(1);
    const xpIntoLevel = progress ? progress.xp - totalXpForLevel(progress.level) : 0;
    res.json({
      season_number: season.season_number,
      days_remaining: Math.max(0, Math.ceil((new Date(season.end_date) - Date.now()) / 86400000)),
      end_date: season.end_date,
      xp: progress?.xp || 0,
      level: progress?.level || 1,
      xp_into_level: xpIntoLevel,
      xp_for_next: xpForNext,
      xp_earned_today: progress?.xp_earned_today || 0,
      daily_cap: DAILY_XP_CAP
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/season/badges/:userId', async (req, res) => {
  try {
    const badges = await dbAll('SELECT * FROM season_badges WHERE user_id = ? ORDER BY season_number DESC', [req.params.userId]);
    res.json(badges || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUBSCRIPTION HELPERS ───
async function getUserTier(userId) {
  const user = await dbGet('SELECT subscription_tier, subscription_expires FROM users WHERE id = ?', [userId]);
  if (!user) return 'free';
  if (user.subscription_tier === 'free') return 'free';
  // Check expiration
  if (user.subscription_expires && new Date(user.subscription_expires) < new Date()) {
    await dbRun("UPDATE users SET subscription_tier = 'free', subscription_id = NULL WHERE id = ?", [userId]);
    return 'free';
  }
  return user.subscription_tier || 'free';
}

function requireTier(minTier) {
  const tierOrder = { free: 0, blazes_plus: 1, teacher_pro: 2, school: 3 };
  return async (req, res, next) => {
    const userId = req.params.userId || req.body.userId;
    if (!userId) return res.status(401).json({ error: 'User ID required' });
    const tier = await getUserTier(userId);
    if ((tierOrder[tier] || 0) < (tierOrder[minTier] || 0)) {
      return res.status(403).json({ error: 'Upgrade required', requiredTier: minTier, currentTier: tier });
    }
    req.userTier = tier;
    next();
  };
}

// Check user notification preferences before sending
async function shouldNotify(userId, type) {
  try {
    const s = await dbGet('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    if (!s) return true; // no settings = default all on
    if (type === 'new_assignment' && !s.notify_assignments) return false;
    if (type === 'achievement' && !s.notify_achievements) return false;
    if ((type === 'classroom_invite' || type === 'classroom_added' || type === 'student_joined') && !s.notify_classroom) return false;
    if (type === 'student_completed' && !s.notify_classroom) return false;
    if (type === 'all_completed' && !s.notify_classroom) return false;
    return true;
  } catch { return true; }
}

// Login activity
app.get('/api/auth/login-activity/:userId', async (req, res) => {
  try {
    const activity = await dbAll(
      'SELECT ip_address, user_agent, created_at FROM login_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.params.userId]
    );
    res.json(activity || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/user-info/:userId', async (req, res) => {
  try {
    const user = await dbGet('SELECT id, email, name, role, password, google_access_token, created_at, password_changed_at, subscription_tier FROM users WHERE id = ?', [req.params.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasPassword: !!user.password,
      isGoogleAccount: !!user.google_access_token,
      createdAt: user.created_at,
      passwordChangedAt: user.password_changed_at,
      subscriptionTier: user.subscription_tier || 'free'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== EMAIL VERIFICATION ===========
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });
    // Keep the token on the row after verifying so repeated hits (StrictMode dev
    // double-mount, mail clients that prefetch links, user refreshes) remain idempotent.
    const user = await dbGet('SELECT id, email_verified FROM users WHERE verification_token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
    if (!user.email_verified) {
      await dbRun('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    email = email.toLowerCase().trim();
    const user = await dbGet('SELECT * FROM users WHERE email = ? AND email_verified = 0', [email]);
    if (!user) return res.json({ success: true }); // Don't reveal if email exists
    const verifyToken = require('crypto').randomBytes(32).toString('hex');
    await dbRun('UPDATE users SET verification_token = ? WHERE id = ?', [verifyToken, user.id]);
    const transporter = require('nodemailer').createTransport({
      service: 'gmail',
      auth: { user: process.env.CONTACT_EMAIL_USER, pass: process.env.CONTACT_EMAIL_PASS },
    });
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
    await transporter.sendMail({
      from: `"Blazes" <${process.env.CONTACT_EMAIL_USER}>`,
      to: email,
      subject: 'Blazes — Verify Your Email',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h1 style="color:#dc2626;font-size:28px;margin-bottom:8px;">Blazes</h1><h2 style="margin-bottom:16px;">Verify Your Email</h2><p>Click below to verify:</p><a href="${verifyUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;margin:20px 0;">Verify Email</a></div>`,
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== FLASHCARD MODE (Membership+) ===========
app.get('/api/flashcards/:kitId', async (req, res) => {
  try {
    const { userId, count } = req.query;
    if (userId) {
      const limit = await checkAiLimit(parseInt(userId), 'flashcards');
      if (!limit.allowed) {
        if (limit.reason === 'upgrade_required') return res.status(403).json({ error: 'upgrade_required', message: 'Flashcard mode requires Blazes Plus', requiredTier: 'blazes_plus' });
        return res.status(429).json({ error: 'daily_limit', message: `AI flashcard limit reached (${limit.used}/${limit.limit} today). Resets at midnight.`, used: limit.used, limit: limit.limit });
      }
    }

    const kit = await dbGet('SELECT title, description FROM question_kits WHERE id = ?', [req.params.kitId]);
    const allQuestions = await dbAll('SELECT id, question_text, answer_type, correct_answer, option_a, option_b, option_c, option_d, image_url FROM questions WHERE kit_id = ?', [req.params.kitId]);
    // Filter out audio questions — AI can't listen to audio clips
    const questions = (allQuestions || []).filter(q => q.answer_type !== 'audio');
    if (questions.length === 0) return res.json({ cards: [], total: 0 });

    const requestedCount = Math.min(Math.max(parseInt(count) || questions.length, 1), 50);

    // Build a summary of each question for the AI
    const qSummaries = questions.map((q, i) => {
      let answer = q.correct_answer || '';
      if (q.answer_type === 'multiple_choice' || q.answer_type === 'audio') {
        const idx = ['A', 'B', 'C', 'D'].indexOf(answer.toUpperCase());
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
        if (idx >= 0 && opts[idx]) answer = opts[idx];
      }
      if (q.answer_type === 'multi_select') {
        const letters = answer.toUpperCase().split('').filter(l => 'ABCD'.includes(l));
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
        answer = letters.map(l => opts['ABCD'.indexOf(l)]).filter(Boolean).join(', ');
      }
      if (q.answer_type === 'ordering') {
        const items = answer.split('|||').filter(Boolean);
        answer = items.map((item, j) => `${j + 1}. ${item}`).join(', ');
      }
      if (q.answer_type === 'matching') {
        const pairs = answer.split('###').filter(Boolean).map(p => {
          const [left, right] = p.split('|||');
          return `${left?.trim()} → ${right?.trim()}`;
        });
        answer = pairs.join(', ');
      }
      if (q.answer_type === 'image_label') {
        try {
          const pins = JSON.parse(answer);
          if (Array.isArray(pins)) answer = pins.map(p => p.label).join(', ');
        } catch {}
      }
      return `- Q: ${q.question_text} → A: ${answer}`;
    }).join('\n');

    if (!groq) {
      // Fallback: return raw questions if AI not available
      const raw = questions.slice(0, requestedCount).map(q => {
        let answer = q.correct_answer || '';
        if (q.answer_type === 'multiple_choice') {
          const idx = ['A','B','C','D'].indexOf(answer.toUpperCase());
          const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
          if (idx >= 0 && opts[idx]) answer = opts[idx];
        }
        return { id: q.id, front: q.question_text, back: answer };
      });
      return res.json({ cards: raw, total: questions.length });
    }

    try {
      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You generate flashcards for students studying "${kit?.title || 'a topic'}". You will be given source material from quiz questions.

Your job: create exactly ${requestedCount} flashcards. Each flashcard has:
- "front": A short, clear question or prompt
- "back": A short, clear answer

Important rules:
- These are FLASHCARDS, not quiz questions. The front should ask something simple and direct.
- The back should be a concise, memorizable answer — a word, phrase, or 1-2 sentences max.
- You can generate MORE flashcards than source questions by breaking down complex topics, testing different angles, or creating definition/concept cards from the material.
- You can also generate FEWER by focusing on the most important concepts.
- Do NOT number them. Do NOT include the question type. Just clean Q&A.
- Return ONLY a valid JSON array. No markdown fences, no explanation.`
          },
          {
            role: 'user',
            content: `Source material (${questions.length} quiz questions about "${kit?.title || ''}"):\n${qSummaries}\n\nGenerate exactly ${requestedCount} flashcards as JSON: [{"front":"...","back":"..."},...]`
          }
        ],
        temperature: 0.4,
        max_tokens: 6000,
      });

      const text = result.choices[0]?.message?.content?.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const flashcards = JSON.parse(jsonMatch[0]);
        const cards = flashcards.slice(0, requestedCount).map((fc, i) => ({
          id: i + 1,
          front: fc.front,
          back: fc.back,
        }));
        if (userId) await trackAiUsage(parseInt(userId), 'flashcards');
        return res.json({ cards, total: questions.length });
      }
      return res.json({ cards: questions.slice(0, requestedCount).map((q, i) => ({ id: i + 1, front: q.question_text, back: q.correct_answer })), total: questions.length });
    } catch (aiErr) {
      console.error('[Flashcards AI] Error:', aiErr.message);
      return res.json({ cards: questions.slice(0, requestedCount).map((q, i) => ({ id: i + 1, front: q.question_text, back: q.correct_answer })), total: questions.length });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== EXPORT STATS (Blazes Plus) ===========
app.get('/api/export/stats/:userId', async (req, res) => {
  try {
    const tier = await getUserTier(parseInt(req.params.userId));
    if (!['blazes_plus', 'teacher_pro', 'school'].includes(tier)) {
      return res.status(403).json({ error: 'upgrade_required', message: 'Export requires Blazes Plus', requiredTier: 'blazes_plus' });
    }
    const userId = req.params.userId;
    const TL = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill in Blank', math_equation: 'Math' };
    const v = (x, d = 0) => x != null ? x : d;
    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
    const f1 = (x) => x ? Number(Number(x).toFixed(1)) : '';
    // mp = multiplayer filter (games with 2+ players)
    const MP = `(SELECT COUNT(*) FROM game_participants gp_mp WHERE gp_mp.game_id=g.id) >= 2`;

    const user = await dbGet('SELECT name, email, role, created_at FROM users WHERE id=?', [userId]);
    const sub = await dbGet('SELECT subscription_tier, subscription_expires FROM users WHERE id=?', [userId]);
    const stats = await dbGet('SELECT * FROM user_stats WHERE user_id=?', [userId]);
    const sp = await dbGet('SELECT * FROM season_progress WHERE user_id=?', [userId]);
    const bb = await dbGet('SELECT balance, current_streak, last_streak_date FROM blazes_bucks WHERE user_id=?', [userId]);

    // Separate solo vs multiplayer
    const mpGames = await dbGet(`SELECT COUNT(*) as c FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? AND ${MP}`, [userId]);
    const soloGames = await dbGet(`SELECT COUNT(*) as c FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? AND NOT ${MP}`, [userId]);
    const mpWins = await dbGet(`SELECT COUNT(*) as c FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? AND ${MP} AND gp.score=(SELECT MAX(gp2.score) FROM game_participants gp2 WHERE gp2.game_id=g.id)`, [userId]);
    const mpAnswers = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, SUM(ga.points_earned) as points FROM game_answers ga JOIN games g ON ga.game_id=g.id WHERE ga.user_id=? AND ${MP}`, [userId]);
    const soloAnswers = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, SUM(ga.points_earned) as points FROM game_answers ga JOIN games g ON ga.game_id=g.id WHERE ga.user_id=? AND NOT ${MP}`, [userId]);
    const allAnswers = await dbGet('SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(time_taken) as avg_time, SUM(points_earned) as points, MIN(answered_at) as first, MAX(answered_at) as last FROM game_answers WHERE user_id=?', [userId]);
    const fastCorrect = await dbGet('SELECT MIN(time_taken) as t FROM game_answers WHERE user_id=? AND is_correct=1 AND time_taken>0.5', [userId]);
    const totalBBIn = await dbGet('SELECT SUM(amount) as s FROM blazes_bucks_log WHERE user_id=? AND amount>0', [userId]);
    const totalBBOut = await dbGet('SELECT SUM(ABS(amount)) as s FROM blazes_bucks_log WHERE user_id=? AND amount<0', [userId]);
    const skinCount = await dbGet('SELECT COUNT(*) as c FROM user_skins WHERE user_id=?', [userId]);
    const uniqueKits = await dbGet('SELECT COUNT(DISTINCT g.kit_id) as c FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=?', [userId]);
    const uniqueOpps = await dbGet('SELECT COUNT(DISTINCT gp2.user_id) as c FROM game_participants gp1 JOIN game_participants gp2 ON gp1.game_id=gp2.game_id WHERE gp1.user_id=? AND gp2.user_id!=?', [userId, userId]);
    const bestGame = await dbGet('SELECT MAX(gp.score) as s FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=?', [userId]);
    const bestMPGame = await dbGet(`SELECT MAX(gp.score) as s FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? AND ${MP}`, [userId]);
    const perfectGames = await dbGet(`SELECT COUNT(*) as c FROM (SELECT ga.game_id, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct FROM game_answers ga WHERE ga.user_id=? GROUP BY ga.game_id HAVING total=correct AND total>=3)`, [userId]);
    const avgScoreMP = await dbGet(`SELECT AVG(gp.score) as s FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? AND ${MP}`, [userId]);

    const modeBreakdown = await dbAll(`SELECT g.game_mode, COUNT(*) as games, CASE WHEN ${MP} THEN 'Multiplayer' ELSE 'Solo' END as type, SUM(gp.score) as total_score, AVG(gp.score) as avg_score, (SELECT SUM(CASE WHEN ga2.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga2 WHERE ga2.game_id IN (SELECT gp3.game_id FROM game_participants gp3 WHERE gp3.user_id=?) AND ga2.user_id=?) as mode_correct, (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.game_id IN (SELECT gp3.game_id FROM game_participants gp3 WHERE gp3.user_id=?) AND ga2.user_id=?) as mode_total FROM game_participants gp JOIN games g ON gp.game_id=g.id WHERE gp.user_id=? GROUP BY g.game_mode, type ORDER BY games DESC`, [userId, userId, userId, userId, userId]);
    const typeBreakdown = await dbAll('SELECT q.answer_type, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, MIN(CASE WHEN ga.time_taken>0.5 THEN ga.time_taken END) as fastest, MAX(ga.time_taken) as slowest FROM game_answers ga JOIN questions q ON ga.question_id=q.id WHERE ga.user_id=? GROUP BY q.answer_type ORDER BY total DESC', [userId]);
    const typeMP = await dbAll(`SELECT q.answer_type, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id WHERE ga.user_id=? AND ${MP} GROUP BY q.answer_type`, [userId]);
    const kitPerformance = await dbAll(`SELECT k.title, k.subject, COUNT(*) as times_played, SUM(gp.score) as total_score, AVG(gp.score) as avg_score, MAX(gp.score) as best_score, (SELECT COUNT(*) FROM game_answers ga2 JOIN games g2 ON ga2.game_id=g2.id WHERE g2.kit_id=k.id AND ga2.user_id=?) as q_answered, (SELECT SUM(CASE WHEN ga3.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga3 JOIN games g3 ON ga3.game_id=g3.id WHERE g3.kit_id=k.id AND ga3.user_id=?) as q_correct, (SELECT AVG(ga4.time_taken) FROM game_answers ga4 JOIN games g4 ON ga4.game_id=g4.id WHERE g4.kit_id=k.id AND ga4.user_id=? AND ga4.time_taken>0) as avg_time FROM game_participants gp JOIN games g ON gp.game_id=g.id JOIN question_kits k ON g.kit_id=k.id WHERE gp.user_id=? GROUP BY k.id ORDER BY times_played DESC LIMIT 100`, [userId, userId, userId, userId]);
    const allQPerf = await dbAll('SELECT q.question_text, q.answer_type, k.title as kit, COUNT(*) as seen, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, MIN(CASE WHEN ga.time_taken>0.5 THEN ga.time_taken END) as best_time, MAX(ga.time_taken) as worst_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id LEFT JOIN question_kits k ON q.kit_id=k.id WHERE ga.user_id=? GROUP BY ga.question_id ORDER BY CASE WHEN seen>0 THEN CAST(correct AS FLOAT)/seen ELSE 1 END ASC LIMIT 200', [userId]);
    const games = await dbAll(`SELECT g.game_code, g.game_mode, g.created_at, gp.score, gp.eliminated, gp.eliminated_at_round, k.title as kit, (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=? AND ga.is_correct=1) as correct, (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=?) as total, (SELECT AVG(ga.time_taken) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=? AND ga.time_taken>0) as avg_t, (SELECT MIN(ga.time_taken) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=? AND ga.time_taken>0.5) as fast_t, (SELECT MAX(ga.time_taken) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=?) as slow_t, (SELECT COUNT(*) FROM game_participants gp2 WHERE gp2.game_id=g.id) as players, (SELECT COUNT(*) FROM game_participants gp3 WHERE gp3.game_id=g.id AND gp3.score>gp.score) as rank_above FROM game_participants gp JOIN games g ON gp.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE gp.user_id=? ORDER BY g.created_at DESC LIMIT 1000`, [userId, userId, userId, userId, userId, userId]);
    const dailyActivity = await dbAll(`SELECT DATE(ga.answered_at) as day, COUNT(DISTINCT ga.game_id) as games, COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, SUM(ga.points_earned) as points, AVG(ga.time_taken) as avg_time FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','-90 days') GROUP BY day ORDER BY day DESC`, [userId]);
    const weeklyTrend = await dbAll(`SELECT strftime('%Y-W%W', ga.answered_at) as week, COUNT(DISTINCT ga.game_id) as games, COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, SUM(ga.points_earned) as points FROM game_answers ga WHERE ga.user_id=? GROUP BY week ORDER BY week DESC LIMIT 26`, [userId]);
    const monthlyTrend = await dbAll(`SELECT strftime('%Y-%m', ga.answered_at) as month, COUNT(DISTINCT ga.game_id) as games, COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, SUM(ga.points_earned) as points FROM game_answers ga WHERE ga.user_id=? GROUP BY month ORDER BY month DESC LIMIT 24`, [userId]);
    const hourly = await dbAll(`SELECT CAST(strftime('%H',ga.answered_at) AS INTEGER) as hour, COUNT(*) as q, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as c, AVG(ga.time_taken) as t FROM game_answers ga WHERE ga.user_id=? GROUP BY hour ORDER BY hour`, [userId]);
    const weekday = await dbAll(`SELECT CASE CAST(strftime('%w',ga.answered_at) AS INTEGER) WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' END as day, COUNT(*) as q, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as c, AVG(ga.time_taken) as t FROM game_answers ga WHERE ga.user_id=? GROUP BY CAST(strftime('%w',ga.answered_at) AS INTEGER) ORDER BY CAST(strftime('%w',ga.answered_at) AS INTEGER)`, [userId]);
    const everyAnswer = await dbAll(`SELECT ga.answer, ga.is_correct, ga.time_taken, ga.points_earned, ga.answered_at, q.question_text, q.answer_type, q.correct_answer, g.game_code, g.game_mode, k.title as kit, (SELECT COUNT(*) FROM game_participants gp2 WHERE gp2.game_id=g.id) as players FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE ga.user_id=? ORDER BY ga.answered_at DESC LIMIT 5000`, [userId]);
    const bbLog = await dbAll('SELECT amount, reason, game_code, created_at FROM blazes_bucks_log WHERE user_id=? ORDER BY created_at DESC LIMIT 1000', [userId]);
    const xpLog = await dbAll('SELECT amount, source, game_code, created_at FROM season_xp_log WHERE user_id=? ORDER BY created_at DESC LIMIT 1000', [userId]);
    const achievements = await dbAll('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id=? ORDER BY unlocked_at DESC', [userId]);
    const ownedSkins = await dbAll('SELECT skin_id, COUNT(*) as count FROM user_skins WHERE user_id=? GROUP BY skin_id ORDER BY count DESC', [userId]);

    // ── Build workbook ──
    const wb = XLSX.utils.book_new();

    // 1. Overview — separated Solo vs Multiplayer
    const ov = [
      ['BLAZES STATS REPORT', '', ''], [],
      ['PROFILE', '', ''],
      ['Player', user?.name || '', ''],
      ['Email', user?.email || '', ''],
      ['Role', user?.role || '', ''],
      ['Account Created', user?.created_at || '', ''],
      ['Plan', sub?.subscription_tier || 'free', sub?.subscription_expires ? `Expires ${sub.subscription_expires}` : ''],
      ['Report Date', new Date().toLocaleString(), ''],
      [],
      ['MULTIPLAYER STATS', '(Solo games excluded)', ''],
      ['MP Games Played', v(mpGames?.c), ''],
      ['MP Wins', v(mpWins?.c), ''],
      ['MP Win Rate', `${pct(v(mpWins?.c), v(mpGames?.c))}%`, ''],
      ['MP Questions Answered', v(mpAnswers?.total), ''],
      ['MP Correct', v(mpAnswers?.correct), ''],
      ['MP Accuracy', `${pct(v(mpAnswers?.correct), v(mpAnswers?.total))}%`, ''],
      ['MP Avg Response Time', mpAnswers?.avg_time ? `${Number(mpAnswers.avg_time).toFixed(1)}s` : 'N/A', ''],
      ['MP Total Points', v(mpAnswers?.points), ''],
      ['MP Avg Score', avgScoreMP?.s ? Math.round(avgScoreMP.s) : 0, ''],
      ['MP Best Score', v(bestMPGame?.s), ''],
      ['Unique Opponents', v(uniqueOpps?.c), ''],
      [],
      ['SOLO PRACTICE', '', ''],
      ['Solo Games', v(soloGames?.c), ''],
      ['Solo Questions', v(soloAnswers?.total), ''],
      ['Solo Correct', v(soloAnswers?.correct), ''],
      ['Solo Accuracy', `${pct(v(soloAnswers?.correct), v(soloAnswers?.total))}%`, ''],
      ['Solo Avg Time', soloAnswers?.avg_time ? `${Number(soloAnswers.avg_time).toFixed(1)}s` : 'N/A', ''],
      [],
      ['ALL GAMES COMBINED', '', ''],
      ['Total Games', (v(mpGames?.c) + v(soloGames?.c)), ''],
      ['Total Questions', v(allAnswers?.total), ''],
      ['Total Correct', v(allAnswers?.correct), ''],
      ['Combined Accuracy', `${pct(v(allAnswers?.correct), v(allAnswers?.total))}%`, ''],
      ['Total Points', v(allAnswers?.points), ''],
      ['Best Score (Any)', v(bestGame?.s), ''],
      ['Perfect Games (100%)', v(perfectGames?.c), ''],
      ['Fastest Correct', fastCorrect?.t ? `${Number(fastCorrect.t).toFixed(1)}s` : 'N/A', ''],
      ['First Game Ever', allAnswers?.first || 'N/A', ''],
      ['Last Game', allAnswers?.last || 'N/A', ''],
      ['Unique Kits Played', v(uniqueKits?.c), ''],
      [],
      ['ECONOMY', '', ''],
      ['BB Balance', v(bb?.balance), ''],
      ['BB Earned (All Time)', v(totalBBIn?.s), ''],
      ['BB Spent (All Time)', v(totalBBOut?.s), ''],
      ['Day Streak', v(bb?.current_streak), ''],
      ['Last Streak Date', bb?.last_streak_date || 'N/A', ''],
      ['Skins Owned', v(skinCount?.c), ''],
      [],
      ['SEASON', '', ''],
      ['Season', v(sp?.season_number, 1), ''],
      ['Level', v(sp?.level, 1), ''],
      ['Total XP', v(sp?.total_xp), ''],
      ['XP Into Level', v(sp?.xp_into_level), ''],
      ['XP For Next', v(sp?.xp_for_next), ''],
      ['Daily XP Today', v(sp?.xp_earned_today), ''],
      ['Daily Cap', v(sp?.daily_cap), ''],
      ['Achievements', achievements?.length || 0, ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ov);
    ws1['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

    // 2. Game History
    const ws2d = [['Date', 'Code', 'Mode', 'Kit', 'Score', 'Placement', 'Correct', 'Total', 'Accuracy %', 'Avg Time', 'Fastest', 'Slowest', 'Players', 'Type', 'Result'],
      ...(games || []).map(g => {
        const isMp = g.players >= 2;
        const place = isMp ? `#${g.rank_above + 1} of ${g.players}` : '';
        let result = isMp ? (g.rank_above === 0 ? 'Won' : 'Lost') : 'Solo';
        if (g.game_mode === 'survival') result = g.eliminated ? `Eliminated R${g.eliminated_at_round || '?'}` : 'Survived';
        return [g.created_at, g.game_code, g.game_mode, g.kit || '', g.score, place, g.correct, g.total, pct(g.correct, g.total), f1(g.avg_t), f1(g.fast_t), f1(g.slow_t), g.players, isMp ? 'Multiplayer' : 'Solo', result];
      })];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2d);
    ws2['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Game History');

    // 3. Kit Performance
    const ws3d = [['Kit', 'Subject', 'Times Played', 'Best Score', 'Avg Score', 'Total Score', 'Questions', 'Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(kitPerformance || []).map(k => [k.title || '', k.subject || '', k.times_played, v(k.best_score), Math.round(v(k.avg_score)), k.total_score, v(k.q_answered), v(k.q_correct), pct(v(k.q_correct), v(k.q_answered)), f1(k.avg_time)])];
    const ws3 = XLSX.utils.aoa_to_sheet(ws3d);
    ws3['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Kit Performance');

    // 4. Question Type (All + MP only)
    const typeMPMap = {};
    (typeMP || []).forEach(t => { typeMPMap[t.answer_type] = t; });
    const ws4d = [['Type', 'All: Answered', 'All: Correct', 'All: Accuracy %', 'All: Avg Time', 'All: Fastest', 'All: Slowest', 'MP: Answered', 'MP: Correct', 'MP: Accuracy %', 'MP: Avg Time'],
      ...(typeBreakdown || []).map(t => {
        const mp = typeMPMap[t.answer_type] || {};
        return [TL[t.answer_type] || t.answer_type, t.total, t.correct, pct(t.correct, t.total), f1(t.avg_time), f1(t.fastest), f1(t.slowest), v(mp.total), v(mp.correct), pct(v(mp.correct), v(mp.total)), f1(mp.avg_time)];
      })];
    const ws4 = XLSX.utils.aoa_to_sheet(ws4d);
    ws4['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 13 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Question Types');

    // 5. Game Modes
    const ws5d = [['Mode', 'Solo/MP', 'Games', 'Total Score', 'Avg Score'],
      ...(modeBreakdown || []).map(m => [m.game_mode, m.type, m.games, m.total_score, Math.round(v(m.avg_score))])];
    const ws5 = XLSX.utils.aoa_to_sheet(ws5d);
    ws5['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Game Modes');

    // 6. All Questions
    const ws6d = [['Question', 'Type', 'Kit', 'Seen', 'Correct', 'Accuracy %', 'Avg Time', 'Best Time', 'Worst Time', 'Mastery'],
      ...(allQPerf || []).map(q => {
        const acc = pct(q.correct, q.seen);
        const mastery = acc >= 90 ? 'Mastered' : acc >= 70 ? 'Good' : acc >= 50 ? 'Learning' : 'Needs Work';
        return [q.question_text || '', TL[q.answer_type] || q.answer_type, q.kit || '', q.seen, q.correct, acc, f1(q.avg_time), f1(q.best_time), f1(q.worst_time), mastery];
      })];
    const ws6 = XLSX.utils.aoa_to_sheet(ws6d);
    ws6['!cols'] = [{ wch: 48 }, { wch: 16 }, { wch: 22 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws6, 'All Questions');

    // 7. Every Answer
    const ws7d = [['Date', 'Code', 'Mode', 'Solo/MP', 'Kit', 'Question', 'Type', 'Your Answer', 'Correct Answer', 'Result', 'Time (s)', 'Points'],
      ...(everyAnswer || []).map(a => [a.answered_at, a.game_code, a.game_mode, a.players >= 2 ? 'MP' : 'Solo', a.kit || '', a.question_text || '', TL[a.answer_type] || a.answer_type, a.answer || '', a.correct_answer || '', a.is_correct ? 'Correct' : 'Wrong', f1(a.time_taken), v(a.points_earned)])];
    const ws7 = XLSX.utils.aoa_to_sheet(ws7d);
    ws7['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 18 }, { wch: 38 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 7 }, { wch: 7 }];
    XLSX.utils.book_append_sheet(wb, ws7, 'Every Answer');

    // 8. Daily (90 days)
    const ws8d = [['Date', 'Games', 'Questions', 'Correct', 'Accuracy %', 'Points', 'Avg Time'],
      ...(dailyActivity || []).map(d => [d.day, d.games, d.questions, d.correct, pct(d.correct, d.questions), v(d.points), f1(d.avg_time)])];
    const ws8 = XLSX.utils.aoa_to_sheet(ws8d);
    ws8['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws8, 'Daily (90d)');

    // 9. Weekly (26 weeks)
    const ws9d = [['Week', 'Games', 'Questions', 'Correct', 'Accuracy %', 'Points', 'Avg Time'],
      ...(weeklyTrend || []).map(w => [w.week, w.games, w.questions, w.correct, pct(w.correct, w.questions), v(w.points), f1(w.avg_time)])];
    const ws9 = XLSX.utils.aoa_to_sheet(ws9d);
    ws9['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws9, 'Weekly');

    // 10. Monthly (24 months)
    const ws10d = [['Month', 'Games', 'Questions', 'Correct', 'Accuracy %', 'Points', 'Avg Time'],
      ...(monthlyTrend || []).map(m => [m.month, m.games, m.questions, m.correct, pct(m.correct, m.questions), v(m.points), f1(m.avg_time)])];
    const ws10 = XLSX.utils.aoa_to_sheet(ws10d);
    ws10['!cols'] = [{ wch: 10 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws10, 'Monthly');

    // 11. By Hour
    const ws11d = [['Hour', 'Questions', 'Correct', 'Accuracy %', 'Avg Time'],
      ...(hourly || []).map(h => [`${String(h.hour).padStart(2, '0')}:00`, h.q, h.c, pct(h.c, h.q), f1(h.t)])];
    const ws11 = XLSX.utils.aoa_to_sheet(ws11d);
    ws11['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws11, 'By Hour');

    // 12. By Weekday
    const ws12d = [['Day', 'Questions', 'Correct', 'Accuracy %', 'Avg Time'],
      ...(weekday || []).map(d => [d.day, d.q, d.c, pct(d.c, d.q), f1(d.t)])];
    const ws12 = XLSX.utils.aoa_to_sheet(ws12d);
    ws12['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws12, 'By Weekday');

    // 13. XP History
    const ws13d = [['Date', 'XP', 'Source', 'Game Code'],
      ...(xpLog || []).map(x => [x.created_at, x.amount, x.source || '', x.game_code || ''])];
    const ws13 = XLSX.utils.aoa_to_sheet(ws13d);
    ws13['!cols'] = [{ wch: 20 }, { wch: 7 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws13, 'XP History');

    // 14. BlazesBucks
    const ws14d = [['Date', 'Amount', 'Type', 'Reason', 'Game Code'],
      ...(bbLog || []).map(b => [b.created_at, b.amount, b.amount > 0 ? 'Earned' : 'Spent', b.reason || '', b.game_code || ''])];
    const ws14 = XLSX.utils.aoa_to_sheet(ws14d);
    ws14['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws14, 'BlazesBucks');

    // 15. Achievements
    const ws15d = [['Achievement', 'Unlocked'],
      ...(achievements || []).map(a => [a.achievement_id, a.unlocked_at])];
    const ws15 = XLSX.utils.aoa_to_sheet(ws15d);
    ws15['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws15, 'Achievements');

    // 16. Skins Collection
    const ws16d = [['Skin ID', 'Count'],
      ...(ownedSkins || []).map(s => [s.skin_id, s.count])];
    const ws16 = XLSX.utils.aoa_to_sheet(ws16d);
    ws16['!cols'] = [{ wch: 20 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws16, 'Skins');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `blazes-stats-${(user?.name || 'export').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(Buffer.from(buf));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== TEACHER EXPORT (Teacher Pro) ===========
app.get('/api/export/teacher/:teacherId', async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    const tier = await getUserTier(teacherId);
    if (!['teacher_pro', 'school'].includes(tier)) {
      return res.status(403).json({ error: 'upgrade_required', message: 'Teacher Export requires Teacher Pro', requiredTier: 'teacher_pro' });
    }
    const v = (x, d = 0) => x != null ? x : d;
    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
    const f1 = (x) => x ? Number(Number(x).toFixed(1)) : '';

    const teacher = await dbGet('SELECT name, email, created_at FROM users WHERE id=?', [teacherId]);
    const classrooms = await dbAll(`SELECT c.*, (SELECT COUNT(*) FROM classroom_students cs WHERE cs.classroom_id=c.id AND cs.status='accepted') as student_count, (SELECT COUNT(*) FROM assignments a WHERE a.classroom_id=c.id) as assignment_count FROM classrooms c WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) ORDER BY c.created_at DESC`, [teacherId, teacherId]);
    const kits = await dbAll(`SELECT k.*, (SELECT COUNT(*) FROM questions q WHERE q.kit_id=k.id) as question_count FROM question_kits k WHERE k.teacher_id=? ORDER BY k.created_at DESC`, [teacherId]);

    // All students across all classrooms (scoped to this teacher's games/kits only)
    const teacherGameScope = `ga.game_id IN (SELECT g.id FROM games g WHERE g.host_id=${teacherId} OR g.kit_id IN (SELECT k.id FROM question_kits k WHERE k.teacher_id=${teacherId}))`;
    const allStudents = await dbAll(`SELECT DISTINCT u.id, u.name, u.email, u.created_at,
      (SELECT GROUP_CONCAT(c2.name, ', ') FROM classroom_students cs2 JOIN classrooms c2 ON cs2.classroom_id=c2.id WHERE cs2.student_id=u.id AND (c2.teacher_id=${teacherId} OR c2.id IN (SELECT ct2.classroom_id FROM classroom_teachers ct2 WHERE ct2.teacher_id=${teacherId}))) as classrooms,
      (SELECT COUNT(*) FROM game_answers ga WHERE ga.user_id=u.id AND ${teacherGameScope}) as total_questions,
      (SELECT SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga WHERE ga.user_id=u.id AND ${teacherGameScope}) as correct_answers,
      (SELECT COUNT(DISTINCT ga.game_id) FROM game_answers ga WHERE ga.user_id=u.id AND ${teacherGameScope}) as games_played,
      (SELECT AVG(ga.time_taken) FROM game_answers ga WHERE ga.user_id=u.id AND ga.time_taken>0 AND ${teacherGameScope}) as avg_speed,
      (SELECT MAX(ga.answered_at) FROM game_answers ga WHERE ga.user_id=u.id AND ${teacherGameScope}) as last_active,
      (SELECT COUNT(*) FROM assignment_submissions asub JOIN assignments a ON asub.assignment_id=a.id JOIN classrooms c3 ON a.classroom_id=c3.id WHERE asub.student_id=u.id AND asub.status='completed' AND (c3.teacher_id=${teacherId} OR c3.id IN (SELECT ct3.classroom_id FROM classroom_teachers ct3 WHERE ct3.teacher_id=${teacherId}))) as assignments_completed,
      (SELECT COUNT(*) FROM assignment_submissions asub2 JOIN assignments a2 ON asub2.assignment_id=a2.id JOIN classrooms c4 ON a2.classroom_id=c4.id WHERE asub2.student_id=u.id AND (c4.teacher_id=${teacherId} OR c4.id IN (SELECT ct4.classroom_id FROM classroom_teachers ct4 WHERE ct4.teacher_id=${teacherId}))) as assignments_total
      FROM users u JOIN classroom_students cs ON cs.student_id=u.id JOIN classrooms c ON cs.classroom_id=c.id
      WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) AND cs.status='accepted' ORDER BY u.name`, [teacherId, teacherId]);

    // Per-student per-classroom performance
    const studentClassPerf = await dbAll(`SELECT u.id as student_id, u.name as student_name, c.id as classroom_id, c.name as classroom_name, (SELECT COUNT(*) FROM game_answers ga JOIN games g ON ga.game_id=g.id JOIN question_kits k ON g.kit_id=k.id JOIN assignments a ON a.kit_id=k.id AND a.classroom_id=c.id WHERE ga.user_id=u.id) as questions_in_class, (SELECT SUM(CASE WHEN ga2.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga2 JOIN games g2 ON ga2.game_id=g2.id JOIN question_kits k2 ON g2.kit_id=k2.id JOIN assignments a2 ON a2.kit_id=k2.id AND a2.classroom_id=c.id WHERE ga2.user_id=u.id) as correct_in_class FROM users u JOIN classroom_students cs ON cs.student_id=u.id JOIN classrooms c ON cs.classroom_id=c.id WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) AND cs.status='accepted' ORDER BY c.name, u.name`, [teacherId, teacherId]);

    // All assignments with completion data
    const assignments = await dbAll(`SELECT a.id, a.title, a.instructions, a.due_date, a.due_time, a.requirements, a.created_at, c.name as classroom_name, k.title as kit_title, (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.assignment_id=a.id) as total_students, (SELECT COUNT(*) FROM assignment_submissions asub2 WHERE asub2.assignment_id=a.id AND asub2.status='completed') as completed, (SELECT AVG(asub3.score) FROM assignment_submissions asub3 WHERE asub3.assignment_id=a.id AND asub3.status='completed') as avg_score, (SELECT AVG(CAST(asub4.correct_answers AS FLOAT)/NULLIF(asub4.questions_answered,0)*100) FROM assignment_submissions asub4 WHERE asub4.assignment_id=a.id AND asub4.status='completed') as avg_accuracy FROM assignments a JOIN classrooms c ON a.classroom_id=c.id LEFT JOIN question_kits k ON a.kit_id=k.id WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) ORDER BY a.due_date DESC`, [teacherId, teacherId]);

    // Individual assignment submissions
    const submissions = await dbAll(`SELECT asub.*, u.name as student_name, u.email as student_email, a.title as assignment_title, c.name as classroom_name FROM assignment_submissions asub JOIN users u ON asub.student_id=u.id JOIN assignments a ON asub.assignment_id=a.id JOIN classrooms c ON a.classroom_id=c.id WHERE (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) ORDER BY a.title, u.name`, [teacherId, teacherId]);

    // Per-kit performance across students
    const kitPerformance = await dbAll(`SELECT k.title as kit_name, k.subject, COUNT(DISTINCT gp.user_id) as unique_players, COUNT(DISTINCT gp.game_id) as times_played, (SELECT COUNT(*) FROM game_answers ga JOIN games g2 ON ga.game_id=g2.id WHERE g2.kit_id=k.id) as total_questions, (SELECT SUM(CASE WHEN ga2.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga2 JOIN games g2 ON ga2.game_id=g2.id WHERE g2.kit_id=k.id) as total_correct, (SELECT AVG(ga3.time_taken) FROM game_answers ga3 JOIN games g3 ON ga3.game_id=g3.id WHERE g3.kit_id=k.id AND ga3.time_taken>0) as avg_time FROM question_kits k JOIN games g ON g.kit_id=k.id JOIN game_participants gp ON gp.game_id=g.id WHERE k.teacher_id=? GROUP BY k.id ORDER BY times_played DESC`, [teacherId]);

    // Hardest questions across all kits
    const hardestQuestions = await dbAll(`SELECT q.question_text, q.answer_type, k.title as kit_name, COUNT(*) as times_answered, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as times_correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN question_kits k ON q.kit_id=k.id WHERE k.teacher_id=? GROUP BY ga.question_id HAVING times_answered>=3 ORDER BY CAST(times_correct AS FLOAT)/times_answered ASC LIMIT 100`, [teacherId]);

    // Recent games hosted by this teacher
    const recentGames = await dbAll(`SELECT g.game_code, g.game_mode, g.created_at, g.status, k.title as kit_name, (SELECT COUNT(*) FROM game_participants gp WHERE gp.game_id=g.id) as players, (SELECT AVG(gp2.score) FROM game_participants gp2 WHERE gp2.game_id=g.id) as avg_score, (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.is_correct=1) as total_correct, (SELECT COUNT(*) FROM game_answers ga2 WHERE ga2.game_id=g.id) as total_answers FROM games g LEFT JOIN question_kits k ON g.kit_id=k.id WHERE g.host_id=? ORDER BY g.created_at DESC LIMIT 200`, [teacherId]);

    // Student question-type breakdown (which types your students struggle with)
    const studentTypeBreakdown = await dbAll(`SELECT q.answer_type, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id WHERE g.host_id=? GROUP BY q.answer_type ORDER BY total DESC`, [teacherId]);

    const TL = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill in Blank', math_equation: 'Math' };

    // ── Build workbook ──
    const wb = XLSX.utils.book_new();

    // 1. Overview
    const ws1d = [
      ['BLAZES TEACHER REPORT', '', ''], [],
      ['Teacher', teacher?.name || '', ''],
      ['Email', teacher?.email || '', ''],
      ['Generated', new Date().toLocaleString(), ''],
      [],
      ['SUMMARY', '', ''],
      ['Total Classrooms', classrooms?.length || 0, ''],
      ['Total Students', allStudents?.length || 0, ''],
      ['Total Kits Created', kits?.length || 0, ''],
      ['Total Assignments', assignments?.length || 0, ''],
      ['Games Hosted', recentGames?.length || 0, ''],
      [],
      ['CLASSROOM OVERVIEW', '', ''],
      ['Classroom', 'Students', 'Assignments'],
      ...(classrooms || []).map(c => [c.name, c.student_count, c.assignment_count]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1d);
    ws1['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

    // 2. Student Roster (the main one)
    const ws2d = [['Student', 'Email', 'Classrooms', 'Games Played', 'Questions Answered', 'Correct', 'Accuracy %', 'Avg Speed (s)', 'Assignments Done', 'Assignments Total', 'Completion %', 'Last Active', 'Status'],
      ...(allStudents || []).map(s => {
        const acc = pct(v(s.correct_answers), v(s.total_questions));
        const compPct = pct(v(s.assignments_completed), v(s.assignments_total));
        let status = 'Active';
        if (!s.last_active) status = 'Never Played';
        else if (new Date(s.last_active) < new Date(Date.now() - 14 * 86400000)) status = 'Inactive (14d+)';
        else if (new Date(s.last_active) < new Date(Date.now() - 7 * 86400000)) status = 'Inactive (7d+)';
        return [s.name, s.email, s.classrooms || '', v(s.games_played), v(s.total_questions), v(s.correct_answers), acc, f1(s.avg_speed), v(s.assignments_completed), v(s.assignments_total), compPct, s.last_active || 'Never', status];
      })];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2d);
    ws2['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Student Roster');

    // 3. Assignments
    const ws3d = [['Assignment', 'Classroom', 'Kit', 'Due Date', 'Due Time', 'Students', 'Completed', 'Completion %', 'Avg Score', 'Avg Accuracy %', 'Created'],
      ...(assignments || []).map(a => {
        const reqs = typeof a.requirements === 'string' ? JSON.parse(a.requirements || '{}') : (a.requirements || {});
        return [a.title, a.classroom_name, a.kit_title || '', a.due_date || '', a.due_time || '', a.total_students, a.completed, pct(a.completed, a.total_students), a.avg_score ? Math.round(a.avg_score) : '', a.avg_accuracy ? Math.round(a.avg_accuracy) : '', a.created_at];
      })];
    const ws3 = XLSX.utils.aoa_to_sheet(ws3d);
    ws3['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Assignments');

    // 4. Assignment Submissions (every student × assignment)
    const ws4d = [['Assignment', 'Classroom', 'Student', 'Email', 'Status', 'Questions Answered', 'Correct', 'Accuracy %', 'Score', 'Completed At'],
      ...(submissions || []).map(s => [s.assignment_title, s.classroom_name, s.student_name, s.student_email, s.status, v(s.questions_answered), v(s.correct_answers), pct(v(s.correct_answers), v(s.questions_answered)), v(s.score), s.completed_at || ''])];
    const ws4 = XLSX.utils.aoa_to_sheet(ws4d);
    ws4['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 26 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Submissions');

    // 5. Kit Performance
    const ws5d = [['Kit', 'Subject', 'Unique Players', 'Times Played', 'Questions Answered', 'Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(kitPerformance || []).map(k => [k.kit_name, k.subject || '', k.unique_players, k.times_played, v(k.total_questions), v(k.total_correct), pct(v(k.total_correct), v(k.total_questions)), f1(k.avg_time)])];
    const ws5 = XLSX.utils.aoa_to_sheet(ws5d);
    ws5['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Kit Performance');

    // 6. Hardest Questions
    const ws6d = [['Question', 'Type', 'Kit', 'Times Answered', 'Times Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(hardestQuestions || []).map(q => [q.question_text, TL[q.answer_type] || q.answer_type, q.kit_name || '', q.times_answered, q.times_correct, pct(q.times_correct, q.times_answered), f1(q.avg_time)])];
    const ws6 = XLSX.utils.aoa_to_sheet(ws6d);
    ws6['!cols'] = [{ wch: 48 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 13 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws6, 'Hardest Questions');

    // 7. Question Type Breakdown (how students perform per type)
    const ws7d = [['Question Type', 'Total Answered', 'Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(studentTypeBreakdown || []).map(t => [TL[t.answer_type] || t.answer_type, t.total, t.correct, pct(t.correct, t.total), f1(t.avg_time)])];
    const ws7 = XLSX.utils.aoa_to_sheet(ws7d);
    ws7['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws7, 'Question Types');

    // 8. Game History
    const ws8d = [['Date', 'Game Code', 'Mode', 'Kit', 'Players', 'Avg Score', 'Total Correct', 'Total Answers', 'Accuracy %', 'Status'],
      ...(recentGames || []).map(g => [g.created_at, g.game_code, g.game_mode, g.kit_name || '', g.players, g.avg_score ? Math.round(g.avg_score) : '', v(g.total_correct), v(g.total_answers), pct(v(g.total_correct), v(g.total_answers)), g.status])];
    const ws8 = XLSX.utils.aoa_to_sheet(ws8d);
    ws8['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws8, 'Game History');

    // 9. All Kits
    const ws9d = [['Kit Title', 'Subject', 'Grade Level', 'Questions', 'Description', 'Created'],
      ...(kits || []).map(k => [k.title, k.subject || '', k.grade_level || '', v(k.question_count), k.description || '', k.created_at])];
    const ws9 = XLSX.utils.aoa_to_sheet(ws9d);
    ws9['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws9, 'All Kits');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `blazes-teacher-report-${(teacher?.name || 'export').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[Teacher Export] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =========== INDIVIDUAL STUDENT REPORT (Teacher Pro) ===========
app.get('/api/export/teacher/:teacherId/student/:studentId', async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    const studentId = parseInt(req.params.studentId);
    const tier = await getUserTier(teacherId);
    if (!['teacher_pro', 'school'].includes(tier)) {
      return res.status(403).json({ error: 'upgrade_required', message: 'Requires Teacher Pro' });
    }
    const v = (x, d = 0) => x != null ? x : d;
    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
    const f1 = (x) => x ? Number(Number(x).toFixed(1)) : '';
    const TL = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill in Blank', math_equation: 'Math' };

    const teacher = await dbGet('SELECT name FROM users WHERE id=?', [teacherId]);
    const student = await dbGet('SELECT name, email, created_at FROM users WHERE id=?', [studentId]);
    const scope = `ga.game_id IN (SELECT g.id FROM games g WHERE g.host_id=${teacherId} OR g.kit_id IN (SELECT k.id FROM question_kits k WHERE k.teacher_id=${teacherId}))`;
    const gameScope = `g.id IN (SELECT g2.id FROM games g2 WHERE g2.host_id=${teacherId} OR g2.kit_id IN (SELECT k.id FROM question_kits k WHERE k.teacher_id=${teacherId}))`;

    // Classrooms this student is in (for this teacher)
    const classrooms = await dbAll(`SELECT c.name FROM classroom_students cs JOIN classrooms c ON cs.classroom_id=c.id WHERE cs.student_id=? AND (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) AND cs.status='accepted'`, [studentId, teacherId, teacherId]);

    // Overall stats (scoped)
    const totals = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time, SUM(ga.points_earned) as points, MIN(ga.answered_at) as first_game, MAX(ga.answered_at) as last_game FROM game_answers ga WHERE ga.user_id=? AND ${scope}`, [studentId]);
    const gamesPlayed = await dbGet(`SELECT COUNT(DISTINCT ga.game_id) as c FROM game_answers ga WHERE ga.user_id=? AND ${scope}`, [studentId]);
    const fastestAnswer = await dbGet(`SELECT MIN(ga.time_taken) as t FROM game_answers ga WHERE ga.user_id=? AND ga.is_correct=1 AND ga.time_taken>0.5 AND ${scope}`, [studentId]);

    // Assignments for this teacher
    const assignments = await dbAll(`SELECT a.title, c.name as classroom, asub.status, asub.questions_answered, asub.correct_answers, asub.score, asub.completed_at, a.due_date, a.due_time FROM assignment_submissions asub JOIN assignments a ON asub.assignment_id=a.id JOIN classrooms c ON a.classroom_id=c.id WHERE asub.student_id=? AND (c.teacher_id=? OR c.id IN (SELECT ct.classroom_id FROM classroom_teachers ct WHERE ct.teacher_id=?)) ORDER BY a.due_date DESC`, [studentId, teacherId, teacherId]);

    // Per-kit performance (scoped)
    const kitPerf = await dbAll(`SELECT k.title, k.subject, COUNT(DISTINCT gp.game_id) as times_played, AVG(gp.score) as avg_score, MAX(gp.score) as best_score, (SELECT COUNT(*) FROM game_answers ga2 JOIN games g2 ON ga2.game_id=g2.id WHERE g2.kit_id=k.id AND ga2.user_id=? AND ${scope.replace(/ga\./g, 'ga2.')}) as q_answered, (SELECT SUM(CASE WHEN ga3.is_correct=1 THEN 1 ELSE 0 END) FROM game_answers ga3 JOIN games g3 ON ga3.game_id=g3.id WHERE g3.kit_id=k.id AND ga3.user_id=? AND ${scope.replace(/ga\./g, 'ga3.')}) as q_correct FROM game_participants gp JOIN games g ON gp.game_id=g.id JOIN question_kits k ON g.kit_id=k.id WHERE gp.user_id=? AND ${gameScope} GROUP BY k.id ORDER BY times_played DESC`, [studentId, studentId, studentId]);

    // Question type breakdown (scoped)
    const typeBreak = await dbAll(`SELECT q.answer_type, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id WHERE ga.user_id=? AND ${scope} GROUP BY q.answer_type ORDER BY total DESC`, [studentId]);

    // Hardest questions for this student (scoped)
    const hardest = await dbAll(`SELECT q.question_text, q.answer_type, k.title as kit, COUNT(*) as seen, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id LEFT JOIN question_kits k ON q.kit_id=k.id WHERE ga.user_id=? AND ${scope} GROUP BY ga.question_id HAVING seen>=2 ORDER BY CAST(correct AS FLOAT)/seen ASC LIMIT 50`, [studentId]);

    // Strongest questions
    const strongest = await dbAll(`SELECT q.question_text, q.answer_type, k.title as kit, COUNT(*) as seen, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN questions q ON ga.question_id=q.id LEFT JOIN question_kits k ON q.kit_id=k.id WHERE ga.user_id=? AND ${scope} GROUP BY ga.question_id HAVING seen>=2 ORDER BY CAST(correct AS FLOAT)/seen DESC LIMIT 50`, [studentId]);

    // Game history (scoped)
    const games = await dbAll(`SELECT g.game_code, g.game_mode, g.created_at, gp.score, k.title as kit, (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=? AND ga.is_correct=1) as correct, (SELECT COUNT(*) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=?) as total, (SELECT AVG(ga.time_taken) FROM game_answers ga WHERE ga.game_id=g.id AND ga.user_id=? AND ga.time_taken>0) as avg_time, (SELECT COUNT(*) FROM game_participants gp2 WHERE gp2.game_id=g.id) as players FROM game_participants gp JOIN games g ON gp.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE gp.user_id=? AND ${gameScope} ORDER BY g.created_at DESC LIMIT 500`, [studentId, studentId, studentId, studentId]);

    // Every answer (scoped)
    const answers = await dbAll(`SELECT ga.answer, ga.is_correct, ga.time_taken, ga.points_earned, ga.answered_at, q.question_text, q.answer_type, q.correct_answer, g.game_code, k.title as kit FROM game_answers ga JOIN questions q ON ga.question_id=q.id JOIN games g ON ga.game_id=g.id LEFT JOIN question_kits k ON g.kit_id=k.id WHERE ga.user_id=? AND ${scope} ORDER BY ga.answered_at DESC LIMIT 2000`, [studentId]);

    // Daily activity (scoped, 90 days)
    const daily = await dbAll(`SELECT DATE(ga.answered_at) as day, COUNT(DISTINCT ga.game_id) as games, COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, SUM(ga.points_earned) as points, AVG(ga.time_taken) as avg_time FROM game_answers ga WHERE ga.user_id=? AND ga.answered_at>=datetime('now','-90 days') AND ${scope} GROUP BY day ORDER BY day DESC`, [studentId]);

    // Subject performance (scoped)
    const subjects = await dbAll(`SELECT qk.subject, COUNT(*) as total, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga JOIN games g ON ga.game_id=g.id JOIN question_kits qk ON g.kit_id=qk.id WHERE ga.user_id=? AND ${scope} GROUP BY qk.subject ORDER BY total DESC`, [studentId]);

    // Weekly trend (scoped)
    const weekly = await dbAll(`SELECT strftime('%Y-W%W', ga.answered_at) as week, COUNT(*) as questions, SUM(CASE WHEN ga.is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(ga.time_taken) as avg_time FROM game_answers ga WHERE ga.user_id=? AND ${scope} GROUP BY week ORDER BY week DESC LIMIT 12`, [studentId]);

    // ── Build workbook ──
    const wb = XLSX.utils.book_new();

    // 1. Overview
    const ws1d = [
      [`STUDENT REPORT: ${student?.name || 'Unknown'}`, '', ''], [],
      ['STUDENT INFO', '', ''],
      ['Name', student?.name || '', ''],
      ['Email', student?.email || '', ''],
      ['Classrooms', classrooms.map(c => c.name).join(', ') || 'None', ''],
      ['Account Created', student?.created_at || '', ''],
      ['Teacher', teacher?.name || '', ''],
      ['Report Date', new Date().toLocaleString(), ''],
      [],
      ['PERFORMANCE (Your class only)', '', ''],
      ['Games Played', v(gamesPlayed?.c), ''],
      ['Questions Answered', v(totals?.total), ''],
      ['Correct Answers', v(totals?.correct), ''],
      ['Accuracy', `${pct(v(totals?.correct), v(totals?.total))}%`, ''],
      ['Total Points', v(totals?.points), ''],
      ['Avg Response Time', totals?.avg_time ? `${Number(totals.avg_time).toFixed(1)}s` : 'N/A', ''],
      ['Fastest Correct', fastestAnswer?.t ? `${Number(fastestAnswer.t).toFixed(1)}s` : 'N/A', ''],
      ['First Activity', totals?.first_game || 'N/A', ''],
      ['Last Activity', totals?.last_game || 'N/A', ''],
      [],
      ['ASSIGNMENTS', '', ''],
      ['Total Assigned', assignments.length, ''],
      ['Completed', assignments.filter(a => a.status === 'completed').length, ''],
      ['Completion Rate', `${pct(assignments.filter(a => a.status === 'completed').length, assignments.length)}%`, ''],
      ['Avg Score', assignments.filter(a => a.score).length > 0 ? Math.round(assignments.filter(a => a.score).reduce((s, a) => s + a.score, 0) / assignments.filter(a => a.score).length) : 'N/A', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1d);
    ws1['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

    // 2. Assignments
    const ws2d = [['Assignment', 'Classroom', 'Due Date', 'Due Time', 'Status', 'Questions', 'Correct', 'Accuracy %', 'Score', 'Completed'],
      ...(assignments || []).map(a => [a.title, a.classroom, a.due_date || '', a.due_time || '', a.status, v(a.questions_answered), v(a.correct_answers), pct(v(a.correct_answers), v(a.questions_answered)), v(a.score), a.completed_at || ''])];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2d);
    ws2['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Assignments');

    // 3. Kit Performance
    const ws3d = [['Kit', 'Subject', 'Times Played', 'Best Score', 'Avg Score', 'Questions', 'Correct', 'Accuracy %'],
      ...(kitPerf || []).map(k => [k.title || '', k.subject || '', k.times_played, v(k.best_score), Math.round(v(k.avg_score)), v(k.q_answered), v(k.q_correct), pct(v(k.q_correct), v(k.q_answered))])];
    const ws3 = XLSX.utils.aoa_to_sheet(ws3d);
    ws3['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Kit Performance');

    // 4. Subject Breakdown
    const ws4d = [['Subject', 'Questions', 'Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(subjects || []).map(s => [s.subject || 'No Subject', s.total, s.correct, pct(s.correct, s.total), f1(s.avg_time)])];
    const ws4 = XLSX.utils.aoa_to_sheet(ws4d);
    ws4['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'By Subject');

    // 5. Question Types
    const ws5d = [['Type', 'Answered', 'Correct', 'Accuracy %', 'Avg Time (s)'],
      ...(typeBreak || []).map(t => [TL[t.answer_type] || t.answer_type, t.total, t.correct, pct(t.correct, t.total), f1(t.avg_time)])];
    const ws5 = XLSX.utils.aoa_to_sheet(ws5d);
    ws5['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Question Types');

    // 6. Weakest Questions
    const ws6d = [['Question', 'Type', 'Kit', 'Seen', 'Correct', 'Accuracy %', 'Avg Time'],
      ...(hardest || []).map(q => [q.question_text || '', TL[q.answer_type] || q.answer_type, q.kit || '', q.seen, q.correct, pct(q.correct, q.seen), f1(q.avg_time)])];
    const ws6 = XLSX.utils.aoa_to_sheet(ws6d);
    ws6['!cols'] = [{ wch: 45 }, { wch: 16 }, { wch: 22 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws6, 'Weakest Questions');

    // 7. Strongest Questions
    const ws7d = [['Question', 'Type', 'Kit', 'Seen', 'Correct', 'Accuracy %', 'Avg Time'],
      ...(strongest || []).map(q => [q.question_text || '', TL[q.answer_type] || q.answer_type, q.kit || '', q.seen, q.correct, pct(q.correct, q.seen), f1(q.avg_time)])];
    const ws7 = XLSX.utils.aoa_to_sheet(ws7d);
    ws7['!cols'] = [{ wch: 45 }, { wch: 16 }, { wch: 22 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws7, 'Strongest Questions');

    // 8. Game History
    const ws8d = [['Date', 'Code', 'Mode', 'Kit', 'Score', 'Correct', 'Total', 'Accuracy %', 'Avg Time', 'Players'],
      ...(games || []).map(g => [g.created_at, g.game_code, g.game_mode, g.kit || '', g.score, g.correct, g.total, pct(g.correct, g.total), f1(g.avg_time), g.players])];
    const ws8 = XLSX.utils.aoa_to_sheet(ws8d);
    ws8['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 7 }, { wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 9 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws8, 'Game History');

    // 9. Every Answer
    const ws9d = [['Date', 'Code', 'Kit', 'Question', 'Type', 'Student Answer', 'Correct Answer', 'Result', 'Time (s)', 'Points'],
      ...(answers || []).map(a => [a.answered_at, a.game_code, a.kit || '', a.question_text || '', TL[a.answer_type] || a.answer_type, a.answer || '', a.correct_answer || '', a.is_correct ? 'Correct' : 'Wrong', f1(a.time_taken), v(a.points_earned)])];
    const ws9 = XLSX.utils.aoa_to_sheet(ws9d);
    ws9['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 18 }, { wch: 38 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 7 }, { wch: 7 }];
    XLSX.utils.book_append_sheet(wb, ws9, 'Every Answer');

    // 10. Daily Activity
    const ws10d = [['Date', 'Games', 'Questions', 'Correct', 'Accuracy %', 'Points', 'Avg Time'],
      ...(daily || []).map(d => [d.day, d.games, d.questions, d.correct, pct(d.correct, d.questions), v(d.points), f1(d.avg_time)])];
    const ws10 = XLSX.utils.aoa_to_sheet(ws10d);
    ws10['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws10, 'Daily Activity');

    // 11. Weekly Trend
    const ws11d = [['Week', 'Questions', 'Correct', 'Accuracy %', 'Avg Time'],
      ...(weekly || []).map(w => [w.week, w.questions, w.correct, pct(w.correct, w.questions), f1(w.avg_time)])];
    const ws11 = XLSX.utils.aoa_to_sheet(ws11d);
    ws11['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws11, 'Weekly Trend');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `blazes-student-report-${(student?.name || 'student').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[Student Export] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =========== AI QUIZ GENERATION ===========

async function generateQuiz(sourceText, questionCount, difficulty, questionTypes) {
  if (!groq) throw new Error('AI not configured');

  const allTypes = ['multiple_choice', 'true_false', 'multi_select', 'ordering', 'matching'];
  const types = questionTypes && questionTypes.length > 0 ? questionTypes.filter(t => allTypes.includes(t)) : allTypes;
  if (types.length === 0) types.push('multiple_choice');

  const prompt = `You are a quiz question generator for an educational game. Based on the following text, generate exactly ${questionCount} quiz questions using a MIX of these types: ${types.join(', ')}.

TEXT:
${sourceText.substring(0, 8000)}

REQUIREMENTS:
- Difficulty: ${difficulty}
- Use a VARIETY of question types from the list above. Spread them out evenly — do NOT just use one type.
- For multiple_choice: provide 4 options (option_a, option_b, option_c, option_d). correct_answer is the letter: "A", "B", "C", or "D"
- For true_false: correct_answer is "True" or "False". No options needed.
- For multi_select: provide 4 options (option_a through option_d). correct_answer is the correct letters combined, e.g. "AC" or "ABD"
- For ordering: correct_answer is the items in correct order separated by |||, e.g. "First|||Second|||Third|||Fourth"
- For matching: correct_answer is pairs separated by ### with each pair's left and right separated by |||, e.g. "Term1|||Def1###Term2|||Def2###Term3|||Def3"

RESPOND WITH ONLY a JSON array. Each object:
{
  "question_text": "the question",
  "answer_type": "one of the types above",
  "correct_answer": "see format rules above",
  "option_a": "for multiple_choice and multi_select only",
  "option_b": "for multiple_choice and multi_select only",
  "option_c": "for multiple_choice and multi_select only",
  "option_d": "for multiple_choice and multi_select only"
}

Return ONLY the JSON array. No markdown, no explanation.`;

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 6000,
  });

  const text = result.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('AI returned empty response');

  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
  const questions = JSON.parse(jsonMatch ? jsonMatch[0] : jsonStr);

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('AI generated no questions');
  }

  const validTypes = [...allTypes, 'image_label'];
  return questions.slice(0, questionCount).map(q => ({
    question_text: q.question_text || '',
    answer_type: validTypes.includes(q.answer_type) ? q.answer_type : 'multiple_choice',
    correct_answer: q.correct_answer || 'A',
    option_a: q.option_a || '',
    option_b: q.option_b || '',
    option_c: q.option_c || '',
    option_d: q.option_d || '',
  })).filter(q => q.question_text.length > 0);
}

app.post('/api/ai/generate-from-notes', async (req, res) => {
  try {
    const { notes, questionCount = 10, difficulty = 'medium', questionTypes = ['multiple_choice'], userId } = req.body;
    if (!notes || notes.trim().length < 20) return res.status(400).json({ error: 'Please provide at least 20 characters of notes' });
    if (userId) {
      const limit = await checkAiLimit(userId, 'quiz_generate');
      if (!limit.allowed) {
        if (limit.reason === 'upgrade_required') return res.status(403).json({ error: 'upgrade_required', message: 'AI Quiz Generation requires Blazes Plus or higher', requiredTier: 'blazes_plus' });
        return res.status(429).json({ error: 'daily_limit', message: `AI quiz limit reached (${limit.used}/${limit.limit} today). Resets at midnight.`, used: limit.used, limit: limit.limit });
      }
    }
    const questions = await generateQuiz(notes, questionCount, difficulty, questionTypes);
    if (userId) await trackAiUsage(userId, 'quiz_generate');
    console.log(`[AI] Generated ${questions.length} questions from notes (${notes.length} chars)`);
    res.json({ questions });
  } catch (err) {
    console.error('[AI] Generation error:', err.message || err);
    res.status(500).json({ error: 'AI error: ' + (err.message || 'Unknown error') });
  }
});

app.post('/api/ai/generate-from-pdf', async (req, res) => {
  try {
    const { text, questionCount = 10, difficulty = 'medium', questionTypes = ['multiple_choice'], userId } = req.body;
    if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Could not extract enough text from the document' });
    if (userId) {
      const limit = await checkAiLimit(userId, 'quiz_generate');
      if (!limit.allowed) {
        if (limit.reason === 'upgrade_required') return res.status(403).json({ error: 'upgrade_required', message: 'AI Quiz Generation requires Blazes Plus or higher', requiredTier: 'blazes_plus' });
        return res.status(429).json({ error: 'daily_limit', message: `AI quiz limit reached (${limit.used}/${limit.limit} today). Resets at midnight.`, used: limit.used, limit: limit.limit });
      }
    }
    const questions = await generateQuiz(text, questionCount, difficulty, questionTypes);
    if (userId) await trackAiUsage(userId, 'quiz_generate');
    console.log(`[AI] Generated ${questions.length} questions from PDF (${text.length} chars)`);
    res.json({ questions });
  } catch (err) {
    console.error('[AI] PDF generation error:', err.message || err);
    res.status(500).json({ error: 'AI error: ' + (err.message || 'Unknown error') });
  }
});

app.post('/api/ai/extract-pdf', express.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(req.body);
    res.json({ text: data.text, pages: data.numpages });
  } catch (err) {
    console.error('[AI] PDF parse error:', err);
    res.status(500).json({ error: 'Failed to read PDF' });
  }
});

// AI usage status endpoint
app.get('/api/ai/usage/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const tier = await getUserTier(userId);
    if (!['blazes_plus', 'teacher_pro', 'school'].includes(tier)) {
      return res.json({ tier: 'free', features: {} });
    }
    const features = {};
    for (const [feature, limits] of Object.entries(AI_DAILY_LIMITS)) {
      const usage = await dbGet(
        `SELECT COUNT(*) as count FROM ai_usage WHERE user_id = ? AND feature = ? AND date(used_at) = date('now')`,
        [userId, feature]
      );
      features[feature] = { used: usage?.count || 0, limit: limits[tier] || 0 };
    }
    res.json({ tier, features });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== SEASON PACKS ===========
const PACK_DATA = {
  mythological: {
    cost: 30,
    season: 1,
    skins: [
      { id: 'zeus', chance: 2, tier: 'Mythic' },
      { id: 'poseidon', chance: 2, tier: 'Mythic' },
      { id: 'hades', chance: 4, tier: 'Legendary' },
      { id: 'athena', chance: 4, tier: 'Legendary' },
      { id: 'ares', chance: 7, tier: 'Epic' },
      { id: 'apollo', chance: 7, tier: 'Epic' },
      { id: 'medusa', chance: 7, tier: 'Epic' },
      { id: 'artemis', chance: 10, tier: 'Rare' },
      { id: 'hermes', chance: 10, tier: 'Rare' },
      { id: 'aphrodite', chance: 10, tier: 'Rare' },
      { id: 'hephaestus', chance: 13, tier: 'Uncommon' },
      { id: 'dionysus', chance: 12, tier: 'Uncommon' },
      { id: 'demeter', chance: 12, tier: 'Uncommon' },
    ]
  }
};

function rollPack(packId) {
  const pack = PACK_DATA[packId];
  if (!pack) return null;
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const skin of pack.skins) {
    cumulative += skin.chance;
    if (rand < cumulative) return skin;
  }
  return pack.skins[pack.skins.length - 1]; // fallback
}

app.post('/api/packs/open', async (req, res) => {
  try {
    const { userId, packId, count } = req.body;
    const openCount = Math.min(Math.max(1, parseInt(count) || 1), 50);
    const pack = PACK_DATA[packId];
    if (!pack) return res.status(400).json({ error: 'Invalid pack' });

    const totalCost = pack.cost * openCount;

    // Check balance
    const bb = await dbGet('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId]);
    if (!bb || bb.balance < totalCost) {
      return res.status(400).json({ error: 'Not enough BlazesBucks', required: totalCost, balance: bb?.balance || 0 });
    }

    // Deduct BB
    await dbRun('UPDATE blazes_bucks SET balance = balance - ? WHERE user_id = ?', [totalCost, userId]);

    // Roll skins
    const results = [];
    for (let i = 0; i < openCount; i++) {
      const skin = rollPack(packId);
      if (skin) {
        results.push(skin);
        // Grant skin (ignore if already owned)
        try {
          await dbRun('INSERT INTO user_skins (user_id, skin_id, skin_type) VALUES (?, ?, ?)', [userId, skin.id, 'avatar']);
        } catch (insertErr) {
          console.log('[Packs] Insert skin failed (likely unique constraint still present):', insertErr.message);
        }
      }
    }

    // Get new balance
    const newBB = await dbGet('SELECT balance FROM blazes_bucks WHERE user_id = ?', [userId]);

    res.json({
      results,
      newBalance: newBB?.balance || 0,
      cost: totalCost
    });
  } catch (err) {
    console.error('[Packs] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packs/available', async (req, res) => {
  try {
    res.json(Object.entries(PACK_DATA).map(([id, pack]) => ({
      id,
      cost: pack.cost,
      season: pack.season,
      skinCount: pack.skins.length,
      skins: pack.skins.map(s => ({ id: s.id, tier: s.tier, chance: s.chance }))
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== PAYMENTS (STRIPE) ===========

// Get user subscription status
app.get('/api/subscription/:userId', async (req, res) => {
  try {
    const user = await dbGet('SELECT role, subscription_tier, subscription_expires, stripe_customer_id, trial_used FROM users WHERE id = ?', [req.params.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tier = await getUserTier(req.params.userId);
    // Eligible for the one-shot 3-day trial: teacher, on free tier, hasn't used it yet.
    const trialEligible = user.role === 'teacher' && tier === 'free' && !user.trial_used;
    res.json({
      tier,
      expires: user.subscription_expires,
      hasStripeCustomer: !!user.stripe_customer_id,
      trialUsed: !!user.trial_used,
      trialEligible,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activate the 3-day Teacher Pro free trial. Server-validated: must be teacher,
// must currently be on free, must not have used the trial before. Sets the
// expiry timestamp and flips trial_used so the trial can never be replayed.
app.post('/api/subscription/start-trial', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const user = await dbGet('SELECT role, subscription_tier, trial_used FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'teacher') return res.status(403).json({ error: 'Trial is for teachers only' });
    if (user.trial_used) return res.status(403).json({ error: 'You have already used your free trial' });
    const currentTier = await getUserTier(userId);
    if (currentTier !== 'free') return res.status(403).json({ error: 'Trial unavailable while another plan is active' });
    const expires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await dbRun(
      `UPDATE users SET subscription_tier = 'teacher_pro', subscription_expires = ?, trial_used = 1 WHERE id = ?`,
      [expires, userId]
    );
    res.json({ message: 'Trial started', tier: 'teacher_pro', expires });
  } catch (err) {
    console.error('[start-trial]', err);
    res.status(500).json({ error: err.message });
  }
});

// Create Stripe checkout session
app.post('/api/payments/checkout', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  try {
    const { userId, plan } = req.body;
    const user = await dbGet('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(userId) } });
      customerId = customer.id;
      await dbRun('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
    }

    const baseUrl = FRONTEND_URL;
    let sessionConfig;

    if (plan === 'teacher_pro') {
      sessionConfig = {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price_data: {
          currency: 'usd', product_data: { name: 'Blazes Teacher Pro', description: 'Unlimited students, AI tools, all question types, advanced analytics' },
          unit_amount: 1299, recurring: { interval: 'month' }
        }, quantity: 1 }],
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
        metadata: { userId: String(userId), plan: 'teacher_pro' }
      };
    } else if (plan === 'blazes_plus') {
      sessionConfig = {
        mode: 'payment',
        customer: customerId,
        line_items: [{ price_data: {
          currency: 'usd', product_data: { name: 'Blazes Plus', description: 'All features unlocked: AI tools, 1.5x XP, 2x BB, all skins, all question types, flashcards, 90 days' },
          unit_amount: 999
        }, quantity: 1 }],
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
        metadata: { userId: String(userId), plan: 'blazes_plus' }
      };
    } else if (plan.startsWith('bb_')) {
      const bbPacks = { bb_500: { amount: 99, bb: 500 }, bb_3000: { amount: 499, bb: 3000 }, bb_7000: { amount: 999, bb: 7000 }, bb_15000: { amount: 1999, bb: 15000 } };
      const pack = bbPacks[plan];
      if (!pack) return res.status(400).json({ error: 'Invalid BB pack' });
      sessionConfig = {
        mode: 'payment',
        customer: customerId,
        line_items: [{ price_data: {
          currency: 'usd', product_data: { name: `${pack.bb.toLocaleString()} BlazesBucks` },
          unit_amount: pack.amount
        }, quantity: 1 }],
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
        metadata: { userId: String(userId), plan, bb: String(pack.bb) }
      };
    } else {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.userId);
      const plan = session.metadata?.plan;
      if (!userId || !plan) return res.json({ received: true });

      if (plan === 'teacher_pro') {
        await dbRun("UPDATE users SET subscription_tier = 'teacher_pro', subscription_id = ? WHERE id = ?",
          [session.subscription, userId]);
        console.log(`[Stripe] Teacher Pro activated for user ${userId}`);
      } else if (plan === 'blazes_plus') {
        const expires = new Date(Date.now() + 90 * 86400000).toISOString();
        await dbRun("UPDATE users SET subscription_tier = 'blazes_plus', subscription_expires = ? WHERE id = ?",
          [expires, userId]);
        // Grant ALL season pack skins
        for (const packId of Object.keys(PACK_DATA)) {
          const pack = PACK_DATA[packId];
          for (const skin of pack.skins) {
            const already = await dbGet('SELECT id FROM user_skins WHERE user_id = ? AND skin_id = ?', [userId, skin.id]);
            if (!already) {
              await dbRun('INSERT INTO user_skins (user_id, skin_id) VALUES (?, ?)', [userId, skin.id]);
            }
          }
        }
        console.log(`[Stripe] Blazes Plus activated for user ${userId}, expires ${expires} — all pack skins granted`);
      } else if (plan.startsWith('bb_')) {
        const bb = parseInt(session.metadata?.bb) || 0;
        if (bb > 0) {
          await dbRun(
            `INSERT INTO blazes_bucks (user_id, balance) VALUES (?, ?)
             ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
            [userId, bb, bb]
          );
          console.log(`[Stripe] ${bb} BB credited to user ${userId}`);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const userId = parseInt(customer.metadata?.userId);
      if (userId) {
        await dbRun("UPDATE users SET subscription_tier = 'free', subscription_id = NULL WHERE id = ?", [userId]);
        console.log(`[Stripe] Subscription cancelled for user ${userId}`);
      }
    }
  } catch (err) {
    console.error('[Stripe] Webhook processing error:', err);
  }

  res.json({ received: true });
});

// Cancel subscription
app.post('/api/payments/cancel', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  try {
    const { userId } = req.body;
    const user = await dbGet('SELECT subscription_id FROM users WHERE id = ?', [userId]);
    if (!user?.subscription_id) return res.status(400).json({ error: 'No active subscription' });
    await stripe.subscriptions.cancel(user.subscription_id);
    await dbRun("UPDATE users SET subscription_tier = 'free', subscription_id = NULL WHERE id = ?", [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Stripe] Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Direct plan downgrade (for non-Stripe plans or manual management)
app.post('/api/subscription/downgrade', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    // If they have a Stripe subscription, try to cancel it
    const user = await dbGet('SELECT subscription_id FROM users WHERE id = ?', [userId]);
    if (user?.subscription_id && stripe) {
      try { await stripe.subscriptions.cancel(user.subscription_id); } catch (_) {}
    }
    await dbRun("UPDATE users SET subscription_tier = 'free', subscription_id = NULL, subscription_expires = NULL WHERE id = ?", [userId]);
    res.json({ success: true, tier: 'free' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== SETTINGS ===========
app.get('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await dbRun('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);
    const settings = await dbGet('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const allowed = ['notify_assignments','notify_achievements','notify_game_invites','notify_classroom',
      'sound_enabled','animations_enabled','timer_warnings','font_size','reduce_motion',
      'leaderboard_visible','activity_visible'];
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(req.body)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); values.push(val); }
    }
    if (updates.length === 0) return res.json({ success: true });
    await dbRun('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);
    await dbRun(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`, [...values, userId]);
    const settings = await dbGet('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Set role based on birthday (for new Google sign-ups)
app.post('/api/auth/set-role', async (req, res) => {
  try {
    const { userId, role, birthday } = req.body;
    if (!userId || !role) return res.status(400).json({ error: 'Missing userId or role' });
    if (role !== 'teacher' && role !== 'student') return res.status(400).json({ error: 'Invalid role' });
    const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'pending') return res.status(400).json({ error: 'Role already set' });
    // Teachers must be 18+
    if (role === 'teacher') {
      if (!birthday) return res.status(400).json({ error: 'Birthday required for teacher accounts' });
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 18) return res.status(400).json({ error: 'You must be 18 or older to create a teacher account' });
    }
    await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/auth/change-name', async (req, res) => {
  try {
    const { userId, name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    await dbRun('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
    const user = await dbGet('SELECT id, email, name, role FROM users WHERE id = ?', [userId]);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/auth/change-email', async (req, res) => {
  try {
    const { userId, newEmail, password } = req.body;
    if (!newEmail?.trim()) return res.status(400).json({ error: 'Email is required' });
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password) {
      if (!password) return res.status(400).json({ error: 'Password required to change email' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(403).json({ error: 'Incorrect password' });
    }
    const existing = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail.toLowerCase().trim(), userId]);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    await dbRun('UPDATE users SET email = ? WHERE id = ?', [newEmail.toLowerCase().trim(), userId]);
    const updated = await dbGet('SELECT id, email, name, role FROM users WHERE id = ?', [userId]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(403).json({ error: 'Incorrect current password' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    await dbRun('UPDATE users SET password_changed_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/auth/delete-account/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password) {
      if (!password) return res.status(400).json({ error: 'Password required' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(403).json({ error: 'Incorrect password' });
    }
    const tables = [
      ['user_settings', 'user_id'],
      ['user_stats', 'user_id'],
      ['user_equipped', 'user_id'],
      ['user_achievements', 'user_id'],
      ['blazes_bucks', 'user_id'],
      ['blazes_bucks_log', 'user_id'],
      ['bb_daily_tracker', 'user_id'],
      ['season_progress', 'user_id'],
      ['season_xp_log', 'user_id'],
      ['season_badges', 'user_id'],
      ['game_participants', 'user_id'],
      ['game_answers', 'user_id'],
      ['notifications', 'user_id'],
      ['classroom_students', 'student_id'],
      ['assignment_submissions', 'student_id'],
    ];
    for (const [table, col] of tables) {
      await dbRun(`DELETE FROM ${table} WHERE ${col} = ?`, [userId]);
    }
    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== NOTIFICATIONS ===========
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await dbAll(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.userId]);
    res.json(notifications || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/:userId/count', async (req, res) => {
  try {
    const row = await dbGet('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [req.params.userId]);
    res.json({ count: row?.c || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.notificationId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/:userId/read-all', async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.params.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notifications/:userId/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM notifications WHERE user_id = ?', [req.params.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const nodemailer = require('nodemailer');

app.post('/api/contact', async (req, res) => {
  const { name, email, category, message } = req.body;
  if (!category || !message) {
    return res.status(400).json({ error: 'Category and message are required.' });
  }

  // HTML-escape user input to prevent injection
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.CONTACT_EMAIL_USER,
        pass: process.env.CONTACT_EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Blazes Contact" <${process.env.CONTACT_EMAIL_USER}>`,
      to: process.env.CONTACT_EMAIL_USER,
      subject: `[Blazes] ${esc(category)}${name ? ` — from ${esc(name)}` : ''}`,
      html: `
        <h2>New Contact Form Submission</h2>
        ${name ? `<p><strong>Name:</strong> ${esc(name)}</p>` : '<p><strong>Name:</strong> <em>Not provided</em></p>'}
        ${email ? `<p><strong>Email:</strong> ${esc(email)}</p>` : '<p><strong>Email:</strong> <em>Not provided</em></p>'}
        <p><strong>Category:</strong> ${esc(category)}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <p>${esc(message).replace(/\n/g, '<br/>')}</p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Contact] email error:', err);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// =========== ARENA MODE ===========
// Costs in score (only currency). Earn 10/correct → prices tuned for ~2-4 question commitments.
// Damage > cost so attacks profit you relative to target — but absolute spend hurts.
const ARENA_ITEMS = {
  lightning:  { name: 'Lightning Strike', cost: 15, damage: 25 },
  fireball:   { name: 'Fireball',         cost: 30, damage: 15, multiTarget: 3 },
  shield:     { name: 'Shield',           cost: 15, effect: 'shield' },
  mirror:     { name: 'Mirror',           cost: 30, effect: 'mirror' },
  doubleDown: { name: 'Double Down',      cost: 20, effect: 'doubleDown' },
  // Ultimate is awarded by combo 10, not buyable. Pierces shields.
  ultimate:   { name: 'Ultimate Strike',  cost: 0,  damage: 30, piercesShield: true },
};

const ARENA_EVENTS = {
  // Good
  stockCrash:    { type: 'good', name: 'Stock Crash',    desc: 'Shop items 50% off for 30s',                duration: 30 },
  mentorsGift:   { type: 'good', name: "Mentor's Gift",  desc: 'Top 3 each get +20 score',                  duration: 0 },
  // Bad (creates tension)
  taxDay:        { type: 'bad',  name: 'Tax Day',        desc: 'Everyone loses 8% of their score',          duration: 0 },
  shopClosed:    { type: 'bad',  name: 'Shop Closed',    desc: 'Shop disabled for 25s',                     duration: 25 },
  fogOfWar:      { type: 'bad',  name: 'Fog of War',     desc: 'Scores hidden for 30s',                     duration: 30 },
  inflation:     { type: 'bad',  name: 'Inflation',      desc: 'Shop prices doubled for 30s',               duration: 30 },
  // Chaotic
  mysteryBox:    { type: 'chaos',name: 'Mystery Box',    desc: 'Random attack delivered to everyone',       duration: 0 },
};
const ARENA_EVENT_KEYS = Object.keys(ARENA_EVENTS);

// Get arena state for one player
app.get('/api/games/:gameCode/arena/state/:userId', async (req, res) => {
  try {
    const { gameCode, userId } = req.params;
    const game = await dbGet('SELECT id, game_mode FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.game_mode !== 'arena') return res.status(404).json({ error: 'Not an arena game' });

    const me = await dbGet('SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    const inventory = await dbAll('SELECT item_key, COUNT(*) AS qty FROM arena_attacks WHERE game_id = ? AND attacker_id = ? AND target_id = ? GROUP BY item_key', [game.id, userId, userId]);

    // Active events
    const activeEvents = await dbAll(
      `SELECT event_key, started_at, ends_at, payload FROM arena_events
       WHERE game_id = ? AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))
       ORDER BY started_at DESC LIMIT 5`,
      [game.id]
    );

    // Recent incoming attacks (last 10s) — for screen-effect notifications
    const incomingAttacks = await dbAll(
      `SELECT id, attacker_id, item_key, score_delta, created_at FROM arena_attacks
       WHERE game_id = ? AND target_id = ? AND attacker_id != target_id
         AND datetime(created_at) > datetime('now', '-10 seconds')
       ORDER BY created_at DESC`,
      [game.id, userId]
    );

    res.json({
      combo: me?.arena_combo || 0,
      maxCombo: me?.arena_max_combo || 0,
      shields: me?.arena_shields || 0,
      doubleDown: me?.arena_double_down || 0,
      permBonus: me?.arena_perm_bonus || 0,
      score: me?.score || 0,
      activeEvents: activeEvents.map(e => ({
        key: e.event_key,
        info: ARENA_EVENTS[e.event_key],
        startedAt: e.started_at,
        endsAt: e.ends_at,
      })),
      incomingAttacks: incomingAttacks.map(a => ({
        id: a.id,
        attackerId: a.attacker_id,
        itemKey: a.item_key,
        scoreDelta: a.score_delta,
        blocked: a.item_key.startsWith('blocked_'),
        createdAt: a.created_at,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Buy a shop item
app.post('/api/games/:gameCode/arena/buy', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId, itemKey } = req.body;
    const game = await dbGet('SELECT id, game_mode FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.game_mode !== 'arena') return res.status(404).json({ error: 'Not an arena game' });
    const item = ARENA_ITEMS[itemKey];
    if (!item) return res.status(400).json({ error: 'Unknown item' });

    // Check shop closed event
    const shopClosed = await dbGet(`SELECT 1 AS x FROM arena_events WHERE game_id = ? AND event_key = 'shopClosed' AND datetime(ends_at) > datetime('now')`, [game.id]);
    if (shopClosed) return res.status(400).json({ error: 'Shop closed' });

    // Apply pricing modifiers
    const stockCrash = await dbGet(`SELECT 1 AS x FROM arena_events WHERE game_id = ? AND event_key = 'stockCrash' AND datetime(ends_at) > datetime('now')`, [game.id]);
    const inflation = await dbGet(`SELECT 1 AS x FROM arena_events WHERE game_id = ? AND event_key = 'inflation' AND datetime(ends_at) > datetime('now')`, [game.id]);
    let cost = item.cost;
    if (stockCrash) cost = Math.floor(cost / 2);
    if (inflation) cost = cost * 3;

    const me = await dbGet('SELECT score FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    if ((me?.score || 0) < cost) return res.status(400).json({ error: 'Not enough score' });

    await dbRun('UPDATE game_participants SET score = score - ? WHERE game_id = ? AND user_id = ?', [cost, game.id, userId]);

    // Apply effects that don't need a target
    if (item.effect === 'shield') {
      await dbRun('UPDATE game_participants SET arena_shields = arena_shields + 1 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    } else if (item.effect === 'doubleDown') {
      await dbRun('UPDATE game_participants SET arena_double_down = arena_double_down + 1 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    }

    // Items that need a target (lightning, fireball, mirror) — store as inventory
    if (item.damage || item.effect === 'mirror') {
      await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, 0)', [game.id, userId, userId, itemKey]);
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Use an attack item (lightning, fireball)
app.post('/api/games/:gameCode/arena/attack', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId, itemKey, targetUserId } = req.body;
    const game = await dbGet('SELECT id, game_mode FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.game_mode !== 'arena') return res.status(404).json({ error: 'Not an arena game' });
    const item = ARENA_ITEMS[itemKey];
    if (!item || (!item.damage && item.effect !== 'mirror')) return res.status(400).json({ error: 'Not an attack item' });

    // Consume one from inventory
    const owned = await dbGet('SELECT id FROM arena_attacks WHERE game_id = ? AND attacker_id = ? AND target_id = ? AND item_key = ? LIMIT 1', [game.id, userId, userId, itemKey]);
    if (!owned) return res.status(400).json({ error: "You don't own that item" });
    await dbRun('DELETE FROM arena_attacks WHERE id = ?', [owned.id]);

    let targets = [];
    if (item.multiTarget) {
      // Pick random N opponents
      const opps = await dbAll('SELECT user_id FROM game_participants WHERE game_id = ? AND user_id != ?', [game.id, userId]);
      targets = opps.sort(() => Math.random() - 0.5).slice(0, item.multiTarget).map(o => o.user_id);
    } else if (targetUserId) {
      targets = [targetUserId];
    }

    for (const tid of targets) {
      const target = await dbGet('SELECT arena_shields FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, tid]);
      // Ultimate Strike pierces shields
      if (target && target.arena_shields > 0 && !item.piercesShield) {
        await dbRun('UPDATE game_participants SET arena_shields = arena_shields - 1 WHERE game_id = ? AND user_id = ?', [game.id, tid]);
        await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, 0)', [game.id, userId, tid, 'blocked_' + itemKey]);
      } else {
        await dbRun('UPDATE game_participants SET score = MAX(0, score - ?) WHERE game_id = ? AND user_id = ?', [item.damage, game.id, tid]);
        await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, ?)', [game.id, userId, tid, itemKey, -item.damage]);
      }
    }

    await dbRun('UPDATE game_participants SET arena_attacks_dealt = arena_attacks_dealt + ? WHERE game_id = ? AND user_id = ?', [targets.length, game.id, userId]);
    res.json({ success: true, targets });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Trigger a random world event (called by host periodically)
app.post('/api/games/:gameCode/arena/event', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const game = await dbGet('SELECT id, game_mode, host_id FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.game_mode !== 'arena') return res.status(404).json({ error: 'Not an arena game' });

    const eventKey = ARENA_EVENT_KEYS[Math.floor(Math.random() * ARENA_EVENT_KEYS.length)];
    const event = ARENA_EVENTS[eventKey];
    const endsAt = event.duration > 0 ? new Date(Date.now() + event.duration * 1000).toISOString() : null;

    await dbRun('INSERT INTO arena_events (game_id, event_key, ends_at) VALUES (?, ?, ?)', [game.id, eventKey, endsAt]);

    // Apply instant effects (score is the only currency)
    if (eventKey === 'taxDay') {
      await dbRun('UPDATE game_participants SET score = MAX(0, score - CAST(score * 0.08 AS INTEGER)) WHERE game_id = ?', [game.id]);
    } else if (eventKey === 'mentorsGift') {
      const top = await dbAll('SELECT user_id FROM game_participants WHERE game_id = ? ORDER BY score DESC LIMIT 3', [game.id]);
      for (const t of top) await dbRun('UPDATE game_participants SET score = score + 20 WHERE game_id = ? AND user_id = ?', [game.id, t.user_id]);
    } else if (eventKey === 'mysteryBox') {
      // Give random attack item to everyone
      const players = await dbAll('SELECT user_id FROM game_participants WHERE game_id = ?', [game.id]);
      const itemKeys = Object.keys(ARENA_ITEMS).filter(k => ARENA_ITEMS[k].damage || ARENA_ITEMS[k].effect === 'mirror');
      for (const p of players) {
        const randomItem = itemKeys[Math.floor(Math.random() * itemKeys.length)];
        await dbRun('INSERT INTO arena_attacks (game_id, attacker_id, target_id, item_key, score_delta) VALUES (?, ?, ?, ?, 0)', [game.id, p.user_id, p.user_id, randomItem]);
      }
    }

    res.json({ event: { key: eventKey, info: event, endsAt } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get inventory for current user
app.get('/api/games/:gameCode/arena/inventory/:userId', async (req, res) => {
  try {
    const { gameCode, userId } = req.params;
    const game = await dbGet('SELECT id FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const items = await dbAll(
      'SELECT item_key, COUNT(*) AS qty FROM arena_attacks WHERE game_id = ? AND attacker_id = ? AND target_id = ? AND item_key NOT LIKE ? GROUP BY item_key',
      [game.id, userId, userId, 'blocked_%']
    );
    res.json({ items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========== ELEMENTAL CLASH ===========
const ELEMENTAL_ATTACKS = {
  earthquake: { cost: 5, damage: 30 },
  tsunami: { cost: 8, damage: 50 },
  hurricane: { cost: 10, damage: 65 },
  wildfire: { cost: 15, damage: 100 },
};

// Elemental Clash: choose reward after correct answer
app.post('/api/games/:gameCode/elemental-choice', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, questionId, choice } = req.body; // choice: 'energy' | 'team_points'
  try {
    const game = await dbGet('SELECT id FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const participant = await dbGet('SELECT team, energy_points FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });
    if (choice === 'energy') {
      await dbRun('UPDATE game_participants SET energy_points = energy_points + 1 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    } else {
      if (participant.team === 1) {
        await dbRun('UPDATE games SET team_1_score = team_1_score + 10 WHERE id = ?', [game.id]);
      } else {
        await dbRun('UPDATE games SET team_2_score = team_2_score + 10 WHERE id = ?', [game.id]);
      }
      await dbRun('UPDATE game_participants SET score = score + 10 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    }
    const updated = await dbGet('SELECT energy_points FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    const scores = await dbGet('SELECT team_1_score, team_2_score FROM games WHERE id = ?', [game.id]);
    res.json({ success: true, energy: updated.energy_points, team1Score: scores.team_1_score, team2Score: scores.team_2_score });
  } catch (err) {
    console.error('[elemental-choice]', err);
    res.status(500).json({ error: err.message });
  }
});

// Elemental Clash: buy and use an attack
app.post('/api/games/:gameCode/elemental-attack', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, attackType } = req.body;
  try {
    const attack = ELEMENTAL_ATTACKS[attackType];
    if (!attack) return res.status(400).json({ error: 'Invalid attack type' });
    const game = await dbGet('SELECT id, status FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.status !== 'started') return res.status(400).json({ error: 'Game not active' });
    // Atomic deduct energy
    const changed = await dbRun('UPDATE game_participants SET energy_points = energy_points - ? WHERE game_id = ? AND user_id = ? AND energy_points >= ?', [attack.cost, game.id, userId, attack.cost]);
    if (!changed) return res.status(400).json({ error: 'Not enough energy' });
    const participant = await dbGet('SELECT team FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    const targetTeam = participant.team === 1 ? 2 : 1;
    if (targetTeam === 1) {
      await dbRun('UPDATE games SET team_1_score = MAX(0, team_1_score - ?) WHERE id = ?', [attack.damage, game.id]);
    } else {
      await dbRun('UPDATE games SET team_2_score = MAX(0, team_2_score - ?) WHERE id = ?', [attack.damage, game.id]);
    }
    await dbRun('INSERT INTO elemental_attacks (game_id, attacker_user_id, attack_type, energy_cost, damage, target_team) VALUES (?, ?, ?, ?, ?, ?)',
      [game.id, userId, attackType, attack.cost, attack.damage, targetTeam]);
    const updated = await dbGet('SELECT energy_points FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    const scores = await dbGet('SELECT team_1_score, team_2_score FROM games WHERE id = ?', [game.id]);
    res.json({ success: true, energy: updated.energy_points, team1Score: scores.team_1_score, team2Score: scores.team_2_score });
  } catch (err) {
    console.error('[elemental-attack]', err);
    res.status(500).json({ error: err.message });
  }
});

// Elemental Clash: poll game state
app.get('/api/games/:gameCode/elemental-state', async (req, res) => {
  const { gameCode } = req.params;
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  try {
    const game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);
    // Auto-end if time is up
    if (game.status === 'started' && game.started_at && game.settings?.timeLimit) {
      const elapsed = (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
      if (elapsed >= game.settings.timeLimit) {
        await dbRun(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'started'`, [game.id]);
        game.status = 'ended';
      }
    }
    const questions = await dbAll('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id]);
    const safeQuestions = questions.map(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      const correctRaw = (q.correct_answer || '').toUpperCase().trim();
      const letter = correctRaw.match(/[A-D](?!.*[A-D])/);
      return { id: q.id, text: q.question_text, options: opts, correctAnswer: letter ? ['A','B','C','D'].indexOf(letter[0]) : 0, imageUrl: q.image_url || null };
    });
    const participants = await dbAll('SELECT user_id, player_name, score, team, energy_points FROM game_participants WHERE game_id = ?', [game.id]);
    // Time left
    let timeLeft = null;
    if (game.status === 'started' && game.started_at && game.settings?.timeLimit) {
      const elapsed = (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
      timeLeft = Math.max(0, game.settings.timeLimit - elapsed);
    }
    // Recent attacks (last 15 seconds)
    const recentAttacks = await dbAll(
      `SELECT * FROM elemental_attacks WHERE game_id = ? AND created_at >= datetime('now', '-15 seconds') ORDER BY created_at DESC`,
      [game.id]
    );
    // My participant
    let myParticipant = null;
    if (userId) {
      myParticipant = await dbGet('SELECT team, energy_points, score FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    }
    res.json({
      status: game.status,
      team1Score: game.team_1_score || 0,
      team2Score: game.team_2_score || 0,
      settings: game.settings,
      started_at: game.started_at,
      timeLeft,
      questions: safeQuestions,
      participants,
      recentAttacks,
      myTeam: myParticipant?.team,
      myEnergy: myParticipant?.energy_points || 0,
      myScore: myParticipant?.score || 0,
    });
  } catch (err) {
    console.error('[elemental-state]', err);
    res.status(500).json({ error: err.message });
  }
});

// =========== ELEMENTAL WAGER (Risk & Reward) ===========
app.get('/api/games/:gameCode/wager-state', async (req, res) => {
  const { gameCode } = req.params;
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  try {
    let game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);
    // Auto-end if time is up
    if (game.status === 'started' && game.started_at && game.settings?.timeLimit) {
      const elapsed = (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
      if (elapsed >= game.settings.timeLimit) {
        await dbRun(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'started'`, [game.id]);
        game.status = 'ended';
      }
    }
    const questions = await dbAll('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id]);
    const safeQuestions = questions.map(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      const correctRaw = (q.correct_answer || '').toUpperCase().trim();
      const letter = correctRaw.match(/[A-D](?!.*[A-D])/);
      return { id: q.id, text: q.question_text, options: opts, correctAnswer: letter ? ['A','B','C','D'].indexOf(letter[0]) : 0, imageUrl: q.image_url || null };
    });
    const participants = await dbAll('SELECT user_id, player_name, score, wager_streak FROM game_participants WHERE game_id = ? ORDER BY score DESC', [game.id]);
    let timeLeft = null;
    if (game.status === 'started' && game.started_at && game.settings?.timeLimit) {
      const elapsed = (Date.now() - new Date(game.started_at.includes('T') ? game.started_at : game.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
      timeLeft = Math.max(0, game.settings.timeLimit - elapsed);
    }
    const myP = userId ? participants.find(p => p.user_id === userId) : null;
    res.json({ status: game.status, started_at: game.started_at, settings: game.settings, questions: safeQuestions, participants, timeLeft, myScore: myP?.score || 0, myStreak: myP?.wager_streak || 0 });
  } catch (err) { console.error('[wager-state]', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/games/:gameCode/wager-answer', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, questionId, selectedAnswer, isCorrect, pointsEarned, newStreak } = req.body;
  try {
    const game = await dbGet('SELECT id, status, kit_id FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.status !== 'started') return res.status(400).json({ error: 'Game not active' });
    await dbRun('INSERT INTO game_answers (game_id, user_id, question_id, answer, is_correct, points_earned) VALUES (?, ?, ?, ?, ?, ?)',
      [game.id, userId, questionId, selectedAnswer, isCorrect ? 1 : 0, Math.max(0, pointsEarned)]);
    await dbRun('UPDATE game_participants SET score = MAX(0, score + ?), wager_streak = ? WHERE game_id = ? AND user_id = ?',
      [pointsEarned, newStreak || 0, game.id, userId]);
    const updated = await dbGet('SELECT score, wager_streak FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    res.json({ success: true, score: updated?.score || 0, streak: updated?.wager_streak || 0 });
  } catch (err) { console.error('[wager-answer]', err); res.status(500).json({ error: err.message }); }
});

// =========== INFERNO TOWER ===========
function computeFireLevel(startedAt, settings) {
  if (!startedAt) return 0;
  const start = new Date(startedAt.includes('T') ? startedAt : startedAt.replace(' ', 'T') + 'Z').getTime();
  const elapsed = (Date.now() - start) / 1000;
  if (elapsed <= 0) return 0;
  const initialInterval = settings?.initialFireInterval || 5;
  const accelEvery = settings?.fireAccelerationInterval || 30;
  const accelAmount = settings?.fireAccelerationAmount || 0.5;
  const minInterval = settings?.minFireInterval || 1.5;
  let fireFloor = 0;
  let currentInterval = initialInterval;
  let time = 0;
  while (time < elapsed) {
    const nextAccel = Math.ceil((time + 0.001) / accelEvery) * accelEvery;
    const timeUntilAccel = nextAccel - time;
    const timeRemaining = elapsed - time;
    const chunk = Math.min(timeUntilAccel, timeRemaining);
    const floors = Math.floor(chunk / currentInterval);
    fireFloor += floors;
    if (timeRemaining <= timeUntilAccel) {
      break; // no more acceleration boundaries to cross
    }
    // Skip to next acceleration boundary
    currentInterval = Math.max(minInterval, currentInterval - accelAmount);
    time = nextAccel;
  }
  // Start fire below players — give a 3-floor head start grace period
  return Math.max(0, fireFloor - 3);
}

// Inferno Tower: poll state
app.get('/api/games/:gameCode/inferno-state', async (req, res) => {
  const { gameCode } = req.params;
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  try {
    let game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);

    const fireLevel = game.sudden_death === 2 ? 0 : computeFireLevel(game.started_at, game.settings);

    // Eliminate players caught by fire (skip during tiebreaker)
    if (game.status === 'started' && game.sudden_death !== 2) {
      // Get who's alive BEFORE elimination
      const aliveBefore = await dbAll('SELECT user_id, tower_floor FROM game_participants WHERE game_id = ? AND is_ghost = 0', [game.id]);

      await dbRun(
        `UPDATE game_participants SET is_ghost = 1 WHERE game_id = ? AND is_ghost = 0 AND tower_floor <= ? AND ? > 0`,
        [game.id, fireLevel, fireLevel]
      );

      const aliveAfter = await dbGet('SELECT COUNT(*) as count FROM game_participants WHERE game_id = ? AND is_ghost = 0', [game.id]);
      const totalPlayers = (await dbGet('SELECT COUNT(*) as count FROM game_participants WHERE game_id = ?', [game.id]))?.count || 0;
      const isSolo = totalPlayers <= 1;

      // Solo: end when player dies (0 alive). Multi: end when 1 or 0 alive.
      if (isSolo ? aliveAfter.count === 0 : aliveAfter.count <= 1) {
        // Check for tie: if 0 alive and 2+ just died simultaneously → sudden death
        if (aliveAfter.count === 0 && aliveBefore.length >= 2 && !game.sudden_death) {
          // First tie → SUDDEN DEATH with faster fire
          for (const p of aliveBefore) {
            await dbRun('UPDATE game_participants SET is_ghost = 0 WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
          }
          const newSettings = { ...game.settings, initialFireInterval: Math.max(1, (game.settings?.initialFireInterval || 5) / 2), minFireInterval: 0.5 };
          await dbRun(`UPDATE games SET sudden_death = 1, settings = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(newSettings), game.id]);
          for (const p of aliveBefore) {
            await dbRun('UPDATE game_participants SET tower_floor = ? WHERE game_id = ? AND user_id = ?', [fireLevel + 1, game.id, p.user_id]);
          }
          console.log(`[inferno] SUDDEN DEATH — ${aliveBefore.length} players revived at floor ${fireLevel + 1}`);
        } else if (aliveAfter.count === 0 && aliveBefore.length >= 2 && game.sudden_death == 1) {
          // Second tie after sudden death → TIEBREAKER mode (keep their actual floor)
          for (const p of aliveBefore) {
            await dbRun('UPDATE game_participants SET is_ghost = 0 WHERE game_id = ? AND user_id = ?', [game.id, p.user_id]);
          }
          await dbRun(`UPDATE games SET sudden_death = 2, round_started_at = datetime('now', '+7 seconds') WHERE id = ?`, [game.id]);
          console.log(`[inferno] TIEBREAKER — ${aliveBefore.length} players enter final question`);
        } else {
          await dbRun(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'started'`, [game.id]);
          game.status = 'ended';
        }
      }
    }

    // Re-fetch game after potential sudden death / tiebreaker changes
    game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);

    const questions = await dbAll('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id]);
    const safeQuestions = questions.map(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      const correctRaw = (q.correct_answer || '').toUpperCase().trim();
      const letter = correctRaw.match(/[A-D](?!.*[A-D])/);
      return { id: q.id, text: q.question_text, options: opts, correctAnswer: letter ? ['A','B','C','D'].indexOf(letter[0]) : 0, imageUrl: q.image_url || null };
    });
    const participants = await dbAll(
      'SELECT user_id, player_name, score, tower_floor, is_ghost, frozen_until FROM game_participants WHERE game_id = ?', [game.id]
    );
    // Recent fireballs (last 10 seconds)
    const recentFireballs = userId ? await dbAll(
      `SELECT * FROM inferno_fireballs WHERE game_id = ? AND target_user_id = ? AND created_at >= datetime('now', '-10 seconds')`,
      [game.id, userId]
    ) : [];
    const myP = userId ? participants.find(p => p.user_id === userId) : null;

    res.json({
      status: game.status,
      started_at: game.started_at,
      settings: game.settings,
      fireLevel,
      questions: safeQuestions,
      participants,
      recentFireballs,
      myFloor: myP?.tower_floor || 0,
      myGhost: myP?.is_ghost || 0,
      myFrozenUntil: myP?.frozen_until || null,
      suddenDeath: game.sudden_death || 0,
      tiebreakerStartedAt: game.sudden_death === 2 ? game.round_started_at : null,
    });
  } catch (err) {
    console.error('[inferno-state]', err);
    res.status(500).json({ error: err.message });
  }
});

// Inferno Tower: answer a question
app.post('/api/games/:gameCode/inferno-answer', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, questionId, selectedAnswer, isCorrect } = req.body;
  try {
    const game = await dbGet('SELECT id, kit_id, status, settings, sudden_death FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.status !== 'started') return res.status(400).json({ error: 'Game not active' });
    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
    const p = await dbGet('SELECT is_ghost, frozen_until FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    if (!p) return res.status(404).json({ error: 'Participant not found' });

    // Record answer
    await dbRun('INSERT INTO game_answers (game_id, user_id, question_id, answer, is_correct, points_earned) VALUES (?, ?, ?, ?, ?, ?)',
      [game.id, userId, questionId, selectedAnswer, isCorrect ? 1 : 0, isCorrect ? 10 : 0]);

    // TIEBREAKER mode: first correct answer wins (only after countdown)
    if (game.sudden_death === 2 && p.is_ghost === 0) {
      // Block answers during countdown
      const tbStartRaw = (await dbGet('SELECT round_started_at FROM games WHERE id = ?', [game.id]))?.round_started_at;
      if (tbStartRaw) {
        const tbStart = new Date(tbStartRaw.includes('T') ? tbStartRaw : tbStartRaw.replace(' ', 'T') + 'Z').getTime();
        if (Date.now() < tbStart) {
          return res.json({ success: false, error: 'Countdown still active' });
        }
      }
      if (isCorrect) {
        // This player wins — eliminate everyone else
        await dbRun('UPDATE game_participants SET is_ghost = 1 WHERE game_id = ? AND user_id != ?', [game.id, userId]);
        await dbRun('UPDATE game_participants SET score = score + 10 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        await dbRun(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [game.id]);
        return res.json({ success: true, isCorrect: true, tiebreakerWon: true });
      } else {
        return res.json({ success: true, isCorrect: false, tiebreaker: true });
      }
    }

    if (p.is_ghost === 0) {
      // Check frozen
      if (p.frozen_until) {
        const frozenMs = new Date(p.frozen_until.includes('T') ? p.frozen_until : p.frozen_until.replace(' ', 'T') + 'Z').getTime();
        if (frozenMs > Date.now()) {
          return res.json({ success: false, frozen: true, frozenUntil: p.frozen_until });
        }
      }
      if (isCorrect) {
        await dbRun('UPDATE game_participants SET tower_floor = tower_floor + 1, score = score + 10 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        const updated = await dbGet('SELECT tower_floor FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        return res.json({ success: true, isCorrect: true, floor: updated.tower_floor });
      } else {
        const freezeSec = parseInt(settings?.wrongAnswerFreezeSeconds, 10) || 3;
        await dbRun(`UPDATE game_participants SET frozen_until = datetime('now', '+' || ? || ' seconds') WHERE game_id = ? AND user_id = ?`, [freezeSec, game.id, userId]);
        return res.json({ success: true, isCorrect: false, frozenFor: freezeSec });
      }
    } else {
      // Ghost
      return res.json({ success: true, isGhost: true, canFireball: isCorrect });
    }
  } catch (err) {
    console.error('[inferno-answer]', err);
    res.status(500).json({ error: err.message });
  }
});

// Inferno Tower: ghost sends fireball
app.post('/api/games/:gameCode/inferno-fireball', async (req, res) => {
  const { gameCode } = req.params;
  const { userId, targetUserId } = req.body;
  try {
    const game = await dbGet('SELECT id, status, settings FROM games WHERE game_code = ?', [gameCode]);
    if (!game || game.status !== 'started') return res.status(400).json({ error: 'Game not active' });
    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
    const attacker = await dbGet('SELECT is_ghost FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, userId]);
    if (!attacker || attacker.is_ghost !== 1) return res.status(400).json({ error: 'Only ghosts can fireball' });
    const target = await dbGet('SELECT is_ghost FROM game_participants WHERE game_id = ? AND user_id = ?', [game.id, targetUserId]);
    if (!target || target.is_ghost === 1) return res.status(400).json({ error: 'Target is not alive' });
    const freezeSec = parseInt(settings?.ghostFreezeSeconds, 10) || 2;
    await dbRun(`UPDATE game_participants SET frozen_until = MAX(COALESCE(frozen_until, '1970-01-01'), datetime('now', '+' || ? || ' seconds')) WHERE game_id = ? AND user_id = ?`, [freezeSec, game.id, targetUserId]);
    await dbRun('INSERT INTO inferno_fireballs (game_id, attacker_user_id, target_user_id) VALUES (?, ?, ?)', [game.id, userId, targetUserId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[inferno-fireball]', err);
    res.status(500).json({ error: err.message });
  }
});

// =========== SURVIVAL SYNCHRONIZED STATE ===========
app.get('/api/games/:gameCode/survival-state', async (req, res) => {
  const { gameCode } = req.params;
  const userId = req.query.userId ? parseInt(req.query.userId) : null;

  try {
    let game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);

    const questions = await dbAll('SELECT * FROM questions WHERE kit_id = ?', [game.kit_id]);
    const safeQuestions = questions.map(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      const correctRaw = (q.correct_answer || '').toUpperCase().trim();
      const letter = correctRaw.match(/[A-D](?!.*[A-D])/);
      return { id: q.id, text: q.question_text, options: opts, correctAnswer: letter ? ['A','B','C','D'].indexOf(letter[0]) : 0, imageUrl: q.image_url || null };
    });

    // Auto-transition round states
    if (game.status === 'started') {
      const qLimit = game.settings?.questionTimeLimit || 15;
      const resultsTime = 4;
      const now = Date.now();

      if (game.round_status === 'answering' && game.round_started_at) {
        const elapsed = (now - parseDbDate(game.round_started_at).getTime()) / 1000;
        if (elapsed >= 0 && elapsed >= qLimit) {
          console.log(`[survival-state] TIMER EXPIRED: elapsed=${elapsed.toFixed(1)}s, qLimit=${qLimit}, round_started_at=${game.round_started_at}`);
          await endRound(game, questions, 'timer-expired');
          game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
          if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);
        }
      } else if (game.round_status === 'results' && game.round_ended_at && game.status !== 'ended') {
        const elapsed = (now - parseDbDate(game.round_ended_at).getTime()) / 1000;
        if (elapsed >= resultsTime) {
          await advanceRound(game, questions.length);
          game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
          if (typeof game.settings === 'string') game.settings = JSON.parse(game.settings);
        }
      }
    }

    const participants = await dbAll('SELECT * FROM game_participants WHERE game_id = ?', [game.id]);

    // Time left in current round (elapsed can be negative during countdown)
    const qLimit = game.settings?.questionTimeLimit || 15;
    let roundTimeLeft = null;
    let countdownLeft = 0;
    if (game.round_status === 'answering' && game.round_started_at) {
      const elapsed = (Date.now() - parseDbDate(game.round_started_at).getTime()) / 1000;
      if (elapsed < 0) {
        // Still in countdown phase (round_started_at is in the future)
        countdownLeft = -elapsed; // precise float for client sync
        roundTimeLeft = qLimit; // full time once countdown ends
      } else {
        roundTimeLeft = Math.max(0, qLimit - elapsed);
      }
    }

    // This player's answer for the current round
    let myRoundAnswer = null;
    if (userId) {
      const currentQ = questions[game.current_question_index || 0];
      if (currentQ) {
        myRoundAnswer = await dbGet(
          `SELECT answer, is_correct FROM game_answers WHERE game_id = ? AND user_id = ? AND question_id = ? AND answered_at >= ? ORDER BY answered_at DESC LIMIT 1`,
          [game.id, userId, currentQ.id, game.round_started_at || '1970-01-01']
        );
      }
    }

    res.json({
      ...game,
      participants,
      questions: safeQuestions,
      roundTimeLeft,
      countdownLeft,
      myRoundAnswer,
    });
  } catch (err) {
    console.error('[survival-state]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Elemental Markets ─────────────────────────────────────────────────────
// A real-feeling stock market game mode. Six elemental "stocks" with shared
// server-side prices that everyone in a game sees identically. Players earn
// cash by answering questions, then buy/sell shares. Highest portfolio value
// (cash + holdings × current price) at time-out wins.

const MKT_STOCKS = [
  { sym: 'FYR', name: 'Fire',      element: 'fire',      vol: 0.040, crash: 1.5, color: '#ef4444' },
  { sym: 'BLT', name: 'Lightning', element: 'lightning', vol: 0.045, crash: 1.4, color: '#facc15' },
  { sym: 'AQR', name: 'Water',     element: 'water',     vol: 0.025, crash: 1.0, color: '#3b82f6' },
  { sym: 'WND', name: 'Air',       element: 'air',       vol: 0.025, crash: 1.0, color: '#0ea5e9' },
  { sym: 'TER', name: 'Earth',     element: 'earth',     vol: 0.012, crash: 0.5, color: '#84cc16' },
  { sym: 'FRZ', name: 'Ice',       element: 'ice',       vol: 0.018, crash: 0.7, color: '#67e8f9' },
];
const MKT_NEWS_TEMPLATES = [
  { msg: 'Wildfire spreads across the realm',     impact: { FYR: 0.22, AQR: -0.10, WND: -0.06 }, ticks: 6 },
  { msg: 'Drought hits coastal regions',          impact: { AQR: -0.20, FYR: 0.06, FRZ: -0.04 }, ticks: 7 },
  { msg: 'Ice age forecast spreads chill',        impact: { FRZ: 0.22, FYR: -0.16, AQR: -0.06 }, ticks: 7 },
  { msg: 'Volcanic eruption rocks markets',       impact: { FYR: 0.26, TER: -0.14, AQR: -0.06 }, ticks: 8 },
  { msg: 'Massive thunderstorm sweeps in',        impact: { BLT: 0.24, WND: 0.10, FRZ: -0.06 }, ticks: 5 },
  { msg: 'Tsunami warning on the horizon',        impact: { AQR: 0.22, TER: -0.12, FRZ: 0.08 }, ticks: 6 },
  { msg: 'Earthquake rattles foundations',        impact: { TER: -0.18, FYR: 0.06, BLT: 0.08 }, ticks: 6 },
  { msg: 'Geothermal boom — earth heats up',      impact: { TER: 0.20, FYR: 0.10, FRZ: -0.05 }, ticks: 6 },
  { msg: 'Steady trade winds bolster transport',  impact: { WND: 0.15, FRZ: 0.05 }, ticks: 5 },
  { msg: 'Charged ions disrupt grids',            impact: { BLT: 0.18, TER: -0.06 }, ticks: 5 },
  { msg: 'Glacial retreat opens new routes',      impact: { FRZ: -0.14, AQR: 0.10, TER: 0.04 }, ticks: 7 },
  { msg: 'Mage council blesses the elements',     impact: { FYR: 0.05, AQR: 0.05, TER: 0.05, WND: 0.05 }, ticks: 5 },
];
const MKT_TICK_MS = 2000;
const MKT_HISTORY_LEN = 90; // ~3 minutes of history at 2s/tick

// In-memory state per game. Cleared on server restart (markets are ephemeral).
const marketsState = new Map();

function gaussian(mean = 0, std = 1) {
  // Box-Muller — fine for our uses
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function initMarketState() {
  const prices = {}, history = {};
  for (const s of MKT_STOCKS) { prices[s.sym] = 100; history[s.sym] = [100]; }
  return {
    prices, history,
    events: [],          // active impact events (decremented per tick)
    eventLog: [],        // recent triggered events for the news ticker (most recent first)
    regime: 'normal',    // 'normal' | 'bull' | 'bear' | 'crash' | 'recovery'
    regimeTicksLeft: 30,
    totalTicks: 0,
    lastTickAt: Date.now(),
  };
}

function shiftRegime(state) {
  // Markov-ish. After a crash we always recover.
  const r = Math.random();
  if (state.regime === 'crash')      { state.regime = 'recovery'; state.regimeTicksLeft = 18 + Math.floor(Math.random() * 12); }
  else if (state.regime === 'recovery') { state.regime = 'normal'; state.regimeTicksLeft = 30 + Math.floor(Math.random() * 30); }
  else if (state.regime === 'bull') {
    if (r < 0.55) { state.regime = 'bull'; state.regimeTicksLeft = 18 + Math.floor(Math.random() * 18); }
    else if (r < 0.92) { state.regime = 'normal'; state.regimeTicksLeft = 25 + Math.floor(Math.random() * 25); }
    else { state.regime = 'bear'; state.regimeTicksLeft = 18 + Math.floor(Math.random() * 18); }
  } else if (state.regime === 'bear') {
    if (r < 0.50) { state.regime = 'bear'; state.regimeTicksLeft = 15 + Math.floor(Math.random() * 18); }
    else if (r < 0.88) { state.regime = 'normal'; state.regimeTicksLeft = 25 + Math.floor(Math.random() * 25); }
    else { state.regime = 'crash'; state.regimeTicksLeft = 6 + Math.floor(Math.random() * 5); }
  } else { // normal
    if (r < 0.18) { state.regime = 'bull'; state.regimeTicksLeft = 18 + Math.floor(Math.random() * 18); }
    else if (r < 0.30) { state.regime = 'bear'; state.regimeTicksLeft = 15 + Math.floor(Math.random() * 18); }
    else if (r < 0.32) { state.regime = 'crash'; state.regimeTicksLeft = 6 + Math.floor(Math.random() * 5); }
    else { state.regime = 'normal'; state.regimeTicksLeft = 25 + Math.floor(Math.random() * 25); }
  }
  if (state.regime === 'crash') {
    state.eventLog.unshift({ id: Date.now() + Math.random(), msg: 'MARKET CRASH — all elements down sharply', impact: {}, kind: 'crash' });
    state.eventLog = state.eventLog.slice(0, 8);
  } else if (state.regime === 'recovery') {
    state.eventLog.unshift({ id: Date.now() + Math.random(), msg: 'Recovery underway — markets stabilising', impact: {}, kind: 'recovery' });
    state.eventLog = state.eventLog.slice(0, 8);
  } else if (state.regime === 'bull') {
    state.eventLog.unshift({ id: Date.now() + Math.random(), msg: 'Bull run begins', impact: {}, kind: 'bull' });
    state.eventLog = state.eventLog.slice(0, 8);
  } else if (state.regime === 'bear') {
    state.eventLog.unshift({ id: Date.now() + Math.random(), msg: 'Bearish sentiment building', impact: {}, kind: 'bear' });
    state.eventLog = state.eventLog.slice(0, 8);
  }
}

function maybeTriggerNews(state) {
  // ~2% chance per tick = roughly one event per 100 seconds
  if (Math.random() < 0.022 && state.regime !== 'crash') {
    const tpl = MKT_NEWS_TEMPLATES[Math.floor(Math.random() * MKT_NEWS_TEMPLATES.length)];
    const evt = {
      id: Date.now() + Math.random(),
      msg: tpl.msg,
      impact: tpl.impact,
      ticks: tpl.ticks,
      ticksRemaining: tpl.ticks,
      kind: 'news',
    };
    state.events.push(evt);
    state.eventLog.unshift(evt);
    state.eventLog = state.eventLog.slice(0, 8);
  }
}

function simulateTick(state) {
  state.totalTicks++;
  state.regimeTicksLeft--;
  if (state.regimeTicksLeft <= 0) shiftRegime(state);
  maybeTriggerNews(state);

  for (const stock of MKT_STOCKS) {
    let pct = 0;

    // 1. Random walk
    pct += gaussian(0, stock.vol);

    // 2. Mild mean reversion toward the $100 baseline
    const old = state.prices[stock.sym];
    pct += ((100 - old) / old) * 0.004;

    // 3. Regime drift
    if (state.regime === 'bull')          pct += 0.006;
    else if (state.regime === 'bear')     pct -= 0.005;
    else if (state.regime === 'crash')    pct -= 0.045 * stock.crash;
    else if (state.regime === 'recovery') pct += 0.012 * stock.crash;

    // 4. Active news event impact, distributed over the event's duration
    for (const ev of state.events) {
      const perTick = (ev.impact[stock.sym] || 0) / ev.ticks;
      pct += perTick;
    }

    state.prices[stock.sym] = Math.max(5, old * (1 + pct));
    state.history[stock.sym].push(Math.round(state.prices[stock.sym] * 100) / 100);
    if (state.history[stock.sym].length > MKT_HISTORY_LEN) state.history[stock.sym].shift();
  }

  // Decrement event timers
  for (const ev of state.events) ev.ticksRemaining--;
  state.events = state.events.filter(ev => ev.ticksRemaining > 0);
}

// Advance the per-game market by however many ticks have elapsed since the
// last call. Lazy simulation — no setInterval needed; the next state request
// drives the catch-up.
function advanceMarket(gameCode) {
  let state = marketsState.get(gameCode);
  if (!state) {
    state = initMarketState();
    marketsState.set(gameCode, state);
  }
  const now = Date.now();
  let ticksToProcess = Math.floor((now - state.lastTickAt) / MKT_TICK_MS);
  // Hard cap to avoid a flood after a long pause
  ticksToProcess = Math.min(ticksToProcess, 60);
  for (let i = 0; i < ticksToProcess; i++) {
    simulateTick(state);
    state.lastTickAt += MKT_TICK_MS;
  }
  return state;
}

function parseHoldings(rawJson) {
  if (!rawJson) return {};
  try { const obj = JSON.parse(rawJson); return obj && typeof obj === 'object' ? obj : {}; }
  catch (_) { return {}; }
}

function portfolioValue(cash, holdings, prices) {
  let total = Number(cash) || 0;
  for (const sym of Object.keys(holdings)) {
    total += (holdings[sym] || 0) * (prices[sym] || 0);
  }
  return Math.round(total * 100) / 100;
}

// GET /api/games/:gameCode/markets/state?userId=...
app.get('/api/games/:gameCode/markets/state', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const game = await dbGet('SELECT * FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const state = advanceMarket(gameCode);
    const stocks = MKT_STOCKS.map(s => ({
      sym: s.sym, name: s.name, element: s.element, color: s.color,
      price: Math.round(state.prices[s.sym] * 100) / 100,
      history: state.history[s.sym],
      changePct: Math.round(((state.prices[s.sym] - 100) / 100) * 10000) / 100,
    }));

    // Per-player snapshot (cash, holdings, portfolio value, cost basis)
    let me = null;
    if (userId) {
      const row = await dbGet(
        'SELECT mkt_cash, mkt_holdings, mkt_cost_basis FROM game_participants WHERE game_id = ? AND user_id = ?',
        [game.id, userId]
      );
      if (row) {
        const holdings = parseHoldings(row.mkt_holdings);
        const costBasis = parseHoldings(row.mkt_cost_basis);
        me = {
          cash: Math.round((row.mkt_cash || 0) * 100) / 100,
          holdings,
          costBasis,
          portfolio: portfolioValue(row.mkt_cash, holdings, state.prices),
        };
      }
    }

    // Leaderboard
    const everyone = await dbAll(
      'SELECT user_id, player_name, mkt_cash, mkt_holdings FROM game_participants WHERE game_id = ?',
      [game.id]
    );
    const leaderboard = everyone.map(p => {
      const h = parseHoldings(p.mkt_holdings);
      return {
        user_id: p.user_id,
        player_name: p.player_name,
        portfolio: portfolioValue(p.mkt_cash, h, state.prices),
      };
    }).sort((a, b) => b.portfolio - a.portfolio);

    res.json({
      regime: state.regime,
      tick: state.totalTicks,
      stocks,
      events: state.eventLog,
      me,
      leaderboard,
      gameStatus: game.status,
    });
  } catch (err) {
    console.error('[markets/state]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameCode/markets/buy { userId, symbol, shares }
app.post('/api/games/:gameCode/markets/buy', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId, symbol, shares } = req.body;
    const sharesInt = Math.max(0, Math.floor(Number(shares) || 0));
    if (!sharesInt) return res.status(400).json({ error: 'Shares must be at least 1' });
    if (!MKT_STOCKS.find(s => s.sym === symbol)) return res.status(400).json({ error: 'Unknown symbol' });

    const game = await dbGet('SELECT id, status FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'ended') return res.status(400).json({ error: 'Game has ended' });

    const state = advanceMarket(gameCode);
    const price = state.prices[symbol];
    const cost = price * sharesInt;

    const row = await dbGet(
      'SELECT mkt_cash, mkt_holdings, mkt_cost_basis FROM game_participants WHERE game_id = ? AND user_id = ?',
      [game.id, userId]
    );
    if (!row) return res.status(404).json({ error: 'Not a participant in this game' });
    const cash = Number(row.mkt_cash) || 0;
    if (cost > cash) return res.status(400).json({ error: `Need $${cost.toFixed(2)}, only have $${cash.toFixed(2)}` });

    const holdings = parseHoldings(row.mkt_holdings);
    const costBasis = parseHoldings(row.mkt_cost_basis);
    const prevShares = holdings[symbol] || 0;
    const prevAvg = costBasis[symbol] || price;
    holdings[symbol] = prevShares + sharesInt;
    // Weighted-average cost basis so partial subsequent sells still know what
    // the original purchase cost was.
    costBasis[symbol] = Math.round(((prevShares * prevAvg + sharesInt * price) / holdings[symbol]) * 100) / 100;
    const newCash = Math.round((cash - cost) * 100) / 100;
    await dbRun(
      'UPDATE game_participants SET mkt_cash = ?, mkt_holdings = ?, mkt_cost_basis = ? WHERE game_id = ? AND user_id = ?',
      [newCash, JSON.stringify(holdings), JSON.stringify(costBasis), game.id, userId]
    );

    res.json({
      cash: newCash,
      holdings,
      costBasis,
      filledAt: Math.round(price * 100) / 100,
      portfolio: portfolioValue(newCash, holdings, state.prices),
    });
  } catch (err) {
    console.error('[markets/buy]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameCode/markets/sell { userId, symbol, shares }
app.post('/api/games/:gameCode/markets/sell', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId, symbol, shares } = req.body;
    const sharesInt = Math.max(0, Math.floor(Number(shares) || 0));
    if (!sharesInt) return res.status(400).json({ error: 'Shares must be at least 1' });
    if (!MKT_STOCKS.find(s => s.sym === symbol)) return res.status(400).json({ error: 'Unknown symbol' });

    const game = await dbGet('SELECT id, status FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'ended') return res.status(400).json({ error: 'Game has ended' });

    const state = advanceMarket(gameCode);
    const price = state.prices[symbol];

    const row = await dbGet(
      'SELECT mkt_cash, mkt_holdings, mkt_cost_basis FROM game_participants WHERE game_id = ? AND user_id = ?',
      [game.id, userId]
    );
    if (!row) return res.status(404).json({ error: 'Not a participant in this game' });
    const holdings = parseHoldings(row.mkt_holdings);
    const costBasis = parseHoldings(row.mkt_cost_basis);
    const owned = holdings[symbol] || 0;
    if (sharesInt > owned) return res.status(400).json({ error: `Only own ${owned} shares of ${symbol}` });

    const avgCost = costBasis[symbol] || 0;
    const realizedPL = Math.round((price - avgCost) * sharesInt * 100) / 100;
    holdings[symbol] = owned - sharesInt;
    if (!holdings[symbol]) { delete holdings[symbol]; delete costBasis[symbol]; }
    // Selling doesn't change the weighted-avg cost of the remaining shares.
    const proceeds = price * sharesInt;
    const newCash = Math.round(((Number(row.mkt_cash) || 0) + proceeds) * 100) / 100;
    await dbRun(
      'UPDATE game_participants SET mkt_cash = ?, mkt_holdings = ?, mkt_cost_basis = ? WHERE game_id = ? AND user_id = ?',
      [newCash, JSON.stringify(holdings), JSON.stringify(costBasis), game.id, userId]
    );

    res.json({
      cash: newCash,
      holdings,
      costBasis,
      filledAt: Math.round(price * 100) / 100,
      realizedPL,
      portfolio: portfolioValue(newCash, holdings, state.prices),
    });
  } catch (err) {
    console.error('[markets/sell]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameCode/markets/answer { userId, questionId, isCorrect, timeTaken }
// Cash payout for question outcomes — the only way to add capital to your portfolio.
app.post('/api/games/:gameCode/markets/answer', async (req, res) => {
  try {
    const { gameCode } = req.params;
    const { userId, questionId, isCorrect, timeTaken, selectedAnswer } = req.body;
    const game = await dbGet('SELECT id, status FROM games WHERE game_code = ?', [gameCode]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'ended') return res.status(400).json({ error: 'Game has ended' });

    // Compute reward — base $50 correct, −$10 wrong, +$5 if answered fast
    let reward = 0;
    if (isCorrect) {
      reward = 50;
      if ((timeTaken || 999) <= 5) reward += 5;
    } else {
      reward = -10;
    }
    const row = await dbGet(
      'SELECT mkt_cash FROM game_participants WHERE game_id = ? AND user_id = ?',
      [game.id, userId]
    );
    if (!row) return res.status(404).json({ error: 'Not a participant' });
    const newCash = Math.max(0, Math.round(((Number(row.mkt_cash) || 0) + reward) * 100) / 100);
    await dbRun(
      'UPDATE game_participants SET mkt_cash = ? WHERE game_id = ? AND user_id = ?',
      [newCash, game.id, userId]
    );

    // Log the answer for stats consistency with other modes
    await dbRun(
      'INSERT INTO game_answers (game_id, user_id, question_id, selected_answer, is_correct, time_taken) VALUES (?, ?, ?, ?, ?, ?)',
      [game.id, userId, questionId, selectedAnswer || '', isCorrect ? 1 : 0, timeTaken || 0]
    );

    res.json({ cash: newCash, reward });
  } catch (err) {
    console.error('[markets/answer]', err);
    res.status(500).json({ error: err.message });
  }
});

// Lock in final scores when the game ends so the existing results page works.
// Called explicitly by /end and /abandon below.
async function settleMarketsScores(gameCode) {
  const state = marketsState.get(gameCode);
  if (!state) return;
  const game = await dbGet('SELECT id, game_mode FROM games WHERE game_code = ?', [gameCode]);
  if (!game || game.game_mode !== 'elemental_markets') return;
  const rows = await dbAll(
    'SELECT user_id, mkt_cash, mkt_holdings FROM game_participants WHERE game_id = ?',
    [game.id]
  );
  for (const r of rows) {
    const holdings = parseHoldings(r.mkt_holdings);
    const final = portfolioValue(r.mkt_cash, holdings, state.prices);
    await dbRun(
      'UPDATE game_participants SET score = ? WHERE game_id = ? AND user_id = ?',
      [Math.round(final), game.id, r.user_id]
    );
  }
}
app.locals.settleMarketsScores = settleMarketsScores;

// Serve frontend static files in production
const clientBuildPath = path.join(__dirname, '..', 'blazes', 'dist');
if (fs.existsSync(clientBuildPath)) {
  console.log('[Static] Serving frontend from', clientBuildPath);
  app.use(express.static(clientBuildPath));
  // SPA catch-all: serve index.html for any non-API route
  app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/google') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  console.log('[Static] No frontend build found at', clientBuildPath);
}

// Global error handler — logs the actual error instead of just "Internal Server Error"
app.use((err, req, res, next) => {
  console.error('[Server Error]', req.method, req.originalUrl, err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database schema before starting the server
// (fire-and-forget db.run calls don't wait for Turso, so we batch here)
async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS user_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, gamesWon INTEGER DEFAULT 0, dayStreak INTEGER DEFAULT 0, accuracyRate INTEGER DEFAULT 0, totalGames INTEGER DEFAULT 0, winRate REAL DEFAULT 0, avgScore INTEGER DEFAULT 0, questionsAnswered INTEGER DEFAULT 0, currentXP INTEGER DEFAULT 0, level INTEGER DEFAULT 1, totalGamesHosted INTEGER DEFAULT 0, activeStudents INTEGER DEFAULT 0, totalCorrectAnswers INTEGER DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, host_id INTEGER, game_code TEXT UNIQUE, kit_id INTEGER, game_mode TEXT DEFAULT 'classic_timed', game_type TEXT DEFAULT 'live', subject TEXT, status TEXT DEFAULT 'waiting', settings TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, started_at DATETIME, ended_at DATETIME, FOREIGN KEY(host_id) REFERENCES users(id), FOREIGN KEY(kit_id) REFERENCES question_kits(id))`,
    `CREATE TABLE IF NOT EXISTS game_participants (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, user_id INTEGER, player_name TEXT, score INTEGER DEFAULT 0, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(game_id) REFERENCES games(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, activity_type TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS question_kits (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER, title TEXT, subject TEXT, grade_level TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(teacher_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, kit_id INTEGER, question_text TEXT, answer_type TEXT, correct_answer TEXT, option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT, time_limit INTEGER DEFAULT 30, points INTEGER DEFAULT 100, FOREIGN KEY(kit_id) REFERENCES question_kits(id))`,
    `CREATE TABLE IF NOT EXISTS game_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, user_id INTEGER, question_id INTEGER, answer TEXT, is_correct BOOLEAN, time_taken INTEGER, points_earned INTEGER, answered_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(game_id) REFERENCES games(id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(question_id) REFERENCES questions(id))`,
    `CREATE TABLE IF NOT EXISTS blazes_bucks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, balance INTEGER DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS blazes_bucks_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER, reason TEXT, game_code TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS user_achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, achievement_id TEXT, unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, achievement_id), FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS review_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, review_count INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS user_skins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, skin_id TEXT, skin_type TEXT DEFAULT 'avatar', purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP, stock_rotation TEXT, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS skin_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, skin_ids TEXT NOT NULL, generated_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS user_equipped (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, avatar_skin TEXT DEFAULT 'default', bar_skin TEXT DEFAULT 'default', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS elemental_attacks (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, attacker_user_id INTEGER, attack_type TEXT, energy_cost INTEGER, damage INTEGER, target_team INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(game_id) REFERENCES games(id))`,
    `CREATE TABLE IF NOT EXISTS game_answers_claimed (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, user_id INTEGER, question_id INTEGER, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS classrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER, name TEXT, subject TEXT, grade_level TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(teacher_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS classroom_students (id INTEGER PRIMARY KEY AUTOINCREMENT, classroom_id INTEGER, student_id INTEGER, status TEXT DEFAULT 'pending', joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(classroom_id, student_id), FOREIGN KEY(classroom_id) REFERENCES classrooms(id), FOREIGN KEY(student_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS classroom_teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, classroom_id INTEGER, teacher_id INTEGER, role TEXT DEFAULT 'co-teacher', added_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(classroom_id, teacher_id), FOREIGN KEY(classroom_id) REFERENCES classrooms(id), FOREIGN KEY(teacher_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, classroom_id INTEGER, kit_id INTEGER, game_mode TEXT DEFAULT 'classic_timed', title TEXT, instructions TEXT, due_date DATETIME, due_time TEXT, requirements TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(classroom_id) REFERENCES classrooms(id), FOREIGN KEY(kit_id) REFERENCES question_kits(id))`,
    `CREATE TABLE IF NOT EXISTS assignment_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, assignment_id INTEGER, student_id INTEGER, status TEXT DEFAULT 'pending', questions_answered INTEGER DEFAULT 0, correct_answers INTEGER DEFAULT 0, score INTEGER DEFAULT 0, completed_at DATETIME, UNIQUE(assignment_id, student_id), FOREIGN KEY(assignment_id) REFERENCES assignments(id), FOREIGN KEY(student_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS inferno_fireballs (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, attacker_user_id INTEGER, target_user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(game_id) REFERENCES games(id))`,
    `CREATE TABLE IF NOT EXISTS bb_daily_tracker (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, games_played INTEGER DEFAULT 0, bb_earned_today INTEGER DEFAULT 0, streak_day INTEGER DEFAULT 0, UNIQUE(user_id, date))`,
    `CREATE TABLE IF NOT EXISTS user_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, notify_assignments INTEGER DEFAULT 1, notify_achievements INTEGER DEFAULT 1, notify_game_invites INTEGER DEFAULT 1, notify_classroom INTEGER DEFAULT 1, sound_enabled INTEGER DEFAULT 1, animations_enabled INTEGER DEFAULT 1, timer_warnings INTEGER DEFAULT 1, font_size TEXT DEFAULT 'medium', reduce_motion INTEGER DEFAULT 0, leaderboard_visible INTEGER DEFAULT 1, activity_visible INTEGER DEFAULT 1, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS login_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ip_address TEXT, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS seasons (id INTEGER PRIMARY KEY AUTOINCREMENT, season_number INTEGER UNIQUE, start_date TEXT, end_date TEXT)`,
    `CREATE TABLE IF NOT EXISTS season_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, season_id INTEGER, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp_earned_today INTEGER DEFAULT 0, last_xp_date TEXT, UNIQUE(user_id, season_id))`,
    `CREATE TABLE IF NOT EXISTS season_xp_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, season_id INTEGER, amount INTEGER, source TEXT, game_code TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS season_badges (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, season_number INTEGER, peak_level INTEGER, badge_tier TEXT, UNIQUE(user_id, season_number))`,
    `CREATE TABLE IF NOT EXISTS ai_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, feature TEXT NOT NULL, used_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS arena_events (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, event_key TEXT NOT NULL, started_at DATETIME DEFAULT CURRENT_TIMESTAMP, ends_at DATETIME, payload TEXT)`,
    `CREATE TABLE IF NOT EXISTS arena_attacks (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, attacker_id INTEGER, target_id INTEGER, item_key TEXT, score_delta INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ];

  // ALTER TABLE statements — these may fail if column already exists, that's OK
  const alterStatements = [
    `ALTER TABLE game_participants ADD COLUMN joined_game_at DATETIME`,
    `ALTER TABLE game_participants ADD COLUMN lives INTEGER DEFAULT 3`,
    `ALTER TABLE game_participants ADD COLUMN eliminated INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN eliminated_at_round INTEGER`,
    `ALTER TABLE games ADD COLUMN current_question_index INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN round_started_at DATETIME`,
    `ALTER TABLE games ADD COLUMN round_ended_at DATETIME`,
    `ALTER TABLE games ADD COLUMN round_status TEXT DEFAULT 'answering'`,
    `ALTER TABLE games ADD COLUMN sudden_death INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN rounds_played INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN team INTEGER`,
    `ALTER TABLE game_participants ADD COLUMN energy_points INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN team_1_score INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN team_2_score INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN assignment_id INTEGER`,
    `ALTER TABLE users ADD COLUMN reset_token TEXT`,
    `ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`,
    `ALTER TABLE users ADD COLUMN google_access_token TEXT`,
    `ALTER TABLE users ADD COLUMN google_refresh_token TEXT`,
    `ALTER TABLE users ADD COLUMN google_scopes TEXT`,
    `ALTER TABLE users ADD COLUMN password_changed_at TEXT`,
    `ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN subscription_id TEXT`,
    `ALTER TABLE users ADD COLUMN subscription_expires TEXT`,
    `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
    `ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN verification_token TEXT`,
    `ALTER TABLE game_participants ADD COLUMN wager_streak INTEGER DEFAULT 0`,
    `ALTER TABLE questions ADD COLUMN image_url TEXT`,
    `ALTER TABLE game_participants ADD COLUMN tower_floor INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN is_ghost INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN frozen_until DATETIME`,
    `ALTER TABLE classrooms ADD COLUMN image_url TEXT`,
    `ALTER TABLE blazes_bucks ADD COLUMN last_streak_date TEXT`,
    `ALTER TABLE blazes_bucks ADD COLUMN current_streak INTEGER DEFAULT 0`,
    `ALTER TABLE bb_daily_tracker ADD COLUMN playtime_seconds INTEGER DEFAULT 0`,
    `ALTER TABLE blazes_bucks ADD COLUMN play_time_remainder_seconds INTEGER DEFAULT 0`,
    `ALTER TABLE user_settings ADD COLUMN music_volume INTEGER DEFAULT 30`,
    `ALTER TABLE user_settings ADD COLUMN sfx_volume INTEGER DEFAULT 70`,
    `ALTER TABLE game_participants ADD COLUMN arena_coins INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_combo INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_max_combo INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_attacks_dealt INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_shields INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_double_down INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN arena_perm_bonus INTEGER DEFAULT 0`,
    `ALTER TABLE game_participants ADD COLUMN left_at DATETIME`,
  ];

  console.log('[Schema] Creating tables...');
  for (const sql of statements) {
    try { await tursoClient.execute(sql); } catch (e) {
      console.error('[Schema] Error:', e.message);
    }
  }
  console.log('[Schema] Running migrations...');
  for (const sql of alterStatements) {
    try { await tursoClient.execute(sql); } catch (e) {
      // "duplicate column" or "already exists" errors are expected — ignore them
    }
  }
  console.log('[Schema] Database ready');
}

initSchema().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running: http://localhost:${PORT}`);
    console.log('Database:', process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`);
  });
}).catch(err => {
  console.error('[Schema] Fatal error:', err);
  process.exit(1);
});