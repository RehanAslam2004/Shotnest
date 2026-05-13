import { EditorModule } from './modules/Editor.js';
import { ShotListModule } from './modules/ShotList.js';
import { ScheduleModule } from './modules/Schedule.js';
import { ExportModule } from './modules/Export.js';
import { SocketHandler } from './modules/SocketHandler.js';

class ShotnestApp {
    constructor() {
        this.projectId = new URLSearchParams(window.location.search).get('id');
        this.currentRole = new URLSearchParams(window.location.search).get('role') || 'director';
        this.socket = io();
        this.globalProjectData = null;
        this.projectTeam = [];
        
        this.init();
    }

    async init() {
        console.log("Initializing Shotnest App...");
        
        // Initialize Modules
        this.editor = new EditorModule(this);
        this.shotList = new ShotListModule(this);
        this.schedule = new ScheduleModule(this);
        this.export = new ExportModule(this);
        this.socketHandler = new SocketHandler(this);

        this.setupUI();
        await this.loadProjectData();
        this.setupAutoSave();
        this.initTheme();

        // Initial tab
        this.switchTab('script');
    }

    setupUI() {
        // Tab switching
        this.tabs = {
            script: { btn: document.getElementById('navScript'), view: document.getElementById('viewScript') },
            shots: { btn: document.getElementById('navShots'), view: document.getElementById('viewShots') },
            schedule: { btn: document.getElementById('navSchedule'), view: document.getElementById('viewSchedule') }
        };

        Object.keys(this.tabs).forEach(key => {
            this.tabs[key].btn.addEventListener('click', () => this.switchTab(key));
        });

        // Save buttons
        const forceSaveBtn = document.getElementById('forceSaveBtn');
        if (forceSaveBtn) forceSaveBtn.addEventListener('click', () => this.saveProject());

        // Team modal
        const triggerTeam = document.getElementById('triggerTeam');
        if (triggerTeam) triggerTeam.addEventListener('click', () => {
            this.renderTeam();
            this.openModal('teamModal');
        });

        const closeTeamModal = document.getElementById('closeTeamModal');
        if (closeTeamModal) closeTeamModal.addEventListener('click', () => this.closeModal('teamModal'));
    }

    switchTab(activeKey) {
        Object.values(this.tabs).forEach(t => t.btn.classList.remove('active'));
        this.tabs[activeKey].btn.classList.add('active');

        Object.keys(this.tabs).forEach(key => {
            const view = this.tabs[key].view;
            if (key === activeKey) {
                gsap.to(view, { y: 0, opacity: 1, zIndex: 10, duration: 0.4, ease: "power2.out", pointerEvents: "auto" });
                if (key === 'schedule') this.schedule.sync();
            } else {
                gsap.to(view, { y: 20, opacity: 0, zIndex: 0, duration: 0.3, ease: "power2.in", pointerEvents: "none" });
            }
        });
    }

    async loadProjectData() {
        if (!this.projectId) {
            console.log("No project ID found, creating fresh workspace.");
            this.shotList.createSetupBlock("Scene 1 Setup", [], false);
            return;
        }

        try {
            const res = await fetch(`/api/project/${this.projectId}`);
            if (!res.ok) {
                this.shotList.createSetupBlock("Scene 1 Setup", [], false);
                return;
            }

            const data = await res.json();
            this.globalProjectData = data;
            this.projectTeam = data.team || [];

            document.getElementById('projectTitle').value = data.title || "Untitled";
            document.getElementById('scriptContent').innerHTML = data.scriptHtml || '<div class="script-action"><br></div>';

            const masterContainer = document.getElementById('masterShotContainer');
            masterContainer.innerHTML = '';
            if (data.setups && data.setups.length > 0) {
                data.setups.forEach(s => this.shotList.createSetupBlock(s.title, s.shots, false, s.id));
            } else {
                this.shotList.createSetupBlock("Scene 1 Setup", [], false);
            }

            const daysContainer = document.getElementById('scheduledDaysContainer');
            daysContainer.innerHTML = '';
            if (data.schedule && data.schedule.length > 0) {
                data.schedule.forEach(day => this.schedule.addDayStrip(day.title, day.shots, false));
            } else {
                this.schedule.addDayStrip("Day 1");
            }
        } catch (e) {
            console.error("Failed to load project:", e);
            this.shotList.createSetupBlock("Scene 1 Setup", [], false);
        }
    }

    async saveProject() {
        console.log("Saving project...");
        const saveBtn = document.getElementById('forceSaveBtn');
        const icon = saveBtn ? saveBtn.querySelector('i') : null;
        if (icon) gsap.to(icon, { rotation: 360, duration: 1, repeat: -1, ease: "linear" });

        const setups = [];
        document.querySelectorAll('.setup-group').forEach(group => {
            const shots = [];
            group.querySelectorAll('.shot-card-item').forEach(card => {
                const img = card.querySelector('.shot-img-storage').src;
                const hasImg = img && !img.includes(window.location.href);
                shots.push({
                    id: card.getAttribute('data-id'),
                    type: card.querySelector('.shot-type').value,
                    angle: card.querySelector('.shot-angle').value,
                    desc: card.querySelector('.shot-desc').innerText,
                    lens: card.querySelector('.shot-lens').value,
                    fps: card.querySelector('.shot-fps').value,
                    status: card.querySelector('.status-pill').getAttribute('data-status') || 'draft',
                    image: hasImg ? img : ''
                });
            });
            setups.push({ 
                id: group.getAttribute('data-id'),
                title: group.querySelector('.setup-title-input').value, 
                shots: shots 
            });
        });

        const schedule = [];
        document.querySelectorAll('.day-strip').forEach(day => {
            const title = day.querySelector('.day-title-input').value;
            const dayShots = [];
            day.querySelectorAll('.strip-item').forEach(item => dayShots.push(item.getAttribute('data-id')));
            schedule.push({ title, shots: dayShots });
        });

        const projectData = {
            id: this.projectId,
            title: document.getElementById('projectTitle').value,
            scriptHtml: document.getElementById('scriptContent').innerHTML,
            setups: setups,
            schedule: schedule,
            team: this.projectTeam
        };

        try {
            const res = await fetch('/api/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            if (res.ok) {
                const result = await res.json();
                
                // Bug 3 fix: Server returns { success, id }, not { project }
                // Update projectId if it was newly created or if server assigned one
                const returnedId = result.id || result.project?.id;
                if (returnedId && !this.projectId) {
                    this.projectId = returnedId;
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('id', this.projectId);
                    window.history.pushState({ id: this.projectId }, '', newUrl);
                }

                // Keep globalProjectData as the local state we sent
                this.globalProjectData = projectData;
                this.globalProjectData.id = this.projectId;

                if (icon) {
                    gsap.killTweensOf(icon);
                    gsap.to(icon, { rotation: 0, duration: 0.2, onComplete: () => {
                        icon.className = "fa-solid fa-check text-green-500";
                        setTimeout(() => { icon.className = "fa-solid fa-save"; }, 2000);
                    }});
                }

                // Notify other clients via socket
                this.socketHandler.emit('script-change', {
                    projectId: this.projectId,
                    scriptHtml: projectData.scriptHtml
                });
            } else {
                if (res.status === 401) {
                    alert("Your session has expired. Please log in again.");
                    window.location.href = "/login";
                }
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${res.status}`);
            }
        } catch (e) {
            console.error("Save failed:", e);
            if (icon) {
                gsap.killTweensOf(icon);
                icon.className = "fa-solid fa-triangle-exclamation text-red-500";
                setTimeout(() => { icon.className = "fa-solid fa-save"; }, 5000);
            }
        }
    }

    setupAutoSave() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveProject();
            }
        });
        this.saveInterval = setInterval(() => this.saveProject(), 60000);
    }

    initTheme() {
        const themeBtn = document.getElementById('themeToggle');
        const icon = themeBtn ? themeBtn.querySelector('i') : null;
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            if (icon) icon.className = 'fa-solid fa-sun';
        }
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('light-mode');
                const isLight = document.body.classList.contains('light-mode');
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
                if (icon) {
                    gsap.to(icon, { rotation: 360, duration: 0.5, onComplete: () => {
                        icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
                        gsap.set(icon, { rotation: 0 });
                    }});
                }
            });
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        const content = modal.querySelector('.modal-content');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        gsap.to(modal, { opacity: 1, duration: 0.2 });
        gsap.fromTo(content, { scale: 0.95, y: 10, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: "back.out(1.7)" });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const content = modal.querySelector('.modal-content');
        gsap.to(content, { scale: 0.95, y: 10, opacity: 0, duration: 0.2 });
        gsap.to(modal, { opacity: 0, duration: 0.2, delay: 0.1, onComplete: () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }});
    }

    renderTeam() {
        const list = document.getElementById('teamList');
        if (!list) return;
        list.innerHTML = '';
        this.projectTeam.forEach((member, index) => {
            const row = document.createElement('div');
            row.className = 'team-row';
            const removeBtn = index > 0 ? `<button class="text-red-500 hover:text-red-400 p-2 transition delete-member" data-index="${index}"><i class="fa-solid fa-trash"></i></button>` : `<span class="text-xs opacity-30 p-2">OWNER</span>`;
            row.innerHTML = `<div class="flex items-center gap-3"><div class="avatar-circle">${member.email.substring(0, 2).toUpperCase()}</div><div><div class="text-sm font-bold">${member.email}</div><div class="text-xs opacity-50 uppercase">${member.role}</div></div></div>${removeBtn}`;
            list.appendChild(row);
        });
        
        document.querySelectorAll('.delete-member').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (confirm(`Remove ${this.projectTeam[idx].email}?`)) {
                    this.projectTeam.splice(idx, 1);
                    this.renderTeam();
                    this.saveProject();
                }
            });
        });
    }

    async uploadImage(shotId, file, card) {
        const text = card.querySelector('.image-upload-overlay span');
        const preview = card.querySelector('.shot-img-preview');
        const hiddenStorage = card.querySelector('.shot-img-storage');

        text.innerText = "UPLOADING...";
        text.style.opacity = "1";

        try {
            // Simplified for now - assume supabase is available globally or injected
            const fileName = `${this.projectId}/${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from('Shot-images').upload(fileName, file);
            if (error) throw error;
            const { data: publicData } = supabase.storage.from('Shot-images').getPublicUrl(fileName);
            const publicUrl = publicData.publicUrl;
            
            preview.innerHTML = `<img src="${publicUrl}" class="w-full h-full object-cover">`;
            hiddenStorage.src = publicUrl;
            text.innerText = "CHANGE IMAGE";
            text.style.opacity = "";
            this.socket.emit('shot-update', { projectId: this.projectId, shotId, changes: { image: publicUrl } });
            this.saveProject();
        } catch (err) {
            console.error("Upload failed:", err);
            text.innerText = "FAILED";
            setTimeout(() => text.innerText = "CHANGE IMAGE", 2000);
        }
    }
}

// Global container for the app
window.app = new ShotnestApp();