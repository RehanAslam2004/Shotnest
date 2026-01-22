document.addEventListener('DOMContentLoaded', () => {

    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || 'demo'; 
    
    // --- 1. ROLE MANAGEMENT (FIXED) ---
    // If ?role=producer is in URL, use it. Otherwise default to Director.
    const urlRole = urlParams.get('role');
    let currentRole = urlRole || 'director'; 
    let projectTeam = [{ email: 'you@shotnest.com', role: 'director' }];
    let saveInterval;

    // --- 2. INITIALIZATION & PRESENCE ---
    const myEmail = "User" + Math.floor(Math.random() * 100); 
    
    socket.on('connect', () => {
        console.log("Connected. Joining project:", projectId);
        socket.emit('join-project', { projectId, userEmail: myEmail });
    });
    if (socket.connected) socket.emit('join-project', { projectId, userEmail: myEmail });
    
    // Update Badge UI immediately based on URL role
    const currentRoleBadge = document.getElementById('currentRoleBadge');
    if(currentRoleBadge) currentRoleBadge.innerText = currentRole.toUpperCase() + " MODE";
    
    loadProjectData();
    initTheme();
    setupAutoSave();
    
    setTimeout(() => switchTab('script'), 100); 

    const teamHeaderContainer = document.getElementById('teamAvatarContainer');
    socket.on('room-users-update', (users) => {
        if (!teamHeaderContainer) return;
        teamHeaderContainer.innerHTML = ''; 
        users.forEach(u => {
            const initials = u.email.substring(0, 2).toUpperCase();
            const avatar = document.createElement('div');
            avatar.className = `w-8 h-8 rounded-full ${u.color} border-2 border-[var(--bg-color)] flex items-center justify-center text-[10px] font-bold text-white relative group cursor-default transition-transform hover:scale-110 hover:z-10 shadow-sm`;
            avatar.title = u.email;
            avatar.innerHTML = `${initials}<div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--bg-color)] rounded-full"></div>`;
            teamHeaderContainer.appendChild(avatar);
        });
    });

    // --- 3. SCRIPT FORMATTING ---
    const scriptEditor = document.getElementById('scriptContent');
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); 
            const type = btn.getAttribute('data-type');
            formatLine(type);
        });
    });

    function formatLine(type) {
        if (currentRole !== 'director' && currentRole !== 'writer') return; // Basic permission check
        scriptEditor.focus(); 
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        if (node === scriptEditor) {
            document.execCommand('formatBlock', false, 'div');
            node = window.getSelection().getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
        }

        while (node && node.nodeName !== 'DIV' && node.nodeName !== 'P' && node !== scriptEditor) {
            node = node.parentNode;
        }

        if (node && node !== scriptEditor) {
            node.className = ''; 
            if (type === 'scene') node.className = 'script-scene';
            if (type === 'action') node.className = 'script-action';
            if (type === 'char') node.className = 'script-char';
            if (type === 'dial') node.className = 'script-dial';
            socket.emit('script-change', { projectId, html: scriptEditor.innerHTML });
        }
    }

    // --- 4. REAL-TIME SYNC ---
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    if(scriptEditor) {
        scriptEditor.addEventListener('input', debounce(() => {
            socket.emit('script-change', { projectId, html: scriptEditor.innerHTML });
        }, 300));
    }

    socket.on('script-changed', (data) => {
        const isTyping = (document.activeElement === scriptEditor) && document.hasFocus();
        if (!isTyping) scriptEditor.innerHTML = data.html;
    });

    socket.on('shot-data-changed', (data) => {
        const card = document.querySelector(`.shot-card-item[data-id="${data.shotId}"]`);
        if (!card) return;
        const updateField = (selector, value) => {
            const el = card.querySelector(selector);
            if (el && document.activeElement !== el) {
                if(el.tagName === 'DIV' || el.tagName === 'P') el.innerText = value; else el.value = value;
            }
        };
        if (data.field === 'desc') updateField('.shot-desc', data.value);
        if (data.field === 'lens') updateField('.shot-lens', data.value);
        if (data.field === 'fps') updateField('.shot-fps', data.value);
        if (data.field === 'type') updateField('.shot-type', data.value);
        if (data.field === 'angle') updateField('.shot-angle', data.value);
    });

    // --- 5. SHOT LIST LOGIC ---
    function createShotCard(shot = {}, container, emitEvent = true) {
        const s = {
            id: shot.id || 'shot-' + Date.now() + Math.floor(Math.random()*1000), 
            type: shot.type || 'Wide', angle: shot.angle || 'Eye', 
            desc: shot.desc || 'Description...', lens: shot.lens || '', fps: shot.fps || '', 
            time: shot.time || 5, status: shot.status || 'draft', image: shot.image || ''
        };
        const card = document.createElement('div');
        card.className = "themed-card p-4 rounded-xl flex flex-col gap-3 relative group hover:border-blue-500/50 transition duration-300 shot-card-item";
        card.setAttribute('data-id', s.id);
        const statusColors = { 'draft': 'status-draft', 'approved': 'status-approved', 'fix': 'status-fix' };
        
        card.innerHTML = `
            <div class="flex justify-between items-center drag-handle cursor-grab active:cursor-grabbing">
                <div class="flex items-center gap-2">
                    <span class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded shot-id-display">#</span>
                    <span class="status-pill ${statusColors[s.status]}" data-status="${s.status}">${s.status}</span>
                </div>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                     <button class="text-gray-500 hover:text-white comment-btn"><i class="fa-regular fa-message"></i></button>
                     <button class="text-red-500 delete-shot"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="aspect-video bg-black/20 rounded-lg overflow-hidden flex items-center justify-center relative trigger-upload cursor-pointer border border-white/5 hover:border-blue-500/50 transition">
                ${s.image ? `<img src="${s.image}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-image text-3xl opacity-20"></i>`}
                <div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition text-xs font-bold text-white">CHANGE IMAGE</div>
            </div>
            <div class="flex flex-col gap-2">
                <div class="flex gap-2">
                    <select class="w-1/2 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-bold shot-type outline-none text-current"><option value="Wide" ${s.type==='Wide'?'selected':''}>Wide</option><option value="Med" ${s.type==='Med'?'selected':''}>Med</option><option value="CU" ${s.type==='CU'?'selected':''}>CU</option></select>
                    <select class="w-1/2 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-bold shot-angle outline-none text-current"><option value="Eye" ${s.angle==='Eye'?'selected':''}>Eye</option><option value="Low" ${s.angle==='Low'?'selected':''}>Low</option></select>
                </div>
                <p class="text-sm opacity-80 min-h-[40px] border-b border-dashed border-white/10 focus:border-blue-500 outline-none shot-desc" contenteditable="true">${s.desc}</p>
                <div class="flex gap-2 mt-1">
                    <input type="text" class="w-1/2 bg-transparent text-[10px] border-b border-white/10 shot-lens focus:border-blue-500 outline-none placeholder-gray-600 text-current" placeholder="Lens" value="${s.lens}">
                    <input type="text" class="w-1/2 bg-transparent text-[10px] border-b border-white/10 shot-fps focus:border-blue-500 outline-none placeholder-gray-600 text-current" placeholder="FPS" value="${s.fps}">
                </div>
                <input type="hidden" class="shot-time" value="${s.time}">
            </div>
            <input type="file" class="hidden img-input" accept="image/*">
            <img src="${s.image}" class="hidden shot-img-storage">
        `;

        if (currentRole === 'dp') { card.querySelector('.delete-shot').remove(); card.querySelector('.shot-desc').contentEditable = false; }
        if (currentRole === 'producer' || currentRole === 'ad') { card.style.pointerEvents = "none"; card.querySelector('.delete-shot').remove(); }

        container.appendChild(card);
        gsap.from(card, { y: 20, opacity: 0, duration: 0.3 });
        updateShotNumbers(container);

        if (emitEvent) {
            const setupDiv = container.closest('.setup-group');
            if (setupDiv) socket.emit('new-shot', { projectId, setupId: setupDiv.querySelector('.sortable-list').id, shot: s });
        }

        const attachSync = (selector, field) => {
            const el = card.querySelector(selector);
            if(el) {
                el.addEventListener('input', debounce(() => {
                    const val = (el.tagName === 'DIV' || el.tagName === 'P') ? el.innerText : el.value;
                    socket.emit('shot-data-change', { projectId, shotId: s.id, field: field, value: val });
                }, 300));
            }
        };
        attachSync('.shot-desc', 'desc'); attachSync('.shot-lens', 'lens'); attachSync('.shot-fps', 'fps'); attachSync('.shot-type', 'type'); attachSync('.shot-angle', 'angle');

        card.querySelector('.status-pill').addEventListener('click', (e) => {
            if(currentRole !== 'director' && currentRole !== 'dp') return;
            const el = e.target;
            const next = el.innerText === 'draft' ? 'approved' : (el.innerText === 'approved' ? 'fix' : 'draft');
            el.className = `status-pill ${statusColors[next]}`; el.innerText = next; el.setAttribute('data-status', next);
            socket.emit('shot-update', { projectId, shotId: s.id, changes: { status: next } });
        });

        card.querySelector('.comment-btn').addEventListener('click', () => openComments(s.id));
        if (currentRole === 'director') {
            card.querySelector('.delete-shot').addEventListener('click', () => {
                socket.emit('delete-shot', { projectId, shotId: s.id });
                card.remove();
                updateShotNumbers(container);
            });
            const imgInput = card.querySelector('.img-input'); const trigger = card.querySelector('.trigger-upload');
            trigger.addEventListener('click', () => imgInput.click());
            imgInput.addEventListener('change', (e) => { if(e.target.files[0]){ const reader = new FileReader(); reader.onload = (ev) => { trigger.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`; }; reader.readAsDataURL(e.target.files[0]); } });
        }
    }
    
    function updateShotNumbers(container) {
        if(!container) return;
        Array.from(container.children).forEach((card, index) => {
            const badge = card.querySelector('.shot-id-display');
            if(badge) badge.innerText = (index + 1);
        });
    }

    socket.on('setup-created', (data) => createSetupBlock(data.title, [], false, data.id));
    socket.on('setup-deleted', (data) => { const setupDiv = document.getElementById(data.setupId)?.closest('.setup-group'); if(setupDiv) setupDiv.remove(); });
    socket.on('shot-created', (data) => { const container = document.getElementById(data.setupId); if(container) createShotCard(data.shot, container, false); });
    socket.on('shot-deleted', (data) => { const card = document.querySelector(`.shot-card-item[data-id="${data.shotId}"]`); if(card) { const container = card.parentElement; card.remove(); updateShotNumbers(container); }});

    // --- 6. SETUP & SAVE ---
    const masterContainer = document.getElementById('masterShotContainer');
    const btnAddSetup = document.getElementById('btnAddSetup');
    
    function createSetupBlock(title="New Setup", existingShots=[], emitEvent=true, explicitId=null) {
        const setupId = explicitId || 'setup-' + Date.now() + Math.floor(Math.random()*1000);
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
            </button>`;
        masterContainer.appendChild(setupDiv); 
        gsap.to(setupDiv, { opacity: 1, duration: 0.4 });
        
        if (emitEvent) socket.emit('new-setup', { projectId, title, id: setupId });

        const list = setupDiv.querySelector('.sortable-list'); 
        new Sortable(list, { group: 'shared-shots', animation: 150, handle: '.drag-handle', disabled: (currentRole!=='director') });
        setupDiv.querySelector('.add-shot-btn').addEventListener('click', () => createShotCard({}, list, true));
        setupDiv.querySelector('.delete-setup').addEventListener('click', () => { 
            if(confirm('Delete?')) { socket.emit('delete-setup', { projectId, setupId }); setupDiv.remove(); } 
        });
        if(existingShots.length > 0) existingShots.forEach(s => createShotCard(s, list, false));
    }
    if(btnAddSetup) btnAddSetup.addEventListener('click', () => createSetupBlock("New Setup"));

    async function saveProject() {
        const saveBtn = document.getElementById('saveBtn'); const icon = saveBtn ? saveBtn.querySelector('i') : null;
        if(icon) gsap.to(icon, { rotation: 360, duration: 1, repeat: -1, ease: "linear" });
        const setups = [];
        document.querySelectorAll('.setup-group').forEach(group => { const shots = []; group.querySelectorAll('.shot-card-item').forEach(card => { const img = card.querySelector('.shot-img-storage').src; const hasImg = img && !img.includes(window.location.href); shots.push({ id: card.getAttribute('data-id'), type: card.querySelector('.shot-type').value, angle: card.querySelector('.shot-angle').value, desc: card.querySelector('.shot-desc').innerText, lens: card.querySelector('.shot-lens').value, fps: card.querySelector('.shot-fps').value, time: card.querySelector('.shot-time').value, status: card.querySelector('.status-pill').getAttribute('data-status') || 'draft', image: hasImg ? img : '' }); }); setups.push({ title: group.querySelector('.setup-title-input').value, shots: shots }); });
        const schedule = []; document.querySelectorAll('.day-strip').forEach(day => { const title = day.querySelector('.day-title-input').value; const dayShots = []; day.querySelectorAll('.strip-item').forEach(item => dayShots.push(item.getAttribute('data-id'))); schedule.push({ title: title, shots: dayShots }); });
        const projectData = { id: projectId, title: document.getElementById('projectTitle').value, scriptHtml: document.getElementById('scriptContent').innerHTML, setups: setups, schedule: schedule, team: projectTeam };
        try { const res = await fetch('/api/save-project', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(projectData) }); if(res.ok && icon) { gsap.killTweensOf(icon); gsap.to(icon, { rotation: 0, duration: 0.2, onComplete: () => { icon.className = "fa-solid fa-check text-green-500"; setTimeout(() => { icon.className = "fa-solid fa-cloud"; }, 2000); }}); } } catch (e) { if(icon) { gsap.killTweensOf(icon); icon.className = "fa-solid fa-triangle-exclamation text-red-500"; } }
    }

    async function loadProjectData() {
        try { 
            const res = await fetch(`/api/project/${projectId}`); 
            if(!res.ok) { createSetupBlock("Scene 1 Setup", [], false); return; } 
            const data = await res.json(); 
            document.getElementById('projectTitle').value = data.title || "Untitled"; 
            document.getElementById('scriptContent').innerHTML = data.scriptHtml || ''; 
            
            // Sync Team Data
            if(data.team) projectTeam = data.team;
            
            const masterContainer = document.getElementById('masterShotContainer'); masterContainer.innerHTML = ''; 
            if(data.setups && data.setups.length > 0) data.setups.forEach(s => createSetupBlock(s.title, s.shots, false, null)); else createSetupBlock("Scene 1 Setup", [], false); 
            
            const daysContainer = document.getElementById('scheduledDaysContainer'); daysContainer.innerHTML = ''; 
            if(data.schedule && data.schedule.length > 0) { data.schedule.forEach(day => { const title = day.title || `Day`; const shotIds = Array.isArray(day) ? day : (day.shots || []); addDayStrip(title, shotIds); }); } else { addDayStrip("Day 1"); } 
            
            enforcePermissions(); 
        } catch(e) { }
    }

    // --- 7. TEAM MANAGEMENT & INVITES (UPDATED) ---
    // Listen for global project updates (like team changes)
    socket.on('project-updated', (data) => {
        if (data.team) {
            projectTeam = data.team;
            if (document.getElementById('teamModal').style.display !== 'none') {
                renderTeam(); // Live update the list if modal is open
            }
        }
    });

    const btnInvite = document.getElementById('btnInvite');
    if (btnInvite) {
        btnInvite.addEventListener('click', () => {
            const email = document.getElementById('inviteEmail').value;
            const role = document.getElementById('inviteRole').value;
            
            if (email) {
                // 1. Add to team
                projectTeam.push({ email, role });
                renderTeam(); 
                saveProject(); // This triggers 'project-updated' for everyone

                // 2. Generate SPECIFIC Link for that role
                // Removes any existing &role params, then appends the new one
                const baseUrl = window.location.href.split('&role')[0];
                const inviteLink = `${baseUrl}&role=${role}`;

                navigator.clipboard.writeText(inviteLink).then(() => {
                    const originalText = btnInvite.innerText;
                    btnInvite.innerText = "Link Copied!";
                    btnInvite.classList.replace('bg-blue-600', 'bg-green-600');
                    setTimeout(() => { 
                        btnInvite.innerText = originalText; 
                        btnInvite.classList.replace('bg-green-600', 'bg-blue-600'); 
                    }, 2000);
                });
                document.getElementById('inviteEmail').value = '';
            }
        });
    }

    function renderTeam() { 
        const list = document.getElementById('teamList'); 
        list.innerHTML = ''; 
        projectTeam.forEach((member, index) => { 
            const row = document.createElement('div'); 
            row.className = 'team-row'; 
            
            // REMOVE BUTTON LOGIC
            // Don't allow removing yourself (index 0 usually owner) or simple safety check
            const removeBtn = index > 0 
                ? `<button class="text-red-500 hover:text-red-400 p-2 transition delete-member" data-index="${index}"><i class="fa-solid fa-trash"></i></button>` 
                : `<span class="text-xs opacity-30 p-2">OWNER</span>`;

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="avatar-circle">${member.email.substring(0,2).toUpperCase()}</div>
                    <div>
                        <div class="text-sm font-bold">${member.email}</div>
                        <div class="text-xs opacity-50 uppercase">${member.role}</div>
                    </div>
                </div>
                ${removeBtn}
            `; 
            list.appendChild(row); 
        });

        // Attach Delete Listeners
        document.querySelectorAll('.delete-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (confirm(`Remove ${projectTeam[idx].email}?`)) {
                    projectTeam.splice(idx, 1);
                    renderTeam();
                    saveProject(); // Updates DB and syncs everyone
                }
            });
        });
    }
    
    // --- 8. UTILS & OTHERS ---
    function setupAutoSave() { document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }}); saveInterval = setInterval(saveProject, 60000); }
    const saveBtn = document.getElementById('saveBtn'); if(saveBtn) saveBtn.addEventListener('click', saveProject);
    const tabs = { script: { btn: document.getElementById('navScript'), view: document.getElementById('viewScript') }, shots: { btn: document.getElementById('navShots'), view: document.getElementById('viewShots') }, schedule: { btn: document.getElementById('navSchedule'), view: document.getElementById('viewSchedule') } };
    function switchTab(activeKey) { Object.values(tabs).forEach(t => t.btn.classList.remove('active')); tabs[activeKey].btn.classList.add('active'); Object.keys(tabs).forEach(key => { const view = tabs[key].view; if(key === activeKey) { gsap.to(view, { y: 0, opacity: 1, zIndex: 10, duration: 0.4, ease: "power2.out", pointerEvents: "auto" }); if(key==='schedule') syncStripboard(); } else { gsap.to(view, { y: 20, opacity: 0, zIndex: 0, duration: 0.3, ease: "power2.in", pointerEvents: "none" }); } }); }
    if(tabs.script.btn) tabs.script.btn.addEventListener('click', () => switchTab('script'));
    if(tabs.shots.btn) tabs.shots.btn.addEventListener('click', () => switchTab('shots'));
    if(tabs.schedule.btn) tabs.schedule.btn.addEventListener('click', () => switchTab('schedule'));
    function initTheme() { const themeBtn = document.getElementById('themeToggle'); const icon = themeBtn ? themeBtn.querySelector('i') : null; const savedTheme = localStorage.getItem('theme'); if (savedTheme === 'light') { document.body.classList.add('light-mode'); if(icon) icon.className = 'fa-solid fa-sun'; } if(themeBtn) { themeBtn.addEventListener('click', () => { document.body.classList.toggle('light-mode'); const isLight = document.body.classList.contains('light-mode'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); if(icon) { gsap.to(icon, { rotation: 360, duration: 0.5, onComplete: () => { icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; gsap.set(icon, { rotation: 0 }); }}); } }); } }
    function openModal(modalId) { const modal = document.getElementById(modalId); const content = modal.querySelector('.modal-content'); modal.classList.remove('hidden'); modal.style.display = 'flex'; gsap.to(modal, { opacity: 1, duration: 0.2 }); gsap.fromTo(content, { scale: 0.95, y: 10, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }); }
    function closeModal(modalId) { const modal = document.getElementById(modalId); const content = modal.querySelector('.modal-content'); gsap.to(content, { scale: 0.95, y: 10, opacity: 0, duration: 0.2 }); gsap.to(modal, { opacity: 0, duration: 0.2, delay: 0.1, onComplete: () => { modal.classList.add('hidden'); modal.style.display = 'none'; }}); }
    
    // Schedule Logic
    const unscheduledList = document.getElementById('unscheduledList'); const scheduledDaysContainer = document.getElementById('scheduledDaysContainer'); const addDayBtn = document.getElementById('addDayBtn');
    function emitScheduleUpdate() { const scheduleState = []; document.querySelectorAll('.day-strip').forEach(day => { const title = day.querySelector('.day-title-input').value; const shots = []; day.querySelectorAll('.strip-item').forEach(item => shots.push(item.getAttribute('data-id'))); scheduleState.push({ title, shots }); }); socket.emit('schedule-update', { projectId, schedule: scheduleState }); }
    socket.on('schedule-updated', (data) => { if(document.activeElement.tagName !== 'INPUT') { scheduledDaysContainer.innerHTML = ''; if(data.schedule && data.schedule.length > 0) { data.schedule.forEach(day => addDayStrip(day.title, day.shots, false)); } syncStripboard(); } });
    if(addDayBtn) addDayBtn.addEventListener('click', () => { const dayCount = scheduledDaysContainer.querySelectorAll('.day-strip').length + 1; addDayStrip(`Day ${dayCount}`); emitScheduleUpdate(); });
    function addDayStrip(titleVal="New Day", shotIds=[], emit=true) { const div = document.createElement('div'); div.className = "day-strip bg-black/20 border border-white/10 p-4 rounded-xl relative group mb-4"; div.innerHTML = `<div class="flex justify-between items-center mb-3"><input type="text" value="${titleVal}" class="day-title-input bg-transparent text-xs font-bold uppercase tracking-widest opacity-60 outline-none focus:opacity-100 focus:text-blue-500 transition w-full text-current" /><button class="text-red-500 opacity-0 group-hover:opacity-100 transition delete-day"><i class="fa-solid fa-trash"></i></button></div><div class="min-h-[50px] border-2 border-dashed border-white/5 rounded-lg sortable-day transition hover:border-white/10 p-2 gap-2 flex flex-wrap"></div>`; scheduledDaysContainer.appendChild(div); const sortContainer = div.querySelector('.sortable-day'); new Sortable(sortContainer, { group: 'schedule', animation: 150, onEnd: () => emitScheduleUpdate() }); if (shotIds.length > 0) { shotIds.forEach(id => { const originalCard = document.querySelector(`.shot-card-item[data-id="${id}"]`); const type = originalCard ? originalCard.querySelector('.shot-type').value : 'Shot'; sortContainer.appendChild(createStripItem(id, type)); }); } div.querySelector('.delete-day').addEventListener('click', () => { if(confirm('Remove this day?')) { div.querySelectorAll('.strip-item').forEach(item => unscheduledList.appendChild(item)); div.remove(); emitScheduleUpdate(); } }); if(emit) emitScheduleUpdate(); }
    function createStripItem(id, type) { const div = document.createElement('div'); div.className = "themed-card px-3 py-2 rounded-lg flex items-center gap-3 border-l-4 border-l-blue-500 cursor-grab shadow-sm strip-item text-xs font-bold bg-[#252529] text-white"; div.setAttribute('data-id', id); div.innerHTML = `<span>#${id}</span><span class="opacity-50">${type}</span>`; return div; }
    function syncStripboard() { unscheduledList.innerHTML = ''; document.querySelectorAll('.shot-card-item').forEach(card => { const id = card.getAttribute('data-id'); let isScheduled = false; document.querySelectorAll('.day-strip .strip-item').forEach(item => { if(item.getAttribute('data-id') === id) isScheduled = true; }); if(!isScheduled) { const type = card.querySelector('.shot-type').value; unscheduledList.appendChild(createStripItem(id, type)); } }); new Sortable(unscheduledList, { group: 'schedule', animation: 150, onEnd: () => emitScheduleUpdate() }); }

    socket.on('shot-updated', (data) => { const card = document.querySelector(`.shot-card-item[data-id="${data.shotId}"]`); if (card && data.changes && data.changes.status) { const badge = card.querySelector('.status-pill'); const colors = { 'draft': 'status-draft', 'approved': 'status-approved', 'fix': 'status-fix' }; badge.className = `status-pill ${colors[data.changes.status]}`; badge.innerText = data.changes.status; badge.setAttribute('data-status', data.changes.status); } });
    document.getElementById('triggerTeam').addEventListener('click', () => { renderTeam(); openModal('teamModal'); }); document.getElementById('closeTeamModal').addEventListener('click', () => closeModal('teamModal')); 
    document.getElementById('closeComments').addEventListener('click', () => { document.getElementById('commentDrawer').classList.remove('open'); activeShotId = null; }); function openComments(shotId) { activeShotId = shotId; document.getElementById('commentList').innerHTML = ''; addCommentBubble("Can we get a tighter angle here?", "DoP", false); document.getElementById('commentDrawer').classList.add('open'); } document.getElementById('commentInput').addEventListener('keypress', (e) => { if (e.key === 'Enter' && e.target.value) { addCommentBubble(e.target.value, "You", true); socket.emit('new-comment', { projectId, shotId: activeShotId, text: e.target.value, user: "Director" }); e.target.value = ''; }}); function addCommentBubble(text, user, isMe) { const div = document.createElement('div'); div.className = `msg-bubble ${isMe ? 'border-blue-500/30 bg-blue-500/10' : ''}`; div.innerHTML = `<div class="text-[10px] font-bold opacity-50 mb-1 flex justify-between"><span>${user}</span><span>Now</span></div><div class="leading-relaxed">${text}</div>`; document.getElementById('commentList').appendChild(div); }
    const importBtn = document.getElementById('importScriptBtn'); const fileInput = document.getElementById('scriptFileInput'); if(importBtn && fileInput) { importBtn.addEventListener('click', () => fileInput.click()); fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(file) { const reader = new FileReader(); reader.onload = (ev) => { document.getElementById('scriptContent').innerText = ev.target.result; }; reader.readAsText(file); } }); }
    const projectTitleInput = document.getElementById('projectTitle'); document.getElementById('triggerExport').addEventListener('click', () => { document.getElementById('metaTitle').value = projectTitleInput.value; openModal('exportModal'); }); document.getElementById('closeModal').addEventListener('click', () => closeModal('exportModal')); document.getElementById('btnGeneratePdf').addEventListener('click', () => { closeModal('exportModal'); alert('PDF Generated'); });
});