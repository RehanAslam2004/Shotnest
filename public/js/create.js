document.addEventListener('DOMContentLoaded', () => {

    // --- 0. MICRO-INTERACTIONS ---
    document.querySelectorAll('.interact-btn').forEach(btn => {
        btn.addEventListener('mousedown', () => gsap.to(btn, { scale: 0.95, duration: 0.1 }));
        btn.addEventListener('mouseup', () => gsap.to(btn, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" }));
        btn.addEventListener('mouseleave', () => gsap.to(btn, { scale: 1, duration: 0.2 }));
    });

    // --- 1. DYNAMIC SETUP LOGIC ---
    const masterContainer = document.getElementById('masterShotContainer');
    const btnAddSetup = document.getElementById('btnAddSetup');

    function createSetupBlock(title = "New Setup", existingShots = []) {
        const setupId = 'setup-' + Date.now();
        const badgeId = 'badge-' + Date.now();
        
        const setupDiv = document.createElement('div');
        setupDiv.className = "setup-group mb-4 opacity-0"; 
        setupDiv.innerHTML = `
            <div class="flex justify-between items-center mb-2 px-1 group">
                <input type="text" value="${title}" class="bg-transparent text-xs font-bold opacity-50 uppercase tracking-widest focus:opacity-100 focus:text-blue-500 outline-none setup-title-input" />
                <div class="flex items-center gap-2">
                    <span id="${badgeId}" class="text-[10px] text-blue-500 font-bold bg-blue-500/10 px-2 py-1 rounded-md">0m</span>
                    <button class="delete-setup interact-btn opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 w-6 h-6 rounded flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
            <div class="sortable-list space-y-2 min-h-[20px] pb-2" id="${setupId}"></div>
            <button class="add-shot-btn interact-btn w-full py-3 rounded-xl border border-dashed border-gray-500/20 opacity-40 hover:opacity-100 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest transition">+ Add Shot</button>
        `;

        masterContainer.appendChild(setupDiv);
        gsap.fromTo(setupDiv, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" });

        const list = setupDiv.querySelector('.sortable-list');
        new Sortable(list, {
            group: 'shared-shots',
            animation: 150,
            ghostClass: 'opacity-50',
            handle: '.shot-card-item', // Drag whole card
            onEnd: () => recalculateAllTimes()
        });

        setupDiv.querySelector('.add-shot-btn').addEventListener('click', () => {
            const count = document.querySelectorAll('.shot-card-item').length + 1;
            createShotCard({ id: count, type: 'NEW SHOT', desc: 'Describe shot...', time: 10 }, list);
            recalculateAllTimes();
        });

        setupDiv.querySelector('.delete-setup').addEventListener('click', () => {
            if(confirm('Delete this setup?')) {
                gsap.to(setupDiv, { height: 0, opacity: 0, duration: 0.3, onComplete: () => { setupDiv.remove(); recalculateAllTimes(); }});
            }
        });

        if(existingShots.length > 0) existingShots.forEach(s => createShotCard(s, list));
        recalculateAllTimes();
    }

    if(masterContainer.children.length === 0) {
        createSetupBlock("Setup A: Wide Master");
    }

    if(btnAddSetup) btnAddSetup.addEventListener('click', () => createSetupBlock("New Setup"));

    function recalculateAllTimes() {
        document.querySelectorAll('.setup-group').forEach(group => {
            const inputs = group.querySelectorAll('.shot-time');
            const badge = group.querySelector('span[id^="badge-"]');
            let total = 0;
            inputs.forEach(i => total += (parseInt(i.value) || 0));
            const h = Math.floor(total / 60);
            const m = total % 60;
            if(badge) badge.innerText = (h > 0) ? `${h}h ${m}m` : `${m}m`;
        });
    }

    // --- 2. SHOT CARD LOGIC (GRID LAYOUT) ---
    function createShotCard(shot, container) {
        const card = document.createElement('div');
        // Themed card with Grid Layout
        card.className = "themed-card p-3 rounded-xl shadow-sm cursor-grab active:cursor-grabbing group relative shot-card-item opacity-0 border-l-4 border-l-blue-500";
        
        // Thumbnail Logic
        const imgSrc = shot.image || '';
        const thumbContent = imgSrc 
            ? `<img src="${imgSrc}" class="w-full h-full object-cover rounded-md" />`
            : `<i class="fa-solid fa-image text-2xl opacity-20 group-hover:opacity-40 transition"></i>`;

        card.innerHTML = `
            <div class="shot-grid">
                <div class="flex items-center justify-center h-full">
                    <span class="bg-black/10 dark:bg-white/10 text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full shot-id">${shot.id}</span>
                </div>

                <div class="shot-thumb trigger-upload relative group/thumb">
                    ${thumbContent}
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition">
                        <i class="fa-solid fa-pen text-white text-xs"></i>
                    </div>
                </div>

                <div class="flex flex-col justify-center min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-sm shot-type truncate pr-2" contenteditable="true">${shot.type}</span>
                        <input type="number" class="shot-time w-10 bg-transparent text-xs text-right font-bold opacity-60 focus:opacity-100 hover:bg-white/5 rounded px-1" value="${shot.time||''}" title="Minutes">
                    </div>
                    <p class="text-xs opacity-60 shot-desc truncate" contenteditable="true">${shot.desc}</p>
                </div>

                <div class="flex flex-col items-center justify-center h-full gap-2">
                    <button class="delete-shot opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 w-6 h-6 rounded flex items-center justify-center transition"><i class="fa-solid fa-xmark text-xs"></i></button>
                    <i class="fa-solid fa-grip-lines text-xs opacity-20"></i>
                </div>

                <input type="file" accept="image/*" class="hidden img-input">
                <img src="${imgSrc}" class="hidden shot-img-storage"> </div>
        `;

        container.appendChild(card);
        gsap.to(card, { opacity: 1, duration: 0.3 });

        // Logic
        const timeInput = card.querySelector('.shot-time');
        timeInput.addEventListener('input', recalculateAllTimes);

        const thumbBox = card.querySelector('.trigger-upload');
        const imgInput = card.querySelector('.img-input');
        const imgStorage = card.querySelector('.shot-img-storage');
        
        thumbBox.addEventListener('click', () => imgInput.click());
        
        imgInput.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => { 
                    imgStorage.src = ev.target.result; 
                    // Update visual thumbnail
                    thumbBox.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover rounded-md" />`;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        card.querySelector('.delete-shot').addEventListener('click', () => {
            gsap.to(card, { height: 0, opacity: 0, margin: 0, padding: 0, duration: 0.2, onComplete: () => {
                card.remove();
                recalculateAllTimes();
            }});
        });
    }

    // --- 3. VIEW TRANSITIONS ---
    const btnShot = document.getElementById('btnViewShotList');
    const btnSched = document.getElementById('btnViewSchedule');
    const work = document.getElementById('mainWorkspace');
    const sched = document.getElementById('scheduleWorkspace');
    const viewPill = document.getElementById('viewPill');

    function updatePillState(isSchedule) {
        if (isSchedule) {
            gsap.to(viewPill, { x: 106, duration: 0.3, ease: "power2.out" });
            btnShot.classList.replace('text-white', 'text-gray-500');
            btnSched.classList.replace('text-gray-500', 'text-white');
        } else {
            gsap.to(viewPill, { x: 0, duration: 0.3, ease: "power2.out" });
            btnShot.classList.replace('text-gray-500', 'text-white');
            btnSched.classList.replace('text-white', 'text-gray-500');
        }
    }

    if(btnShot) {
        btnShot.addEventListener('click', () => {
            updatePillState(false);
            sched.style.pointerEvents = "none";
            gsap.to(sched, { x: "100%", opacity: 0, duration: 0.4, ease: "power2.in" });
            gsap.to(work, { x: "0%", opacity: 1, duration: 0.4, delay: 0.1, ease: "power2.out" });
        });

        btnSched.addEventListener('click', () => {
            updatePillState(true);
            syncStripboard();
            sched.style.pointerEvents = "auto";
            gsap.to(work, { x: "-20%", opacity: 0, duration: 0.4, ease: "power2.in" });
            gsap.to(sched, { x: "0%", opacity: 1, duration: 0.4, delay: 0.1, ease: "power2.out" });
        });
    }

    // --- 4. EXPORT MODAL ---
    const modal = document.getElementById('exportModal');
    const modalContent = modal.querySelector('.modal-content');
    
    document.getElementById('triggerExport').addEventListener('click', () => {
        modal.classList.remove('hidden');
        gsap.to(modal, { opacity: 1, pointerEvents: "auto", duration: 0.2 });
        gsap.fromTo(modalContent, { scale: 0.9, y: 10 }, { scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" });
    });

    document.getElementById('closeModal').addEventListener('click', () => {
        gsap.to(modal, { opacity: 0, pointerEvents: "none", duration: 0.2, onComplete: () => modal.classList.add('hidden') });
    });

    // --- 5. PDF GEN ---
    const expScript = document.getElementById('expScript');
    const expShots = document.getElementById('expShots');
    const expFull = document.getElementById('expFull');
    const projectTitleInput = document.getElementById('projectTitle');
    const scriptContent = document.getElementById('scriptContent');

    function generatePDF(mode) {
        gsap.to(modal, { opacity: 0, pointerEvents: "none", duration: 0.2, onComplete: () => modal.classList.add('hidden') });
        const title = projectTitleInput.value || "Project Export";
        
        const styles = `<style>@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap'); body { font-family: 'Outfit', sans-serif; color: black !important; } .script-text { font-family: 'Courier New', monospace; white-space: pre-wrap; font-size: 14px; margin-bottom: 40px;} .pdf-header { background: #111; color: white; padding: 20px; margin-bottom: 20px; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th { background: #eee; padding: 8px; text-align: left; } td { border-bottom: 1px solid #ddd; padding: 8px; vertical-align:top; } .setup-head { font-weight: bold; font-size: 16px; margin-top: 20px; border-bottom: 2px solid black; } .thumb-col { width: 80px; } .thumb-img { width: 80px; height: 45px; object-fit: cover; }</style>`;
        
        const container = document.createElement('div');
        container.innerHTML = styles + `<div class="pdf-header"><h1>${title}</h1><p>${new Date().toLocaleDateString()}</p></div>`;

        if(mode === 'script' || mode === 'full') {
            container.innerHTML += `<h2>Script</h2><div class="script-text">${scriptContent.innerText}</div>`;
        }
        if(mode === 'shots' || mode === 'full') {
            container.innerHTML += `<div style="page-break-before: always;"><h2>Shot List</h2></div>`;
            document.querySelectorAll('.setup-group').forEach(group => {
                const setupName = group.querySelector('.setup-title-input').value;
                const cards = group.querySelectorAll('.shot-card-item');
                if(cards.length > 0) {
                    let html = `<div class="setup-head">${setupName}</div><table><tr><th>#</th><th>Vis</th><th>Shot</th><th>Desc</th><th>Time</th></tr>`;
                    cards.forEach(c => {
                        // Get image from storage
                        const img = c.querySelector('.shot-img-storage').src;
                        const hasImg = img && !img.includes(window.location.href);
                        const imgHtml = hasImg ? `<img src="${img}" class="thumb-img">` : '';

                        html += `<tr>
                            <td>${c.querySelector('.shot-id').innerText}</td>
                            <td class="thumb-col">${imgHtml}</td>
                            <td>${c.querySelector('.shot-type').innerText}</td>
                            <td>${c.querySelector('.shot-desc').innerText}</td>
                            <td>${c.querySelector('.shot-time').value}m</td>
                        </tr>`;
                    });
                    html += `</table>`;
                    container.innerHTML += html;
                }
            });
        }
        html2pdf().from(container).save(`${title}_${mode}.pdf`);
    }

    if(expScript) expScript.addEventListener('click', () => generatePDF('script'));
    if(expShots) expShots.addEventListener('click', () => generatePDF('shots'));
    if(expFull) expFull.addEventListener('click', () => generatePDF('full'));

    // --- 6. SAVE & LOAD ---
    const saveBtn = document.getElementById('saveBtn');
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if(saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const icon = saveBtn.querySelector('i');
            gsap.to(icon, { rotation: 360, duration: 0.5 });
            
            const setups = [];
            document.querySelectorAll('.setup-group').forEach(group => {
                const shots = [];
                group.querySelectorAll('.shot-card-item').forEach(card => {
                    const img = card.querySelector('.shot-img-storage').src;
                    const hasImg = img && !img.includes(window.location.href);
                    
                    shots.push({
                        id: card.querySelector('.shot-id').innerText,
                        type: card.querySelector('.shot-type').innerText,
                        desc: card.querySelector('.shot-desc').innerText,
                        time: card.querySelector('.shot-time').value,
                        image: hasImg ? img : ''
                    });
                });
                setups.push({
                    title: group.querySelector('.setup-title-input').value,
                    shots: shots
                });
            });

            const projectData = { id: projectId, title: projectTitleInput.value, scriptHtml: scriptContent.innerHTML, setups: setups };
            await fetch('/api/save-project', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(projectData) });
            
            icon.classList.remove('fa-cloud'); icon.classList.add('fa-check', 'text-green-400');
            setTimeout(() => { icon.classList.remove('fa-check', 'text-green-400'); icon.classList.add('fa-cloud'); gsap.set(icon, { rotation: 0 }); }, 2000);
            
            if(!projectId) window.location.href = `/dashboard`;
        });
    }

    // Schedule / Script formatting logic remains similar
    const unscheduledList = document.getElementById('unscheduledList');
    const scheduledDaysContainer = document.getElementById('scheduledDaysContainer');
    
    function syncStripboard() {
        // Simple rebuild logic for stripboard
        unscheduledList.innerHTML = '';
        document.querySelectorAll('.shot-card-item').forEach(card => {
            const id = card.querySelector('.shot-id').innerText;
            if(document.querySelector(`.strip-item[data-id="${id}"]`)) return;

            const div = document.createElement('div');
            div.className = "themed-card p-2 rounded-lg flex items-center justify-between border-l-4 border-l-blue-500 cursor-grab mb-2 shadow-sm strip-item";
            div.setAttribute('data-id', id);
            div.setAttribute('data-time', card.querySelector('.shot-time').value);
            div.innerHTML = `<span class="font-bold text-xs">Shot ${id}</span><span class="text-xs opacity-50 truncate w-24">${card.querySelector('.shot-type').innerText}</span>`;
            unscheduledList.appendChild(div);
        });
        new Sortable(unscheduledList, { group: 'schedule', animation: 150 });
    }

    document.getElementById('addDayBtn').addEventListener('click', () => {
        const day = document.createElement('div');
        day.className = "day-container mb-4";
        day.innerHTML = `<div class="bg-black/80 text-white p-3 rounded-t-xl text-sm font-bold">DAY</div><div class="themed-card border-t-0 rounded-b-xl p-3 min-h-[50px] day-list bg-black/5"></div>`;
        scheduledDaysContainer.appendChild(day);
        new Sortable(day.querySelector('.day-list'), { group: 'schedule', animation: 150 });
    });

    if(projectId) {
        fetch(`/api/project/${projectId}`).then(r=>r.json()).then(data => {
            projectTitleInput.value = data.title;
            scriptContent.innerHTML = data.scriptHtml || '';
            masterContainer.innerHTML = '';
            if(data.setups) data.setups.forEach(s => createSetupBlock(s.title, s.shots));
            else if(data.setupA) { createSetupBlock("Setup A", data.setupA); createSetupBlock("Setup B", data.setupB); }
        });
    }

    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); formatSelection(btn.getAttribute('data-type')); });
    });
    function formatSelection(type) { 
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        let cls = "";
        if (type === 'scene') cls = "font-bold uppercase mt-6 mb-2 opacity-100 text-left border-b border-gray-500/20 pb-1"; 
        else if (type === 'action') cls = "themed-text-muted mb-2 text-left"; 
        else if (type === 'char') cls = "font-bold uppercase opacity-90 mt-4 ml-10 md:ml-48 w-fit"; 
        else if (type === 'dial') cls = "themed-text-muted mb-2 ml-4 md:ml-24 max-w-lg"; 
        if(node.id !== 'scriptContent') node.className = cls;
    }
});