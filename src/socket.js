const activeUsers = {};
const TEAM_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('join-project', (data) => {
            if (!data || !data.projectId) return;
            const { projectId, userEmail } = data;
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
};
