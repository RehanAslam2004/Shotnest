const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'data', 'projects.json');

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROUTES (CRITICAL FIX) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'public', 'studio.html')));

// --- DATA HELPERS ---
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DATA_FILE)); } catch (e) { return []; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// --- API ---
app.get('/api/projects', (req, res) => res.json(loadData()));
app.get('/api/project/:id', (req, res) => {
    const p = loadData().find(x => x.id === req.params.id);
    p ? res.json(p) : res.status(404).send('Not Found');
});

app.post('/api/save-project', (req, res) => {
    const projects = loadData();
    const { id, title, scriptHtml, setups, team, schedule } = req.body;
    const idx = projects.findIndex(p => p.id === id);
    
    const newProject = {
        id: id || Date.now().toString(),
        title: title || "Untitled",
        scriptHtml: scriptHtml || "",
        setups: setups || [],
        schedule: schedule || [],
        team: team || [],
        savedAt: Date.now(),
        isFavorite: idx >= 0 ? projects[idx].isFavorite : false,
        isArchived: idx >= 0 ? projects[idx].isArchived : false
    };

    if (idx >= 0) projects[idx] = newProject; else projects.push(newProject);
    saveData(projects);
    io.to(newProject.id).emit('project-updated', newProject);
    res.json({ success: true, id: newProject.id });
});

app.delete('/api/project/:id', (req, res) => {
    let projects = loadData();
    projects = projects.filter(p => p.id !== req.params.id);
    saveData(projects);
    res.json({ success: true });
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    socket.on('join-project', (projectId) => socket.join(projectId));
    socket.on('script-change', (data) => socket.to(data.projectId).emit('script-changed', data));
    socket.on('shot-data-change', (data) => socket.to(data.projectId).emit('shot-data-changed', data));
    socket.on('shot-update', (data) => socket.to(data.projectId).emit('shot-updated', data));
    socket.on('new-comment', (data) => io.to(data.projectId).emit('comment-received', data));
});

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));