const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Trust Proxy for Render/Heroku
app.set('trust proxy', 1);

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session
const isProduction = process.env.NODE_ENV === 'production';
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
        secure: isProduction
    }
}));

// HTML Routes (Pages)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/studio', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'studio.html')));
app.get('/calendar', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'calendar.html')));

// API Routes
app.use('/api', authRoutes);
app.use('/api', projectRoutes);

module.exports = app;
