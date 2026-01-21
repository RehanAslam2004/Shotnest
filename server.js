// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());

// IMPORTANT: We set 'index: false' to stop it from automatically loading index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- ROUTES ---

// 1. Root -> Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// 2. Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 3. Studio (The Editor)
app.get('/studio', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'studio.html')); // Renamed file
});

// --- API ROUTES (Unchanged) ---
app.get('/api/projects', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'shots.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if(err) return res.json([]);
        try { res.json(JSON.parse(data)); } catch { res.json([]); }
    });
});

app.get('/api/project/:id', (req, res) => {
    // ... (Keep your existing GET logic)
    const projectId = req.params.id;
    const dataPath = path.join(__dirname, 'data', 'shots.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if(err) return res.status(500).send();
        const projects = JSON.parse(data);
        const p = projects.find(x => x.id == projectId);
        p ? res.json(p) : res.status(404).send();
    });
});

app.post('/api/save-project', (req, res) => {
    // ... (Keep your existing POST logic)
    const projectData = req.body;
    const dataPath = path.join(__dirname, 'data', 'shots.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        let projects = [];
        try { projects = JSON.parse(data); } catch {}
        
        const idx = projects.findIndex(p => p.id == projectData.id);
        if (idx !== -1) projects[idx] = { ...projects[idx], ...projectData, savedAt: new Date() };
        else { projectData.id = Date.now(); projectData.savedAt = new Date(); projects.push(projectData); }

        fs.writeFile(dataPath, JSON.stringify(projects, null, 2), () => res.json({ success: true, projectId: projectData.id }));
    });
});

app.delete('/api/project/:id', (req, res) => {
    // ... (Keep your existing DELETE logic)
     const projectId = req.params.id;
    const dataPath = path.join(__dirname, 'data', 'shots.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        let projects = JSON.parse(data);
        projects = projects.filter(p => p.id != projectId);
        fs.writeFile(dataPath, JSON.stringify(projects, null, 2), () => res.json({ success: true }));
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));