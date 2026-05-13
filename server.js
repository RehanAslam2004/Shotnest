require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const socketHandler = require('./src/socket');
const pool = require('./src/config/db');

const server = http.createServer(app);
const io = new Server(server);

// Store io in app for access in controllers
app.set('socketio', io);

// Initialize Socket logic
socketHandler(io);

// Database Connection check
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error acquiring DB client', err.stack);
    } else {
        console.log('✅ Connected to Supabase (Postgres)');
        release();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});