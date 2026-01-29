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
    let currentTab = 'crew';
    let activeDeptId = null;

    // --- INIT ---
    socket.on('connect', () => {
        socket.emit('join-project', { projectId, userEmail: "Producer" });
        loadProject();
    });

    document.getElementById('navStudio').addEventListener('click', () => {
        window.location.href = `/studio.html?id=${projectId}`;
    });

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
                
                if (projectData.production_departments && projectData.production_departments.length > 0) {
                    departments = projectData.production_departments;
                } else {
                    departments = [{id: 'd1', title: 'Production'}, {id: 'd2', title: 'Camera'}, {id: 'd3', title: 'Sound'}];
                }
                
                renderCrewBoard();
                renderGearList();
                renderBudget();
            }
        } catch(e) { console.error("Error loading", e); }
    }

    async function saveProject() {
        projectData.production_crew = crewList;
        projectData.production_gear = gearList;
        projectData.production_budget = budgetList;
        projectData.production_departments = departments;
        try { await fetch('/api/save-project', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(projectData) }); } catch(e) {}
    }

    // --- 1. SMOOTH CREW BOARD ---
    function renderCrewBoard() {
        const board = document.getElementById('crewBoard');
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
                <button class="w-full py-2 text-[9px] font-bold text-gray-600 hover:text-blue-500 hover:bg-white/5 transition border-t border-[#27272a] add-crew-btn rounded-b-lg flex items-center justify-center gap-1">
                    <i class="fa-solid fa-plus"></i> Add
                </button>
            `;

            const titleInput = col.querySelector('.col-title-input');
            titleInput.addEventListener('change', (e) => { dept.title = e.target.value; saveProject(); });

            col.querySelector('.delete-dept-btn').addEventListener('click', () => {
                if(confirm('Delete department?')) {
                    departments = departments.filter(d => d.id !== dept.id);
                    crewList = crewList.filter(c => c.deptId !== dept.id && c.department !== dept.title);
                    saveProject(); renderCrewBoard();
                }
            });

            col.querySelector('.add-crew-btn').addEventListener('click', () => {
                activeDeptId = dept.id;
                openModal('crew');
            });

            const listContainer = col.querySelector('.col-list');
            
            members.forEach(member => {
                const card = document.createElement('div');
                card.className = 'crew-card group';
                // 🟢 KEY FIX: Store ID directly on element for robust drag n drop
                card.setAttribute('data-id', member.id);
                card.innerHTML = `
                    <div class="card-top">
                        <div class="crew-avatar">${member.name.substring(0,2).toUpperCase()}</div>
                        <div class="flex-1">
                            <div class="text-[11px] font-bold text-gray-200 leading-tight">${member.name}</div>
                            <div class="text-[9px] text-gray-500 font-bold uppercase">${member.role}</div>
                        </div>
                    </div>
                    <div class="card-meta">
                        <span><i class="fa-solid fa-sack-dollar text-blue-500 mr-1"></i>$${member.rate || '0'}</span>
                        <span class="opacity-50">${member.phone ? '<i class="fa-solid fa-phone"></i>' : ''}</span>
                    </div>
                    <button class="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] del-member-btn"><i class="fa-solid fa-xmark"></i></button>
                `;
                
                card.querySelector('.del-member-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(confirm('Remove?')) { crewList = crewList.filter(c => c.id !== member.id); saveProject(); renderCrewBoard(); }
                });
                listContainer.appendChild(card);
            });

            // 🟢 OPTIMIZED SORTABLE
            new Sortable(listContainer, {
                group: 'crew', 
                animation: 150, 
                ghostClass: 'opacity-50',
                onEnd: (evt) => {
                    // Update data silently without re-rendering to prevent glitch
                    const itemId = evt.item.getAttribute('data-id');
                    const newDeptId = evt.to.getAttribute('data-dept-id');
                    const member = crewList.find(c => c.id === itemId);
                    
                    if (member && newDeptId) {
                        member.deptId = newDeptId;
                        delete member.department; // cleanup legacy
                        saveProject();
                        // Do NOT call renderCrewBoard() here to keep it smooth
                    }
                }
            });
            board.appendChild(col);
        });
    }

    // --- 2. GEAR LIST ---
    function renderGearList() {
        const container = document.getElementById('gearListContainer');
        const emptyState = document.getElementById('gearEmptyState');
        container.innerHTML = '';
        
        if(gearList.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

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
                const row = document.createElement('div');
                row.className = 'list-row group';
                row.innerHTML = `
                    <div class="w-6 h-6 rounded bg-[#27272a] flex items-center justify-center text-[10px] font-bold text-gray-400 border border-white/5">${item.qty}</div>
                    <div class="flex-1 font-bold text-[11px] text-gray-300">${item.name}</div>
                    <div class="text-[9px] uppercase font-bold text-gray-600 bg-white/5 px-2 py-0.5 rounded mr-2">${item.status}</div>
                    <button class="text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] del-gear-btn"><i class="fa-solid fa-trash"></i></button>
                `;
                row.querySelector('.del-gear-btn').addEventListener('click', () => {
                    if(confirm('Delete?')) { gearList = gearList.filter(g => g.id !== item.id); saveProject(); renderGearList(); }
                });
                group.appendChild(row);
            });
            container.appendChild(group);
        });
    }

    // --- 3. BUDGET ---
    function renderBudget() {
        const container = document.getElementById('budgetListContainer');
        container.innerHTML = '';
        
        let totalEst = 0, totalAct = 0;
        budgetList.forEach(b => { totalEst += parseFloat(b.estCost)||0; totalAct += parseFloat(b.actCost)||0; });
        document.getElementById('valTotalEst').innerText = '$'+totalEst.toFixed(2);
        document.getElementById('valTotalActual').innerText = '$'+totalAct.toFixed(2);
        const rem = totalEst - totalAct;
        document.getElementById('valRemaining').innerText = '$'+rem.toFixed(2);

        budgetList.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-row group';
            row.innerHTML = `
                <div class="flex-1 font-bold text-[11px] text-gray-300">${item.desc}</div>
                <div class="text-[9px] uppercase font-bold text-gray-600 bg-white/5 px-2 py-0.5 rounded">${item.category}</div>
                <div class="grid grid-cols-2 w-28 text-right gap-2 text-[10px] font-mono">
                    <div class="text-gray-500">$${item.estCost}</div>
                    <div class="text-white font-bold">$${item.actCost}</div>
                </div>
                <button class="text-red-500 opacity-0 group-hover:opacity-100 transition text-[10px] ml-2 del-bud-btn"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.del-bud-btn').addEventListener('click', () => {
                if(confirm('Delete?')) { budgetList = budgetList.filter(b => b.id !== item.id); saveProject(); renderBudget(); }
            });
            container.appendChild(row);
        });
    }

    // --- UTILS ---
    const mainBtn = document.getElementById('btnMainAction');
    const mainBtnText = document.getElementById('actionBtnText');

    mainBtn.addEventListener('click', () => {
        if (currentTab === 'crew') {
            const newId = 'd' + Date.now();
            departments.push({ id: newId, title: 'New Dept' });
            saveProject(); renderCrewBoard();
        } else { openModal(currentTab); }
    });

    window.switchTab = function(tab) {
        currentTab = tab;
        ['viewCrew', 'viewGear', 'viewBudget'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById('view' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
        document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
        document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
        if (tab === 'crew') mainBtnText.innerText = "New Dept";
        else if (tab === 'gear') mainBtnText.innerText = "Add Gear";
        else mainBtnText.innerText = "Add Expense";
    };

    // --- MODAL (UPDATED WITH MORE FIELDS) ---
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
                <div><label class="dark-label">Name</label><input id="inpName" class="dark-input" placeholder="Full Name"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="dark-label">Role</label><input id="inpRole" class="dark-input" placeholder="Job Title"></div>
                    <div><label class="dark-label">Day Rate ($)</label><input id="inpRate" type="number" class="dark-input" placeholder="0"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="dark-label">Phone</label><input id="inpPhone" class="dark-input" placeholder="+1..."></div>
                    <div><label class="dark-label">Email</label><input id="inpEmail" class="dark-input" placeholder="@..."></div>
                </div>
            `;
        } else if (type === 'gear') {
            modalTitle.innerText = "Add Equipment";
            modalFields.innerHTML = `
                <div><label class="dark-label">Item Name</label><input id="inpName" class="dark-input" placeholder="Item Name"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="dark-label">Qty</label><input id="inpRole" type="number" class="dark-input" value="1"></div>
                    <div><label class="dark-label">Category</label><select id="inpCat" class="dark-input"><option>Camera</option><option>Lighting</option><option>Grip</option><option>Audio</option><option>Props</option></select></div>
                </div>
                <div><label class="dark-label">Status</label><select id="inpExtra" class="dark-input"><option>Owned</option><option>Rented</option></select></div>
            `;
        } else {
            modalTitle.innerText = "Add Expense";
            modalFields.innerHTML = `
                <div><label class="dark-label">Description</label><input id="inpName" class="dark-input" placeholder="Expense Name"></div>
                <div><label class="dark-label">Category</label><select id="inpCat" class="dark-input"><option>Production</option><option>Talent</option><option>Equipment</option><option>Locations</option></select></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="dark-label">Est. Cost</label><input id="inpRole" type="number" class="dark-input" placeholder="0.00"></div>
                    <div><label class="dark-label">Actual</label><input id="inpExtra" type="number" class="dark-input" placeholder="0.00"></div>
                </div>
            `;
        }
    };

    document.getElementById('closeModal').addEventListener('click', () => {
        gsap.to(modal.querySelector('.modal-panel'), { opacity: 0, scale: 0.95, duration: 0.2, onComplete: () => {
            modal.classList.add('hidden'); modal.classList.remove('flex');
        }});
    });

    document.getElementById('saveItemBtn').addEventListener('click', () => {
        const val1 = document.getElementById('inpName').value;
        const val2 = document.getElementById('inpRole').value;
        if (!val1) return;
        const id = Date.now().toString();

        if (document.getElementById('modalTitle').innerText.includes("Crew")) {
            // New Crew Fields
            const rate = document.getElementById('inpRate').value;
            const phone = document.getElementById('inpPhone').value;
            const email = document.getElementById('inpEmail').value;
            
            crewList.push({ id, name: val1, role: val2, deptId: activeDeptId, rate, phone, email });
            renderCrewBoard();
        } else if (currentTab === 'gear') {
            const val3 = document.getElementById('inpCat').value;
            const val4 = document.getElementById('inpExtra').value;
            gearList.push({ id, name: val1, qty: val2, category: val3, status: val4 });
            renderGearList();
        } else {
            const val3 = document.getElementById('inpCat').value;
            const val4 = document.getElementById('inpExtra').value;
            budgetList.push({ id, desc: val1, estCost: val2, category: val3, actCost: val4 });
            renderBudget();
        }
        saveProject(); document.getElementById('closeModal').click();
    });
});