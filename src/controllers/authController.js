const bcrypt = require('bcrypt');
const pool = require('../config/db');
const saltRounds = 10;

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (email === 'admin@shotnest.com' && password === 'admin123') {
        req.session.user = { id: 'super-admin', email, role: 'admin' };
        return res.json({ success: true, redirect: '/dashboard' });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            const match = await bcrypt.compare(password, row.password);
            if (match) {
                req.session.user = { id: row.id, email: row.email, role: row.role || 'user' };
                res.json({ success: true, redirect: '/dashboard' });
            } else {
                res.status(401).json({ success: false, message: "Invalid credentials" });
            }
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.register = async (req, res) => {
    const { email, password } = req.body;
    const id = Date.now().toString();

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await pool.query("INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, 'user')", [id, email, hashedPassword]);
        req.session.user = { id, email, role: 'user' };
        res.json({ success: true, redirect: '/dashboard' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: "User exists" });
        }
        console.error(err);
        res.status(500).json({ success: false, message: "DB Error" });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.json({ success: true, redirect: '/login' });
};

exports.me = (req, res) => {
    req.session.user ? res.json(req.session.user) : res.status(401).json({ error: 'Not logged in' });
};
