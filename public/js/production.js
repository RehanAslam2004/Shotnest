document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIG ---
    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || 'demo'; 

    let projectData = {};
    let departments = []; 
    let crewList = [];    
    let gearList = [];
    let budgetList = [];
    let shootDays = 1;

    let currentTab = 'crew';
    let activeDeptId = null;

    // --- INIT ---
    socket.on('connect', () => {
        socket.emit('join-project', { projectId, userEmail: "Producer" });
        loadProject();
    });

    initTheme(); // Light/Dark Mode support

    // Navigation
    const navStudio = document.getElementById('navStudio');
    if(navStudio) navStudio.addEventListener('click', () => window.location.href = `/studio.html?id=${projectId}`);
    
    const navCalendar = document.getElementById('navCalendar');
    if(navCalendar) navCalendar.addEventListener('click', () => window.location.href = `/calendar.html?id=${projectId}`);

    // Shoot Days Update
    const daysInput = document.getElementById('inputShootDays');
    if (daysInput) {
        daysInput.addEventListener('change', (e) => {
            shootDays = parseInt(e.target.value) || 1;
            if(shootDays < 1) shootDays = 1;
            saveProject(false); 
            renderBudget(); 
        });
    }

    // --- THEME ---
    function initTheme() {
        const btn = document.getElementById('themeToggle');
        const icon = btn.querySelector('i');
        const saved = localStorage.getItem('theme');
        
        if (saved === 'light') {
            document.body.classList.add('light-mode');
            icon.className = 'fa-solid fa-sun nav-icon';
        }

        btn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            icon.className = isLight ? 'fa-solid fa-sun nav-icon' : 'fa-solid fa-moon nav-icon';
        });
    }

    // --- DATA ---
    async function loadProject() {
        try {
            const res = await fetch(`/api/project/${projectId}`);
            if(res.ok) {
                projectData = await res.json();
                document.getElementById('projectTitleDisplay').innerText = projectData.title || "Untitled Project";
                
                crewList = projectData.production_crew || [];
                gearList = projectData.production_gear || [];
                budgetList = projectData.production_budget || [];
                shootDays = projectData.shootDays || 1; 

                const dInput = document.getElementById('inputShootDays');
                if(dInput) dInput.value = shootDays;
                
                if (projectData.production_departments && projectData.production_departments.length > 0) {
                    departments = projectData.production_departments;
                } else {
                    departments = [ {id: 'd1', title: 'Production'}, {id: 'd2', title: 'Camera'}, {id: 'd3', title: 'Sound'} ];
                }
                
                renderCrewBoard();
                renderGearList();
                renderBudget();
            }
        } catch(e) { showToast("Error loading project", "error"); }
    }

    async function saveProject(showFeedback = true) {
        projectData.production_crew = crewList;
        projectData.production_gear = gearList;
        projectData.production_budget = budgetList;
        projectData.production_departments = departments;
        projectData.shootDays = shootDays; 

        try { 
            await fetch('/api/save-project', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(projectData) });
            if(showFeedback) showToast("Changes saved");
        } catch(e) { 
            if(showFeedback) showToast("Save failed", "error");
        }
    }

    // --- 1. CREW BOARD ---
    function renderCrewBoard() {
        const board = document.getElementById('crewBoard');
        if(!board) return;
        board.innerHTML = '';

        departments.forEach(dept => {
            const members = crewList.filter(c => c.deptId === dept.id || c.department === dept.title);
            const col = document.createElement('div');
            col.className = 'board-col';
            col.innerHTML = `
                <div class="col-header group">
                    <input type="text" class="col-title-input" value="${dept.title}" data-dept-id="${dept.id}">
                    <button class="text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] delete-dept-btn"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="col-list" data-dept-id="${dept.id}"></div>
                <button class="w-full py-2 text-[9px] font-bold text-[var(--text-muted)] hover:text-blue-500 hover:bg-white/5 transition border-t border-[var(--border)] add-crew-btn rounded-b-lg flex items-center justify-center gap-1">
                    <i class="fa-solid fa-plus"></i> Add
                </button>
            `;

            col.querySelector('.col-title-input').addEventListener('change', (e) => { dept.title = e.target.value; saveProject(false); });

            col.querySelector('.delete-dept-btn').addEventListener('click', () => {
                if(confirm('Delete department?')) {
                    departments = departments.filter(d => d.id !== dept.id);
                    crewList = crewList.filter(c => c.deptId !== dept.id && c.department !== dept.title);
                    saveProject(); renderCrewBoard(); renderBudget();
                }
            });

            col.querySelector('.add-crew-btn').addEventListener('click', () => { activeDeptId = dept.id; openModal('crew'); });

            const listContainer = col.querySelector('.col-list');
            members.forEach(member => {
                const card = document.createElement('div');
                card.className = 'crew-card group';
                card.setAttribute('data-id', member.id);
                card.innerHTML = `
                    <div class="card-top">
                        <div class="crew-avatar">${(member.name || "?").substring(0,2).toUpperCase()}</div>
                        <div class="flex-1">
                            <div class="text-[11px] font-bold text-[var(--text-main)] leading-tight">${member.name}</div>
                            <div class="text-[9px] text-[var(--text-muted)] font-bold uppercase">${member.role}</div>
                        </div>
                    </div>
                    <div class="card-meta">
                        <span><i class="fa-solid fa-sack-dollar text-blue-500 mr-1"></i>$${formatMoney(member.rate)}/day</span>
                        <span class="opacity-50">${member.phone ? '<i class="fa-solid fa-phone"></i>' : ''}</span>
                    </div>
                    <button class="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] del-member-btn"><i class="fa-solid fa-xmark"></i></button>
                `;
                card.querySelector('.del-member-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(confirm('Remove?')) { crewList = crewList.filter(c => c.id !== member.id); saveProject(); renderCrewBoard(); renderBudget(); }
                });
                listContainer.appendChild(card);
            });

            new Sortable(listContainer, {
                group: 'crew', animation: 150, ghostClass: 'opacity-50',
                onEnd: (evt) => {
                    const itemId = evt.item.getAttribute('data-id');
                    const newDeptId = evt.to.getAttribute('data-dept-id');
                    const member = crewList.find(c => c.id === itemId);
                    if (member && newDeptId) { member.deptId = newDeptId; delete member.department; saveProject(false); }
                }
            });
            board.appendChild(col);
        });
    }

    // --- 2. GEAR LIST ---
    function renderGearList() {
        const container = document.getElementById('gearListContainer');
        const emptyState = document.getElementById('gearEmptyState');
        if(!container) return;
        container.innerHTML = '';
        
        if(gearList.length === 0) { emptyState.classList.remove('hidden'); return; } else { emptyState.classList.add('hidden'); }

        const cats = ['Camera', 'Lenses', 'Lighting', 'Grip', 'Audio', 'Props'];
        const activeCats = [...new Set(gearList.map(g => g.category))];
        const allCats = [...new Set([...cats, ...activeCats])];

        allCats.forEach(cat => {
            const items = gearList.filter(g => g.category === cat);
            if(items.length === 0) return;

            const group = document.createElement('div');
            group.className = 'list-group';
            group.innerHTML = `<div class="list-header">${cat}</div>`;
            
            items.forEach(item => {
                const costDisplay = item.cost > 0 ? `$${formatMoney(item.cost)}/day` : 'No Rate';
                
                const row = document.createElement('div');
                row.className = 'list-row group';
                row.innerHTML = `
                    <div class="w-6 h-6 rounded bg-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] border border-white/5">${item.qty}</div>
                    <div class="flex-1">
                        <div class="font-bold text-[11px] text-[var(--text-main)]">${item.name}</div>
                        <div class="text-[9px] text-[var(--text-muted)] font-mono">${costDisplay}</div>
                    </div>
                    <div class="text-[9px] uppercase font-bold text-[var(--text-muted)] bg-[var(--bg-panel)] border border-[var(--border)] px-2 py-0.5 rounded mr-2">${item.status}</div>
                    <button class="text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] del-gear-btn"><i class="fa-solid fa-trash"></i></button>
                `;
                row.querySelector('.del-gear-btn').addEventListener('click', () => {
                    if(confirm('Delete?')) { gearList = gearList.filter(g => g.id !== item.id); saveProject(); renderGearList(); renderBudget(); }
                });
                group.appendChild(row);
            });
            container.appendChild(group);
        });
    }

    // --- 3. BUDGET (UPDATED CALCULATIONS) ---
    function renderBudget() {
        const container = document.getElementById('budgetListContainer');
        if(!container) return;
        container.innerHTML = '';
        
        // 1. Crew Calc
        let dailyCrewCost = 0;
        crewList.forEach(c => { dailyCrewCost += parseFloat(c.rate) || 0; });
        const totalCrewCost = dailyCrewCost * shootDays;

        // 2. Gear Calc
        let dailyGearCost = 0;
        gearList.forEach(g => {
            const rate = parseFloat(g.cost) || 0;
            const qty = parseInt(g.qty) || 1;
            dailyGearCost += (rate * qty);
        });
        const totalGearCost = dailyGearCost * shootDays;

        // Update UI Summary
        document.getElementById('valDailyBurn').innerText = '$' + formatMoney(dailyCrewCost + dailyGearCost);
        document.getElementById('valTotalCrew').innerText = '$' + formatMoney(totalCrewCost);
        document.getElementById('valTotalGear').innerText = '$' + formatMoney(totalGearCost);

        // 3. Manual Expenses
        let manualEst = 0, manualAct = 0;
        budgetList.forEach(b => { manualEst += parseFloat(b.estCost)||0; manualAct += parseFloat(b.actCost)||0; });

        // 4. Grand Totals
        const grandTotalEst = totalCrewCost + totalGearCost + manualEst;
        const grandTotalAct = totalCrewCost + totalGearCost + manualAct; 
        const remaining = grandTotalEst - grandTotalAct;

        if(document.getElementById('valTotalEst')) document.getElementById('valTotalEst').innerText = '$' + formatMoney(grandTotalEst);
        if(document.getElementById('valTotalActual')) document.getElementById('valTotalActual').innerText = '$' + formatMoney(grandTotalAct);
        
        const elRem = document.getElementById('valRemaining');
        if(elRem) {
            elRem.innerText = '$' + formatMoney(remaining);
            elRem.className = `text-lg font-mono font-bold ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`;
        }

        budgetList.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-row group';
            row.innerHTML = `
                <div class="flex-1 font-bold text-[11px] text-[var(--text-main)]">${item.desc}</div>
                <div class="text-[9px] uppercase font-bold text-[var(--text-muted)] bg-[var(--bg-panel)] px-2 py-0.5 rounded">${item.category}</div>
                <div class="grid grid-cols-2 w-28 text-right gap-2 text-[10px] font-mono">
                    <div class="text-[var(--text-muted)]">$${formatMoney(item.estCost)}</div>
                    <div class="text-[var(--text-main)] font-bold">$${formatMoney(item.actCost)}</div>
                </div>
                <button class="text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] ml-2 del-bud-btn"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.del-bud-btn').addEventListener('click', () => {
                if(confirm('Delete?')) { budgetList = budgetList.filter(b => b.id !== item.id); saveProject(); renderBudget(); }
            });
            container.appendChild(row);
        });
    }

    // --- 4. EXPORT REPORT ---
    window.downloadProductionReport = () => {
        const title = document.getElementById('projectTitleDisplay').innerText;
        const date = new Date().toLocaleDateString();

        // Data Prep
        let totalEst = 0;
        let totalAct = 0;
        
        // Manual Budget Rows
        const budgetRows = [[
            { text: 'Item', bold: true, fillColor: '#eeeeee' },
            { text: 'Category', bold: true, fillColor: '#eeeeee' },
            { text: 'Est. Cost', bold: true, alignment: 'right', fillColor: '#eeeeee' },
            { text: 'Actual', bold: true, alignment: 'right', fillColor: '#eeeeee' }
        ]];

        budgetList.forEach(b => {
            budgetRows.push([
                b.desc,
                b.category,
                { text: `$${formatMoney(b.estCost)}`, alignment: 'right' },
                { text: `$${formatMoney(b.actCost)}`, alignment: 'right' }
            ]);
            totalEst += parseFloat(b.estCost) || 0;
            totalAct += parseFloat(b.actCost) || 0;
        });

        // Add Auto-Calculated Rows (Crew/Gear)
        const crewTotal = parseFloat(document.getElementById('valTotalCrew').innerText.replace(/[^0-9.-]+/g,"")) || 0;
        const gearTotal = parseFloat(document.getElementById('valTotalGear').innerText.replace(/[^0-9.-]+/g,"")) || 0;
        
        budgetRows.push([ 'Crew Payroll', 'Labor', { text: `$${formatMoney(crewTotal)}`, alignment: 'right' }, { text: '-', alignment: 'right' } ]);
        budgetRows.push([ 'Equipment Rentals', 'Gear', { text: `$${formatMoney(gearTotal)}`, alignment: 'right' }, { text: '-', alignment: 'right' } ]);

        const grandTotal = totalEst + crewTotal + gearTotal;

        // Crew Rows
        const crewRows = [[
            { text: 'Name', bold: true, fillColor: '#eeeeee' },
            { text: 'Role', bold: true, fillColor: '#eeeeee' },
            { text: 'Email', bold: true, fillColor: '#eeeeee' },
            { text: 'Phone', bold: true, fillColor: '#eeeeee' }
        ]];
        crewList.forEach(c => crewRows.push([c.name, c.role, c.email || '-', c.phone || '-']));

        // Gear Rows
        const gearRows = [[
            { text: 'Qty', bold: true, fillColor: '#eeeeee' },
            { text: 'Item', bold: true, fillColor: '#eeeeee' },
            { text: 'Category', bold: true, fillColor: '#eeeeee' },
            { text: 'Status', bold: true, fillColor: '#eeeeee' }
        ]];
        gearList.forEach(g => gearRows.push([g.qty, g.name, g.category, g.status]));

        // PDF Structure
        const docDefinition = {
            content: [
                { text: 'PRODUCTION REPORT', fontSize: 22, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
                { text: `${title.toUpperCase()} • ${date}`, fontSize: 10, alignment: 'center', color: 'gray', margin: [0, 0, 0, 30] },

                // FINANCIAL SUMMARY
                { text: 'FINANCIAL SUMMARY', style: 'header' },
                {
                    table: {
                        widths: ['*', '*', '*'],
                        body: [[
                            { text: 'TOTAL BUDGET', bold: true, fontSize: 10, color: 'gray' },
                            { text: 'ACTUAL SPENT', bold: true, fontSize: 10, color: 'gray' },
                            { text: 'REMAINING', bold: true, fontSize: 10, color: 'gray' }
                        ], [
                            { text: `$${formatMoney(grandTotal)}`, fontSize: 16, bold: true },
                            { text: `$${formatMoney(totalAct)}`, fontSize: 16, bold: true },
                            { text: `$${formatMoney(grandTotal - totalAct)}`, fontSize: 16, bold: true, color: (grandTotal - totalAct) >= 0 ? 'green' : 'red' }
                        ]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 20]
                },

                // BUDGET TABLE
                { text: 'BUDGET BREAKDOWN', style: 'header' },
                { table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body: budgetRows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 20] },

                // CREW TABLE
                { text: 'CREW MANIFEST', style: 'header', pageBreak: 'before' },
                { table: { headerRows: 1, widths: ['*', 'auto', '*', 'auto'], body: crewRows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 20] },

                // GEAR TABLE
                { text: 'EQUIPMENT LIST', style: 'header' },
                { table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto'], body: gearRows }, layout: 'lightHorizontalLines' }
            ],
            styles: {
                header: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], color: '#333' }
            },
            defaultStyle: { font: 'Roboto' }
        };

        // Download
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/ /g,'_')}_Production_Report.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    };

    // --- SMART SYNC ---
    const btnSync = document.getElementById('btnSyncGear');
    if(btnSync) {
        btnSync.addEventListener('click', async () => {
            const originalContent = btnSync.innerHTML;
            btnSync.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Syncing...</span>`;
            btnSync.disabled = true;
            await new Promise(r => setTimeout(r, 600));
            scanShotsForGear();
            btnSync.innerHTML = `<i class="fa-solid fa-check"></i> <span>Done</span>`;
            setTimeout(() => { btnSync.innerHTML = originalContent; btnSync.disabled = false; }, 2000);
        });
    }

    function scanShotsForGear() {
        if (!projectData.setups || projectData.setups.length === 0) {
            showToast("No shots found in Studio", "error");
            return;
        }

        const keywords = [
            { word: 'Steadicam', item: 'Steadicam Rig', cat: 'Camera' },
            { word: 'Drone', item: 'Mavic 3 Cine', cat: 'Camera' },
            { word: 'Gimbal', item: 'Ronin RS3', cat: 'Camera' },
            { word: 'Dolly', item: 'Dolly Track & Wheels', cat: 'Grip' },
            { word: 'Jib', item: 'Technocrane', cat: 'Grip' },
            { word: 'Crane', item: 'Technocrane', cat: 'Grip' },
            { word: 'Handheld', item: 'EasyRig', cat: 'Grip' },
            { word: 'Shoulder', item: 'Shoulder Mount', cat: 'Grip' },
            { word: 'Tripod', item: 'Sachtler Flowtech', cat: 'Grip' },
            { word: 'Zoom', item: '24-70mm Zoom Lens', cat: 'Lenses' },
            { word: 'Macro', item: '100mm Macro Lens', cat: 'Lenses' },
            { word: 'Anamorphic', item: 'Atlas Orion Set', cat: 'Lenses' }
        ];

        let addedCount = 0;
        projectData.setups.forEach((setup) => {
            if(!setup.shots) return;
            setup.shots.forEach((shot) => {
                const type = shot.type || "";
                const angle = shot.angle || ""; 
                const desc = shot.desc || "";
                const shotText = (type + " " + angle + " " + desc).toLowerCase();
                keywords.forEach(kw => {
                    if (shotText.includes(kw.word.toLowerCase())) {
                        const exists = gearList.find(g => g.name === kw.item);
                        if (!exists) {
                            gearList.push({ id: Date.now() + Math.random().toString(), name: kw.item, qty: 1, category: kw.cat, status: 'Rented', cost: 0 });
                            addedCount++;
                        }
                    }
                });
            });
        });

        if (addedCount > 0) {
            saveProject(false);
            renderGearList();
            renderBudget(); 
            showToast(`Synced! Added ${addedCount} items.`, "success");
        } else {
            showToast("No new gear detected.", "info");
        }
    }

    // --- UTILS & MODAL ---
    const mainBtn = document.getElementById('btnMainAction');
    const mainBtnText = document.getElementById('actionBtnText');

    if (mainBtn) {
        mainBtn.addEventListener('click', () => {
            if (currentTab === 'crew') {
                const newId = 'd' + Date.now();
                departments.push({ id: newId, title: 'New Dept' });
                saveProject(); renderCrewBoard();
            } else { openModal(currentTab); }
        });
    }

    window.switchTab = function(tab) {
        currentTab = tab;
        ['viewCrew', 'viewGear', 'viewBudget'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        const target = document.getElementById('view' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if(target) target.classList.remove('hidden');
        document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
        const tabLink = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if(tabLink) tabLink.classList.add('active');
        
        if (tab === 'crew') mainBtnText.innerText = "New Dept";
        else if (tab === 'gear') mainBtnText.innerText = "Add Gear";
        else mainBtnText.innerText = "Add Expense";
    };

    function formatMoney(amount) {
        return (parseFloat(amount) || 0).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const colors = type === 'error' ? 'bg-red-600 border-red-500' : type === 'info' ? 'bg-gray-800 border-gray-600' : 'bg-green-600 border-green-500';
        const icon = type === 'error' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : type === 'info' ? '<i class="fa-solid fa-info-circle"></i>' : '<i class="fa-solid fa-check"></i>';
        toast.className = `${colors} text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3 text-xs font-bold min-w-[200px] toast-enter`;
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.remove('toast-enter'); toast.classList.add('toast-enter-active'); });
        setTimeout(() => { toast.classList.remove('toast-enter-active'); toast.classList.add('toast-exit-active'); setTimeout(() => toast.remove(), 300); }, 3000);
    }

    // Modal
    const modal = document.getElementById('universalModal');
    const modalFields = document.getElementById('modalFields');
    const modalTitle = document.getElementById('modalTitle');

    window.openModal = function(type) {
        modalFields.innerHTML = '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        gsap.to(modal.querySelector('.modal-panel'), { opacity: 1, scale: 1, duration: 0.2 });

        if (type === 'crew') {
            modalTitle.innerText = "Add Crew Member";
            modalFields.innerHTML = `
                <div><label class="themed-label">Name</label><input id="inpName" class="themed-input" placeholder="Full Name"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="themed-label">Role</label><input id="inpRole" class="themed-input" placeholder="Job Title"></div>
                    <div><label class="themed-label">Day Rate ($)</label><input id="inpRate" type="number" class="themed-input" placeholder="0"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="themed-label">Phone</label><input id="inpPhone" class="themed-input" placeholder="+1..."></div>
                    <div><label class="themed-label">Email</label><input id="inpEmail" class="themed-input" placeholder="@..."></div>
                </div>
            `;
        } else if (type === 'gear') {
            modalTitle.innerText = "Add Equipment";
            modalFields.innerHTML = `
                <div><label class="themed-label">Item Name</label><input id="inpName" class="themed-input" placeholder="Item Name"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="themed-label">Qty</label><input id="inpRole" type="number" class="themed-input" value="1"></div>
                    <div><label class="themed-label">Day Rate ($)</label><input id="inpCost" type="number" class="themed-input" placeholder="0"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="themed-label">Category</label><select id="inpCat" class="themed-input"><option>Camera</option><option>Lighting</option><option>Grip</option><option>Audio</option><option>Props</option></select></div>
                    <div><label class="themed-label">Status</label><select id="inpExtra" class="themed-input"><option>Owned</option><option>Rented</option></select></div>
                </div>
            `;
        } else {
            modalTitle.innerText = "Add Expense";
            modalFields.innerHTML = `
                <div><label class="themed-label">Description</label><input id="inpName" class="themed-input" placeholder="Expense Name"></div>
                <div><label class="themed-label">Category</label><select id="inpCat" class="themed-input"><option>Production</option><option>Talent</option><option>Equipment</option><option>Locations</option></select></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="themed-label">Est. Cost</label><input id="inpRole" type="number" class="themed-input" placeholder="0.00"></div>
                    <div><label class="themed-label">Actual</label><input id="inpExtra" type="number" class="themed-input" placeholder="0.00"></div>
                </div>
            `;
        }
    };

    const closeModalBtn = document.getElementById('closeModal');
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            gsap.to(modal.querySelector('.modal-panel'), { opacity: 0, scale: 0.95, duration: 0.2, onComplete: () => {
                modal.classList.add('hidden'); modal.classList.remove('flex');
            }});
        });
    }

    const saveItemBtn = document.getElementById('saveItemBtn');
    if(saveItemBtn) {
        saveItemBtn.addEventListener('click', () => {
            const val1 = document.getElementById('inpName').value;
            const val2 = document.getElementById('inpRole').value;
            
            if (!val1) return;
            const id = Date.now().toString();

            if (document.getElementById('modalTitle').innerText.includes("Crew")) {
                const rate = document.getElementById('inpRate').value;
                const phone = document.getElementById('inpPhone').value;
                const email = document.getElementById('inpEmail').value;
                crewList.push({ id, name: val1, role: val2, deptId: activeDeptId, rate: rate, phone: phone, email: email });
                renderCrewBoard();
                renderBudget(); 
            } else if (currentTab === 'gear') {
                const cost = document.getElementById('inpCost').value;
                const cat = document.getElementById('inpCat').value;
                const status = document.getElementById('inpExtra').value;
                gearList.push({ id, name: val1, qty: val2, cost: cost, category: cat, status: status });
                renderGearList();
                renderBudget(); // Recalc budget
            } else {
                const val3 = document.getElementById('inpCat').value;
                const val4 = document.getElementById('inpExtra').value;
                budgetList.push({ id, desc: val1, estCost: val2, category: val3, actCost: val4 });
                renderBudget();
            }

            saveProject(); 
            document.getElementById('closeModal').click();
        });
    }
});