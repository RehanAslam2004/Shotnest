const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // 1. Create new tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS setups (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT,
                order_index INTEGER
            );

            CREATE TABLE IF NOT EXISTS shots (
                id TEXT PRIMARY KEY,
                setup_id TEXT REFERENCES setups(id) ON DELETE CASCADE,
                project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
                type TEXT,
                angle TEXT,
                description TEXT,
                lens TEXT,
                fps TEXT,
                status TEXT,
                image_url TEXT,
                order_index INTEGER
            );

            CREATE TABLE IF NOT EXISTS schedule_days (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT,
                order_index INTEGER
            );

            CREATE TABLE IF NOT EXISTS schedule_items (
                id SERIAL PRIMARY KEY,
                day_id TEXT REFERENCES schedule_days(id) ON DELETE CASCADE,
                shot_id TEXT REFERENCES shots(id) ON DELETE CASCADE,
                order_index INTEGER
            );
        `);

        console.log('Tables created.');

        // 2. Fetch all existing projects
        const { rows: projects } = await client.query('SELECT id, data, owner FROM projects');

        for (const project of projects) {
            if (!project.data) continue;

            let data;
            try {
                data = JSON.parse(project.data);
            } catch (e) {
                console.error(`Failed to parse data for project ${project.id}`);
                continue;
            }

            console.log(`Migrating project: ${project.id}`);

            // Update project with scriptHtml if it exists in JSON
            if (data.scriptHtml) {
                // Ensure script_html column exists (we'll add it if it doesn't)
                try {
                    await client.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS script_html TEXT');
                    await client.query('UPDATE projects SET script_html = $1 WHERE id = $2', [data.scriptHtml, project.id]);
                } catch (e) {
                    console.error('Error adding script_html column', e.message);
                }
            }

            // Migrate Setups & Shots
            if (data.setups && Array.isArray(data.setups)) {
                for (let sIdx = 0; sIdx < data.setups.length; sIdx++) {
                    const setup = data.setups[sIdx];
                    const setupId = setup.id || `setup-${Date.now()}-${sIdx}`;
                    
                    await client.query(`
                        INSERT INTO setups (id, project_id, title, order_index)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (id) DO NOTHING
                    `, [setupId, project.id, setup.title, sIdx]);

                    if (setup.shots && Array.isArray(setup.shots)) {
                        for (let shIdx = 0; shIdx < setup.shots.length; shIdx++) {
                            const shot = setup.shots[shIdx];
                            const shotId = shot.id || `shot-${Date.now()}-${shIdx}`;

                            await client.query(`
                                INSERT INTO shots (id, setup_id, project_id, type, angle, description, lens, fps, status, image_url, order_index)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                ON CONFLICT (id) DO NOTHING
                            `, [shotId, setupId, project.id, shot.type, shot.angle, shot.desc, shot.lens, shot.fps, shot.status, shot.image, shIdx]);
                        }
                    }
                }
            }

            // Migrate Schedule
            if (data.schedule && Array.isArray(data.schedule)) {
                for (let dIdx = 0; dIdx < data.schedule.length; dIdx++) {
                    const day = data.schedule[dIdx];
                    const dayId = day.id || `day-${Date.now()}-${dIdx}`;
                    
                    await client.query(`
                        INSERT INTO schedule_days (id, project_id, title, order_index)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (id) DO NOTHING
                    `, [dayId, project.id, day.title, dIdx]);

                    if (day.shots && Array.isArray(day.shots)) {
                        for (let iIdx = 0; iIdx < day.shots.length; iIdx++) {
                            const shotId = day.shots[iIdx];
                            // Check if shot exists first to avoid foreign key violation
                            const { rows: shotExists } = await client.query('SELECT id FROM shots WHERE id = $1', [shotId]);
                            if (shotExists.length > 0) {
                                await client.query(`
                                    INSERT INTO schedule_items (day_id, shot_id, order_index)
                                    VALUES ($1, $2, $3)
                                `, [dayId, shotId, iIdx]);
                            }
                        }
                    }
                }
            }
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
