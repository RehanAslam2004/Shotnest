const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function hashExistingPasswords() {
    const client = await pool.connect();
    try {
        console.log('Fetching users with plain-text passwords...');
        const { rows: users } = await client.query('SELECT id, password FROM users');
        
        for (const user of users) {
            // Check if it's already a bcrypt hash (starts with $2b$ or $2a$)
            if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
                console.log(`Skipping already hashed password for user: ${user.id}`);
                continue;
            }

            console.log(`Hashing password for user: ${user.id}`);
            const hash = await bcrypt.hash(user.password, 10);
            await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
        }
        console.log('All passwords hashed successfully!');
    } catch (err) {
        console.error('Error hashing passwords:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

hashExistingPasswords();
