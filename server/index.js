const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;
const JWT_SECRET = 'gps-guardian-secret-key-2024';
const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      zone_id TEXT NOT NULL,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200,
      color TEXT DEFAULT '#10b981',
      active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS route_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY,
      esp_ip TEXT DEFAULT '192.168.1.100',
      recipient_email TEXT DEFAULT 'congcuong123465@gmail.com',
      buffer_radius INTEGER DEFAULT 100,
      auto_center INTEGER DEFAULT 1,
      dark_mode INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    saveDatabase();
    console.log('✅ Database initialized successfully');
}

// Save database to file
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Auth middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if email exists
        const existing = db.exec("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0 && existing[0].values.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        db.run("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [name, email, passwordHash]);
        saveDatabase();

        // Get user ID
        const result = db.exec("SELECT id FROM users WHERE email = ?", [email]);
        const userId = result[0].values[0][0];

        // Create default settings with user's email as recipient
        db.run("INSERT INTO settings (user_id, recipient_email) VALUES (?, ?)", [userId, email]);
        saveDatabase();

        // Generate token
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { id: userId, name, email }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        // Find user
        const result = db.exec("SELECT id, name, email, password_hash FROM users WHERE email = ?", [email]);
        if (result.length === 0 || result[0].values.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const [id, userName, userEmail, passwordHash] = result[0].values[0];

        // Check password
        const validPassword = await bcrypt.compare(password, passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { id, name: userName, email: userEmail }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const result = db.exec("SELECT id, name, email FROM users WHERE id = ?", [req.userId]);
    if (result.length === 0 || result[0].values.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }
    const [id, name, email] = result[0].values[0];
    res.json({ user: { id, name, email } });
});

// ============ ZONES ROUTES ============

// Get all zones for user
app.get('/api/zones', authMiddleware, (req, res) => {
    const result = db.exec("SELECT zone_id, name, lat, lng, radius, color, active FROM zones WHERE user_id = ?", [req.userId]);
    if (result.length === 0) {
        return res.json([]);
    }
    const zones = result[0].values.map(row => ({
        id: row[0],
        name: row[1],
        lat: row[2],
        lng: row[3],
        radius: row[4],
        color: row[5],
        active: row[6] === 1
    }));
    res.json(zones);
});

// Create zone
app.post('/api/zones', authMiddleware, (req, res) => {
    const { id, name, lat, lng, radius, color, active } = req.body;
    db.run(
        "INSERT INTO zones (user_id, zone_id, name, lat, lng, radius, color, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [req.userId, id, name, lat, lng, radius || 200, color || '#10b981', active ? 1 : 0]
    );
    saveDatabase();
    res.json({ success: true });
});

// Update zone
app.put('/api/zones/:id', authMiddleware, (req, res) => {
    const { name, radius, color, active } = req.body;
    db.run(
        "UPDATE zones SET name = ?, radius = ?, color = ?, active = ? WHERE zone_id = ? AND user_id = ?",
        [name, radius, color, active ? 1 : 0, req.params.id, req.userId]
    );
    saveDatabase();
    res.json({ success: true });
});

// Delete zone
app.delete('/api/zones/:id', authMiddleware, (req, res) => {
    db.run("DELETE FROM zones WHERE zone_id = ? AND user_id = ?", [req.params.id, req.userId]);
    saveDatabase();
    res.json({ success: true });
});

// ============ ROUTES ROUTES ============

// Get route for user
app.get('/api/routes', authMiddleware, (req, res) => {
    const routeResult = db.exec("SELECT id, name, confirmed FROM routes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [req.userId]);

    if (routeResult.length === 0 || routeResult[0].values.length === 0) {
        return res.json({ points: [], confirmed: false });
    }

    const [routeId, routeName, confirmed] = routeResult[0].values[0];
    const pointsResult = db.exec("SELECT lat, lng FROM route_points WHERE route_id = ? ORDER BY order_index", [routeId]);

    const points = pointsResult.length > 0 ? pointsResult[0].values.map(row => ({ lat: row[0], lng: row[1] })) : [];

    res.json({
        id: routeId,
        name: routeName,
        points,
        confirmed: confirmed === 1
    });
});

// Save route
app.post('/api/routes', authMiddleware, (req, res) => {
    const { points, confirmed } = req.body;

    // Delete existing routes for user
    const existingRoute = db.exec("SELECT id FROM routes WHERE user_id = ?", [req.userId]);
    if (existingRoute.length > 0 && existingRoute[0].values.length > 0) {
        const routeId = existingRoute[0].values[0][0];
        db.run("DELETE FROM route_points WHERE route_id = ?", [routeId]);
        db.run("DELETE FROM routes WHERE id = ?", [routeId]);
    }

    // Create new route
    db.run("INSERT INTO routes (user_id, confirmed) VALUES (?, ?)", [req.userId, confirmed ? 1 : 0]);

    const newRoute = db.exec("SELECT id FROM routes WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.userId]);
    const routeId = newRoute[0].values[0][0];

    // Insert points
    points.forEach((point, index) => {
        db.run("INSERT INTO route_points (route_id, lat, lng, order_index) VALUES (?, ?, ?, ?)", [routeId, point.lat, point.lng, index]);
    });

    saveDatabase();
    res.json({ success: true, id: routeId });
});

// Update route confirmation
app.patch('/api/routes/confirm', authMiddleware, (req, res) => {
    const { confirmed } = req.body;
    db.run("UPDATE routes SET confirmed = ? WHERE user_id = ?", [confirmed ? 1 : 0, req.userId]);
    saveDatabase();
    res.json({ success: true });
});

// Delete route
app.delete('/api/routes', authMiddleware, (req, res) => {
    const existingRoute = db.exec("SELECT id FROM routes WHERE user_id = ?", [req.userId]);
    if (existingRoute.length > 0 && existingRoute[0].values.length > 0) {
        const routeId = existingRoute[0].values[0][0];
        db.run("DELETE FROM route_points WHERE route_id = ?", [routeId]);
        db.run("DELETE FROM routes WHERE id = ?", [routeId]);
        saveDatabase();
    }
    res.json({ success: true });
});

// ============ SETTINGS ROUTES ============

// Get settings
app.get('/api/settings', authMiddleware, (req, res) => {
    let result = db.exec("SELECT esp_ip, recipient_email, buffer_radius, auto_center, dark_mode FROM settings WHERE user_id = ?", [req.userId]);

    if (result.length === 0 || result[0].values.length === 0) {
        // Create default settings
        db.run("INSERT INTO settings (user_id) VALUES (?)", [req.userId]);
        saveDatabase();
        result = db.exec("SELECT esp_ip, recipient_email, buffer_radius, auto_center, dark_mode FROM settings WHERE user_id = ?", [req.userId]);
    }

    const [espIp, recipientEmail, bufferRadius, autoCenter, darkMode] = result[0].values[0];

    res.json({
        espIp: espIp || '192.168.1.100',
        recipientEmail: recipientEmail || 'congcuong123465@gmail.com',
        bufferRadius: bufferRadius || 100,
        autoCenter: autoCenter === 1,
        darkMode: darkMode === 1
    });
});

// Update settings
app.put('/api/settings', authMiddleware, (req, res) => {
    const { espIp, recipientEmail, bufferRadius, autoCenter, darkMode } = req.body;

    // Check if settings exist
    const existing = db.exec("SELECT user_id FROM settings WHERE user_id = ?", [req.userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
        db.run(
            "INSERT INTO settings (user_id, esp_ip, recipient_email, buffer_radius, auto_center, dark_mode) VALUES (?, ?, ?, ?, ?, ?)",
            [req.userId, espIp, recipientEmail, bufferRadius, autoCenter ? 1 : 0, darkMode ? 1 : 0]
        );
    } else {
        db.run(
            "UPDATE settings SET esp_ip = ?, recipient_email = ?, buffer_radius = ?, auto_center = ?, dark_mode = ? WHERE user_id = ?",
            [espIp, recipientEmail, bufferRadius, autoCenter ? 1 : 0, darkMode ? 1 : 0, req.userId]
        );
    }

    saveDatabase();
    res.json({ success: true });
});

// Initialize and start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 GPS Guardian API Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
