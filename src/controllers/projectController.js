const pool = require('../config/db');

exports.listProjects = async (req, res) => {
    try {
        const sql = "SELECT id, title, is_favorite, is_archived, updated_at, owner FROM projects WHERE owner = $1 ORDER BY updated_at DESC";
        const result = await pool.query(sql, [req.session.user.email]);
        // Bug 8 fix: Map snake_case DB columns to camelCase for frontend
        const mapped = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            isFavorite: row.is_favorite,
            isArchived: row.is_archived,
            updatedAt: row.updated_at,
            savedAt: row.updated_at,
            owner: row.owner
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProject = async (req, res) => {
    try {
        const projectResult = await pool.query("SELECT * FROM projects WHERE id = $1", [req.params.id]);
        if (projectResult.rows.length === 0) return res.status(404).send('Not Found');
        
        const project = projectResult.rows[0];
        
        // Fetch Setups with their Shots
        const setupsResult = await pool.query("SELECT * FROM setups WHERE project_id = $1 ORDER BY order_index ASC", [req.params.id]);
        const setups = setupsResult.rows;
        
        for (let setup of setups) {
            const shotsResult = await pool.query("SELECT * FROM shots WHERE setup_id = $1 ORDER BY order_index ASC", [setup.id]);
            setup.shots = shotsResult.rows.map(s => ({
                id: s.id,
                type: s.type,
                angle: s.angle,
                desc: s.description,
                lens: s.lens,
                fps: s.fps,
                status: s.status,
                image: s.image_url
            }));
        }
        
        // Fetch Schedule Days with their Items
        const daysResult = await pool.query("SELECT * FROM schedule_days WHERE project_id = $1 ORDER BY order_index ASC", [req.params.id]);
        const schedule = daysResult.rows;
        
        for (let day of schedule) {
            const itemsResult = await pool.query("SELECT shot_id FROM schedule_items WHERE day_id = $1 ORDER BY order_index ASC", [day.id]);
            day.shots = itemsResult.rows.map(i => i.shot_id);
        }
        
        // Deserialize team from data column if it exists
        let team = [];
        if (project.data) {
            try {
                const data = JSON.parse(project.data);
                team = data.team || [];
            } catch (e) {}
        }

        const projectData = {
            id: project.id,
            title: project.title,
            owner: project.owner,
            scriptHtml: project.script_html || "",
            setups: setups,
            schedule: schedule,
            team: team
        };
        
        res.json(projectData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.saveProject = async (req, res) => {
    const { id, title, scriptHtml, setups, team, schedule, isFavorite, isArchived } = req.body;
    const projectId = id || Date.now().toString();
    const owner = req.session.user.email;
    const now = Date.now(); 

    // Bug 5 fix: If this is a metadata-only update (favorite/archive toggle),
    // handle it without touching relational data
    const isPartialUpdate = (setups === undefined && schedule === undefined && scriptHtml === undefined);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (isPartialUpdate) {
            // Metadata-only update (favorite, archive, title)
            const updates = [];
            const values = [];
            let paramIdx = 1;

            if (title !== undefined) { updates.push(`title = $${paramIdx++}`); values.push(title); }
            if (isFavorite !== undefined) { updates.push(`is_favorite = $${paramIdx++}`); values.push(isFavorite); }
            if (isArchived !== undefined) { updates.push(`is_archived = $${paramIdx++}`); values.push(isArchived); }
            updates.push(`updated_at = $${paramIdx++}`); values.push(now);
            values.push(projectId);

            if (updates.length > 0) {
                await client.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
            }

            await client.query('COMMIT');
            return res.json({ success: true, id: projectId });
        }

        // Full save: Update project metadata
        await client.query(`
            INSERT INTO projects (id, owner, title, updated_at, script_html, data) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT(id) DO UPDATE SET 
                title = excluded.title,
                updated_at = excluded.updated_at,
                script_html = excluded.script_html,
                data = excluded.data
        `, [projectId, owner, title, now, scriptHtml, JSON.stringify({team})]);

        // Clear old relational data (only on full save)
        await client.query('DELETE FROM setups WHERE project_id = $1', [projectId]);
        await client.query('DELETE FROM schedule_days WHERE project_id = $1', [projectId]);

        // 3. Insert Setups & Shots
        if (setups && Array.isArray(setups)) {
            for (let sIdx = 0; sIdx < setups.length; sIdx++) {
                const setup = setups[sIdx];
                const setupId = setup.id || `setup-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${sIdx}`;
                
                await client.query(`
                    INSERT INTO setups (id, project_id, title, order_index)
                    VALUES ($1, $2, $3, $4)
                `, [setupId, projectId, setup.title, sIdx]);

                if (setup.shots && Array.isArray(setup.shots)) {
                    for (let shIdx = 0; shIdx < setup.shots.length; shIdx++) {
                        const shot = setup.shots[shIdx];
                        const shotId = shot.id || `shot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${shIdx}`;

                        await client.query(`
                            INSERT INTO shots (id, setup_id, project_id, type, angle, description, lens, fps, status, image_url, order_index)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        `, [shotId, setupId, projectId, shot.type, shot.angle, shot.desc, shot.lens, shot.fps, shot.status, shot.image, shIdx]);
                    }
                }
            }
        }

        // 4. Insert Schedule
        if (schedule && Array.isArray(schedule)) {
            for (let dIdx = 0; dIdx < schedule.length; dIdx++) {
                const day = schedule[dIdx];
                const dayId = day.id || `day-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${dIdx}`;
                
                await client.query(`
                    INSERT INTO schedule_days (id, project_id, title, order_index)
                    VALUES ($1, $2, $3, $4)
                `, [dayId, projectId, day.title, dIdx]);

                if (day.shots && Array.isArray(day.shots)) {
                    for (let iIdx = 0; iIdx < day.shots.length; iIdx++) {
                        const shotId = day.shots[iIdx];
                        await client.query(`
                            INSERT INTO schedule_items (day_id, shot_id, order_index)
                            VALUES ($1, $2, $3)
                        `, [dayId, shotId, iIdx]);
                    }
                }
            }
        }

        await client.query('COMMIT');
        
        // Real-time broadcast
        const io = req.app.get('socketio');
        if (io) {
            io.to(projectId).emit('project-updated', { 
                id: projectId, title, scriptHtml, setups, team, schedule, owner, updated_at: now 
            });
        }
        
        res.json({ success: true, id: projectId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

exports.deleteProject = async (req, res) => {
    try {
        await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
