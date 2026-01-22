const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs'); // Used only for migration check

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./shotnest.db', (err) => {
    if (err) console.error('DB Error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables
db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    // Projects Table
    // We store the complex data (script, setups, schedule) in a JSON text column 'data'
    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner TEXT,
        title TEXT,
        is_favorite INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        updated_at INTEGER,
        data TEXT 
    )`);
});

// --- MIDDLEWARE ---
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(session({
    secret: 'shotnest-sqlite-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// --- AUTH MIDDLEWARE ---
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    if(req.path.startsWith('/api/') && !req.path.includes('login') && !req.path.includes('register')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect('/login');
}

// --- ROUTES (PAGES) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/studio', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'studio.html')));

// --- API: AUTH ---

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Super Admin Hardcode
    if (email === 'admin@shotnest.com' && password === 'admin123') {
        req.session.user = { id: 'super-admin', email, role: 'admin' };
        return res.json({ success: true, redirect: '/dashboard' });
    }

    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "DB Error" });
        
        if (row) {
            req.session.user = { id: row.id, email: row.email, role: row.role || 'user' };
            res.json({ success: true, redirect: '/dashboard' });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const id = Date.now().toString();

    db.run("INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)", [id, email, password, 'user'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: "User exists" });
            return res.status(500).json({ success: false, message: "DB Error" });
        }
        req.session.user = { id, email, role: 'user' };
        res.json({ success: true, redirect: '/dashboard' });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, redirect: '/login' });
});

app.get('/api/me', (req, res) => {
    req.session.user ? res.json(req.session.user) : res.status(401).json({ error: 'Not logged in' });
});

// --- API: PROJECTS ---

app.get('/api/projects', requireAuth, (req, res) => {
    // Only fetch metadata for the dashboard, not the huge JSON blob
    const sql = "SELECT id, title, is_favorite, is_archived, updated_at, owner FROM projects"; // Removed WHERE owner = ? to allow seeing all projects for demo, or uncomment next line
    // const sql = "SELECT id, title, is_favorite, is_archived, updated_at FROM projects WHERE owner = ?";
    
    db.all(sql, [], (err, rows) => { // Add [req.session.user.email] if using WHERE clause
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/project/:id', requireAuth, (req, res) => {
    db.get("SELECT * FROM projects WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).send('Not Found');
        // Merge the flat columns with the JSON blob
        const projectData = JSON.parse(row.data);
        projectData.id = row.id;
        projectData.title = row.title;
        projectData.owner = row.owner;
        res.json(projectData);
    });
});

app.post('/api/save-project', requireAuth, (req, res) => {
    const { id, title, scriptHtml, setups, team, schedule } = req.body;
    const projectId = id || Date.now().toString();
    const owner = req.session.user.email;
    const now = Date.now();

    // Prepare data blob
    const fullData = JSON.stringify({ scriptHtml, setups, team, schedule });

    // UPSERT (Update if exists, Insert if new)
    const sql = `
        INSERT INTO projects (id, owner, title, updated_at, data) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
            title = excluded.title,
            updated_at = excluded.updated_at,
            data = excluded.data
    `;

    db.run(sql, [projectId, owner, title, now, fullData], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Real-time broadcast
        const newProject = { id: projectId, title, scriptHtml, setups, team, schedule, owner, updated_at: now };
        io.to(projectId).emit('project-updated', newProject);
        
        res.json({ success: true, id: projectId });
    });
});

app.delete('/api/project/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM projects WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- ONE-TIME MIGRATION (Legacy JSON -> SQLite) ---
const LEGACY_FILE = path.join(__dirname, 'data', 'projects.json');
if (fs.existsSync(LEGACY_FILE)) {
    const raw = fs.readFileSync(LEGACY_FILE);
    try {
        const legacyData = JSON.parse(raw);
        if (legacyData.length > 0) {
            console.log(`Migrating ${legacyData.length} projects from JSON to SQLite...`);
            const stmt = db.prepare("INSERT OR IGNORE INTO projects (id, owner, title, is_favorite, is_archived, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)");
            legacyData.forEach(p => {
                const blob = JSON.stringify({ 
                    scriptHtml: p.scriptHtml, setups: p.setups, team: p.team, schedule: p.schedule 
                });
                stmt.run(p.id, p.owner || 'admin@shotnest.com', p.title, p.isFavorite?1:0, p.isArchived?1:0, p.savedAt || Date.now(), blob);
            });
            stmt.finalize();
            console.log("Migration Complete. renaming old file.");
            fs.renameSync(LEGACY_FILE, LEGACY_FILE + '.bak');
        }
    } catch(e) { console.error("Migration skipped due to error:", e); }
}

// --- REAL-TIME PRESENCE (Unchanged) ---
const activeUsers = {}; 
const TEAM_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];

io.on('connection', (socket) => {
    socket.on('join-project', ({ projectId, userEmail }) => {
        socket.join(projectId);
        const randomColor = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
        if (!activeUsers[projectId]) activeUsers[projectId] = [];
        activeUsers[projectId] = activeUsers[projectId].filter(u => u.socketId !== socket.id);
        activeUsers[projectId].push({ socketId: socket.id, email: userEmail || 'Guest', color: randomColor });
        io.to(projectId).emit('room-users-update', activeUsers[projectId]);
    });

    socket.on('disconnect', () => {
        for (const projectId in activeUsers) {
            const index = activeUsers[projectId].findIndex(u => u.socketId === socket.id);
            if (index !== -1) {
                activeUsers[projectId].splice(index, 1);
                io.to(projectId).emit('room-users-update', activeUsers[projectId]);
                break; 
            }
        }
    });

    socket.on('script-change', (data) => socket.to(data.projectId).emit('script-changed', data));
    socket.on('shot-data-change', (data) => socket.to(data.projectId).emit('shot-data-changed', data));
    socket.on('shot-update', (data) => socket.to(data.projectId).emit('shot-updated', data));
    socket.on('new-comment', (data) => io.to(data.projectId).emit('comment-received', data));
    socket.on('new-setup', (data) => socket.to(data.projectId).emit('setup-created', data));
    socket.on('delete-setup', (data) => socket.to(data.projectId).emit('setup-deleted', data));
    socket.on('new-shot', (data) => socket.to(data.projectId).emit('shot-created', data));
    socket.on('delete-shot', (data) => socket.to(data.projectId).emit('shot-deleted', data));
    socket.on('schedule-update', (data) => socket.to(data.projectId).emit('schedule-updated', data));
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));