export class ShotListModule {
    constructor(app) {
        this.app = app;
        this.masterContainer = document.getElementById('masterShotContainer');
        this.init();
    }

    init() {
        const btnAddSetup = document.getElementById('btnAddSetup');
        if (btnAddSetup) {
            btnAddSetup.addEventListener('click', () => this.createSetupBlock("New Setup"));
        }
    }

    createSetupBlock(title = "New Setup", existingShots = [], emitEvent = true, explicitId = null) {
        const setupId = explicitId || 'setup-' + Date.now() + Math.floor(Math.random() * 1000);
        const setupDiv = document.createElement('div');
        setupDiv.className = "setup-group mb-12 opacity-0";
        setupDiv.innerHTML = `
            <div class="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
                <input type="text" value="${title}" class="bg-transparent text-xl font-bold focus:text-blue-500 outline-none setup-title-input w-full text-current" />
                <button class="delete-setup text-red-500 opacity-50 hover:opacity-100 transition"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="shot-grid-layout sortable-list" id="${setupId}"></div>
            <button class="add-shot-btn w-full py-4 mt-4 rounded-xl border border-dashed border-white/10 opacity-50 hover:opacity-100 hover:bg-white/5 transition flex items-center justify-center gap-2 text-current">
                <i class="fa-solid fa-plus"></i> Add Shot
            </button>
        `;
        this.masterContainer.appendChild(setupDiv);
        gsap.to(setupDiv, { opacity: 1, duration: 0.4 });

        if (emitEvent) this.app.socket.emit('new-setup', { projectId: this.app.projectId, title, id: setupId });

        const list = setupDiv.querySelector('.sortable-list');
        new Sortable(list, {
            group: 'shared-shots',
            animation: 150,
            handle: '.drag-handle',
            disabled: (this.app.currentRole !== 'director')
        });

        setupDiv.querySelector('.add-shot-btn').addEventListener('click', () => this.createShotCard({}, list, true));
        setupDiv.querySelector('.delete-setup').addEventListener('click', () => {
            if (confirm('Delete setup?')) {
                this.app.socket.emit('delete-setup', { projectId: this.app.projectId, setupId });
                setupDiv.remove();
            }
        });

        if (existingShots.length > 0) {
            existingShots.forEach(s => this.createShotCard(s, list, false));
        }
    }

    createShotCard(s = {}, container, emitEvent = true) {
        const id = s.id || 'shot-' + Date.now() + Math.floor(Math.random() * 1000);
        const card = document.createElement('div');
        card.className = "shot-card-item themed-card rounded-2xl border border-white/10 p-4 relative group flex flex-col gap-4";
        card.setAttribute('data-id', id);

        const imgHtml = s.image ? `<img src="${s.image}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-camera text-2xl opacity-20"></i>`;

        card.innerHTML = `
            <div class="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition">
                <button class="drag-handle w-7 h-7 rounded-lg bg-black/50 flex items-center justify-center text-[10px]"><i class="fa-solid fa-grip-vertical"></i></button>
                <button class="delete-shot w-7 h-7 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center text-[10px] hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i></button>
            </div>
            
            <div class="flex gap-4">
                <div class="shot-img-container w-24 h-24 rounded-xl overflow-hidden bg-black/20 border border-white/5 relative flex items-center justify-center">
                    <div class="shot-img-preview absolute inset-0 flex items-center justify-center">${imgHtml}</div>
                    <img class="shot-img-storage hidden" src="${s.image || ''}">
                    <div class="image-upload-overlay absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition flex flex-col items-center justify-center cursor-pointer">
                        <span class="text-[8px] font-bold uppercase tracking-tighter">Change Image</span>
                        <input type="file" class="hidden image-input" accept="image/*">
                    </div>
                </div>

                <div class="flex-1 space-y-3">
                    <div class="flex items-center gap-2">
                        <span class="shot-id-display w-6 h-6 rounded bg-blue-500/20 text-blue-500 text-[10px] font-bold flex items-center justify-center">1</span>
                        <select class="shot-type bg-transparent text-sm font-bold outline-none border-b border-white/5 focus:border-blue-500">
                            ${['Wide', 'Medium', 'Close-Up', 'Extreme CU', 'Master'].map(t => `<option value="${t}" ${s.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        <div class="status-pill status-${s.status || 'draft'}" data-status="${s.status || 'draft'}">${s.status || 'draft'}</div>
                    </div>
                    <div class="shot-desc text-xs opacity-70 outline-none min-h-[40px] focus:opacity-100" contenteditable="true">${s.desc || 'Shot description...'}</div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <div class="bg-black/10 p-2 rounded-lg border border-white/5">
                    <label class="text-[8px] uppercase opacity-30 block">Angle</label>
                    <input type="text" value="${s.angle || ''}" class="shot-angle bg-transparent text-[10px] outline-none w-full" placeholder="e.g. Low">
                </div>
                <div class="bg-black/10 p-2 rounded-lg border border-white/5">
                    <label class="text-[8px] uppercase opacity-30 block">Lens</label>
                    <input type="text" value="${s.lens || ''}" class="shot-lens bg-transparent text-[10px] outline-none w-full" placeholder="e.g. 35mm">
                </div>
                <div class="bg-black/10 p-2 rounded-lg border border-white/5">
                    <label class="text-[8px] uppercase opacity-30 block">FPS</label>
                    <input type="text" value="${s.fps || '24'}" class="shot-fps bg-transparent text-[10px] outline-none w-full">
                </div>
            </div>
        `;

        container.appendChild(card);
        this.updateShotNumbers(container);

        if (emitEvent) this.app.socket.emit('new-shot', { projectId: this.app.projectId, setupId: container.id, shot: { ...s, id } });

        // Event listeners for inputs
        card.querySelector('.delete-shot').addEventListener('click', () => {
            if (confirm('Delete shot?')) {
                this.app.socket.emit('delete-shot', { projectId: this.app.projectId, shotId: id });
                card.remove();
                this.updateShotNumbers(container);
            }
        });

        // Image upload handling
        const uploadOverlay = card.querySelector('.image-upload-overlay');
        const fileInput = card.querySelector('.image-input');
        uploadOverlay.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Handle upload to Supabase or local storage
                this.app.uploadImage(id, file, card);
            }
        });
    }

    updateShotNumbers(container) {
        if (!container) return;
        Array.from(container.children).forEach((card, index) => {
            const badge = card.querySelector('.shot-id-display');
            if (badge) badge.innerText = (index + 1);
        });
    }
}
