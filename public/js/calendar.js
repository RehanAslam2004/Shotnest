document.addEventListener('DOMContentLoaded', () => {
    
    let currentDate = new Date();
    // Sample Data (No backlog items since sidebar is gone)
    let events = [
        { id: '1', title: 'Teaser Trailer', date: '2026-02-10', platform: 'yt', status: 'ready' },
        { id: '2', title: 'Cast Reveal Photos', date: '2026-02-14', platform: 'ig', status: 'filming' },
        { id: '3', title: 'Meme Promo', date: '2026-02-16', platform: 'tk', status: 'idea' }, 
        { id: '4', title: 'Director Interview', date: '2026-02-18', platform: 'yt', status: 'scripting' }
    ];

    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');

    function render() {
        renderCalendar();
    }

    function renderCalendar() {
        grid.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        monthDisplay.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty slots
        for(let i=0; i<firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell opacity-50 bg-black/20';
            grid.appendChild(cell);
        }

        // Days
        for(let d=1; d<=daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            cell.setAttribute('data-date', dateStr);
            
            const todayStr = new Date().toISOString().split('T')[0];
            if(dateStr === todayStr) cell.classList.add('today');

            cell.innerHTML = `<div class="day-num">${d}</div><div class="flex-1 flex flex-col gap-2 day-drop-zone h-full"></div>`;
            
            const dayEvents = events.filter(e => e.date === dateStr);
            const dropZone = cell.querySelector('.day-drop-zone');
            
            dayEvents.forEach(e => dropZone.appendChild(createEventCard(e)));
            grid.appendChild(cell);

            // Drag & Drop (Internal move)
            new Sortable(dropZone, {
                group: 'calendar', animation: 150,
                onAdd: function (evt) { updateEventDate(evt.item.getAttribute('data-id'), dateStr); }
            });
        }
    }

    function createEventCard(e) {
        const div = document.createElement('div');
        div.className = `event-card plat-${e.platform}`;
        div.setAttribute('data-id', e.id);
        
        let icon = 'fa-youtube';
        if(e.platform === 'ig') icon = 'fa-instagram';
        if(e.platform === 'tk') icon = 'fa-tiktok';
        if(e.platform === 'tw') icon = 'fa-twitter';

        div.innerHTML = `<i class="fa-brands ${icon} card-icon"></i><div class="card-title">${e.title}</div><span class="status-badge">${e.status}</span>`;
        div.onclick = () => editEvent(e.id);
        return div;
    }

    function updateEventDate(id, newDate) {
        const ev = events.find(e => e.id === id);
        if(ev) ev.date = newDate;
    }

    document.getElementById('prevMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); render(); });
    document.getElementById('nextMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); render(); });

    window.openEventModal = () => { document.getElementById('eventModal').style.display = 'flex'; };
    window.closeModal = () => { document.getElementById('eventModal').style.display = 'none'; };
    
    window.editEvent = (id) => {
        const e = events.find(ev => ev.id === id);
        if(e) {
            document.getElementById('inpTitle').value = e.title;
            document.getElementById('inpPlatform').value = e.platform;
            document.getElementById('inpStatus').value = e.status;
            document.getElementById('inpDate').value = e.date || '';
            document.getElementById('saveBtn').onclick = () => {
                e.title = document.getElementById('inpTitle').value;
                e.platform = document.getElementById('inpPlatform').value;
                e.status = document.getElementById('inpStatus').value;
                e.date = document.getElementById('inpDate').value || null;
                closeModal();
                render();
            };
            openEventModal();
        }
    };

    // --- VISUAL PDF EXPORT ---
    window.downloadVisualPDF = async () => {
        const btn = document.getElementById('exportBtn');
        const oldText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
        btn.disabled = true;

        try {
            // 1. Capture the Calendar Grid as an Image
            const canvas = await html2canvas(document.querySelector('.calendar-container'), {
                scale: 2, // High resolution
                backgroundColor: '#09090b', // Force dark background matches theme
                useCORS: true
            });
            const imgData = canvas.toDataURL('image/png');

            // 2. Generate PDF with the Image
            const docDefinition = {
                content: [
                    { text: 'CONTENT CALENDAR', fontSize: 20, bold: true, color: '#333333', margin: [0, 0, 0, 20], alignment: 'center' },
                    { text: document.getElementById('monthDisplay').innerText, fontSize: 14, color: '#666666', margin: [0, 0, 0, 20], alignment: 'center' },
                    {
                        image: imgData,
                        width: 750, // Fit landscape
                        alignment: 'center'
                    }
                ],
                pageSize: 'A4',
                pageOrientation: 'landscape', // Better for calendars
                pageMargins: [20, 20, 20, 20]
            };

            // 3. Download
            pdfMake.createPdf(docDefinition).download(`Calendar_${new Date().toISOString().split('T')[0]}.pdf`);
            
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Done!`;
            setTimeout(() => { 
                btn.innerHTML = oldText; 
                btn.disabled = false;
            }, 2000);

        } catch (err) {
            console.error(err);
            alert("Export Failed.");
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    };

    render();
});