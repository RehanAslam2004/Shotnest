export class SocketHandler {
    constructor(app) {
        this.app = app;
        this.socket = app.socket;
        this.init();
    }

    // Bug 1 fix: Provide emit() so callers can do socketHandler.emit(event, data)
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        }
    }

    init() {
        this.socket.on('connect', () => {
            console.log('Connected to Shotnest real-time network');
            // Bug 2 fix: Send object with projectId (server expects data.projectId)
            this.socket.emit('join-project', {
                projectId: this.app.projectId,
                userEmail: 'user' // Will be enriched when auth context is available
            });
        });

        this.socket.on('project-updated', (data) => {
            if (data.team) {
                this.app.projectTeam = data.team;
                this.app.renderTeam();
            }
        });

        this.socket.on('setup-created', (data) => {
            this.app.shotList.createSetupBlock(data.title, [], false, data.id);
        });

        this.socket.on('shot-created', (data) => {
            const container = document.getElementById(data.setupId);
            if (container) this.app.shotList.createShotCard(data.shot, container, false);
        });

        this.socket.on('schedule-updated', (data) => {
            if (document.activeElement.tagName !== 'INPUT') {
                this.app.schedule.container.innerHTML = '';
                if (data.schedule && data.schedule.length > 0) {
                    data.schedule.forEach(day => this.app.schedule.addDayStrip(day.title, day.shots, false));
                }
                this.app.schedule.sync();
            }
        });

        // Add more listeners as needed
    }
}
