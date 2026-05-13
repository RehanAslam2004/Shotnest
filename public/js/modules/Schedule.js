export class ScheduleModule {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('scheduledDaysContainer');
        this.unscheduledList = document.getElementById('unscheduledList');
        this.init();
    }

    init() {
        const addDayBtn = document.getElementById('addDayBtn');
        if (addDayBtn) {
            addDayBtn.addEventListener('click', () => {
                const dayCount = this.container.querySelectorAll('.day-strip').length + 1;
                this.addDayStrip(`Day ${dayCount}`);
                this.emitUpdate();
            });
        }
    }

    addDayStrip(titleVal = "New Day", shotIds = [], emit = true) {
        const div = document.createElement('div');
        div.className = "day-strip bg-black/20 border border-white/10 p-4 rounded-xl relative group mb-4";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <input type="text" value="${titleVal}" class="day-title-input bg-transparent text-xs font-bold uppercase tracking-widest opacity-60 outline-none focus:opacity-100 focus:text-blue-500 transition w-full text-current" />
                <button class="text-red-500 opacity-0 group-hover:opacity-100 transition delete-day"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="min-h-[50px] border-2 border-dashed border-white/5 rounded-lg sortable-day transition hover:border-white/10 p-2 gap-2 flex flex-wrap"></div>
        `;
        this.container.appendChild(div);

        const sortContainer = div.querySelector('.sortable-day');
        new Sortable(sortContainer, {
            group: 'schedule',
            animation: 150,
            onEnd: () => this.emitUpdate()
        });

        if (shotIds.length > 0) {
            shotIds.forEach(id => {
                const originalCard = document.querySelector(`.shot-card-item[data-id="${id}"]`);
                const type = originalCard ? originalCard.querySelector('.shot-type').value : 'Shot';
                sortContainer.appendChild(this.createStripItem(id, type));
            });
        }

        div.querySelector('.delete-day').addEventListener('click', () => {
            if (confirm('Remove this day?')) {
                div.querySelectorAll('.strip-item').forEach(item => this.unscheduledList.appendChild(item));
                div.remove();
                this.emitUpdate();
            }
        });

        if (emit) this.emitUpdate();
    }

    createStripItem(id, type) {
        const div = document.createElement('div');
        div.className = "themed-card px-3 py-2 rounded-lg flex items-center gap-3 border-l-4 border-l-blue-500 cursor-grab shadow-sm strip-item text-xs font-bold bg-[#252529] text-white";
        div.setAttribute('data-id', id);
        div.innerHTML = `<span>#${id}</span><span class="opacity-50">${type}</span>`;
        return div;
    }

    sync() {
        this.unscheduledList.innerHTML = '';
        document.querySelectorAll('.shot-card-item').forEach(card => {
            const id = card.getAttribute('data-id');
            let isScheduled = false;
            this.container.querySelectorAll('.strip-item').forEach(item => {
                if (item.getAttribute('data-id') === id) isScheduled = true;
            });
            if (!isScheduled) {
                const type = card.querySelector('.shot-type').value;
                this.unscheduledList.appendChild(this.createStripItem(id, type));
            }
        });
        new Sortable(this.unscheduledList, {
            group: 'schedule',
            animation: 150,
            onEnd: () => this.emitUpdate()
        });
    }

    emitUpdate() {
        const scheduleState = [];
        this.container.querySelectorAll('.day-strip').forEach(day => {
            const title = day.querySelector('.day-title-input').value;
            const shots = [];
            day.querySelectorAll('.strip-item').forEach(item => shots.push(item.getAttribute('data-id')));
            scheduleState.push({ title, shots });
        });
        this.app.socket.emit('schedule-update', { projectId: this.app.projectId, schedule: scheduleState });
    }
}
