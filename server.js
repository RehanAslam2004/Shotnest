require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- DATABASE CONNECTION (SUPABASE/POSTGRES) ---
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test Connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Connected to Supabase (Postgres)');
        release();
    }
});

// --- MIDDLEWARE ---
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session Store (Saves login sessions to DB so they persist)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'shotnest-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days
        secure: isProduction // true in production (https), false in dev
    } 
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

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Super Admin Hardcode (Optional, keep if you want)
    if (email === 'admin@shotnest.com' && password === 'admin123') {
        req.session.user = { id: 'super-admin', email, role: 'admin' };
        return res.json({ success: true, redirect: '/dashboard' });
    }

    try {
        // Postgres Syntax: $1, $2 instead of ?
        const result = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            req.session.user = { id: row.id, email: row.email, role: row.role || 'user' };
            res.json({ success: true, redirect: '/dashboard' });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const id = Date.now().toString();

    try {
        await pool.query("INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, 'user')", [id, email, password]);
        req.session.user = { id, email, role: 'user' };
        res.json({ success: true, redirect: '/dashboard' });
    } catch (err) {
        if (err.code === '23505') { // Postgres Unique Violation code
            return res.status(400).json({ success: false, message: "User exists" });
        }
        console.error(err);
        res.status(500).json({ success: false, message: "DB Error" });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, redirect: '/login' });
});

app.get('/api/me', (req, res) => {
    req.session.user ? res.json(req.session.user) : res.status(401).json({ error: 'Not logged in' });
});

// --- API: PROJECTS ---

app.get('/api/projects', requireAuth, async (req, res) => {
    try {
        // Fetch metadata only. 
        // Note: is_favorite and is_archived are booleans in PG, might need casting if frontend expects 0/1, 
        // but JS handles true/false fine in boolean logic.
        const sql = "SELECT id, title, is_favorite, is_archived, updated_at, owner FROM projects WHERE owner = $1 ORDER BY updated_at DESC";
        const result = await pool.query(sql, [req.session.user.email]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/project/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM projects WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Not Found');
        
        const row = result.rows[0];
        // Parse the JSON blob
        const projectData = JSON.parse(row.data);
        projectData.id = row.id;
        projectData.title = row.title;
        projectData.owner = row.owner;
        res.json(projectData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save-project', requireAuth, async (req, res) => {
    const { id, title, scriptHtml, setups, team, schedule } = req.body;
    const projectId = id || Date.now().toString();
    const owner = req.session.user.email;
    const now = Date.now(); // Stored as BIGINT in Postgres

    const fullData = JSON.stringify({ scriptHtml, setups, team, schedule });

    const sql = `
        INSERT INTO projects (id, owner, title, updated_at, data) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(id) DO UPDATE SET 
            title = excluded.title,
            updated_at = excluded.updated_at,
            data = excluded.data
    `;

    try {
        await pool.query(sql, [projectId, owner, title, now, fullData]);
        
        // Real-time broadcast
        const newProject = { id: projectId, title, scriptHtml, setups, team, schedule, owner, updated_at: now };
        io.to(projectId).emit('project-updated', newProject);
        
        res.json({ success: true, id: projectId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/project/:id', requireAuth, async (req, res) => {
    try {
        await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REAL-TIME PRESENCE (Unchanged) ---
const activeUsers = {}; 
const TEAM_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];

io.on('connection', (socket) => {
    socket.on('join-project', ({ projectId, userEmail }) => {
        socket.join(projectId);
        const randomColor = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
        if (!activeUsers[projectId]) activeUsers[projectId] = [];
        // Remove existing instance of this socket if any
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

    // Real-time Events
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));