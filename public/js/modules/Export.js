export class ExportModule {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        const triggerExportBtn = document.getElementById('triggerExport');
        if (triggerExportBtn) {
            triggerExportBtn.addEventListener('click', () => {
                const projectTitleInput = document.getElementById('projectTitle');
                if (projectTitleInput) {
                    document.getElementById('metaTitle').value = projectTitleInput.value;
                }
                this.app.openModal('exportModal');
            });
        }

        const generatePdfBtn = document.getElementById('btnGeneratePdf');
        if (generatePdfBtn) {
            generatePdfBtn.addEventListener('click', () => this.generatePdf());
        }

        // Bug 7 fix: Bind the Cancel button in the export modal
        const closeModalBtn = document.getElementById('closeModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.app.closeModal('exportModal'));
        }
    }

    async getBase64ImageFromUrl(imageUrl) {
        if (!imageUrl) return null;
        if (imageUrl.startsWith('data:')) return imageUrl;
        
        try {
            // Attempt to fetch with CORS
            const res = await fetch(imageUrl, { mode: 'cors' });
            if (!res.ok) throw new Error('CORS fetch failed');
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("CORS fetch failed, trying proxy or skipping:", imageUrl);
            // In a real app, we might use a proxy, but here we just skip to avoid crashing the export
            return null;
        }
    }

    async generatePdf() {
        const btn = document.getElementById('btnGeneratePdf');
        const oldText = btn.innerText;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> GENERATING...';
        btn.disabled = true;

        try {
            // Check for pdfMake
            if (typeof pdfMake === 'undefined') {
                throw new Error("PDF Library not loaded.");
            }

            // Ensure VFS is initialized
            if (!pdfMake.vfs && window.pdfMake && window.pdfMake.vfs) {
                pdfMake.vfs = window.pdfMake.vfs;
            }

            const title = document.getElementById('metaTitle').value || "Untitled Project";
            const director = document.getElementById('metaDirector').value || "Director Name";
            const dop = document.getElementById('metaDop').value || "Cinematographer";
            const date = document.getElementById('metaDate').value || new Date().toLocaleDateString();
            const version = document.getElementById('metaVer').value || "Production Draft";

            const docDefinition = {
                header: (currentPage) => {
                    if (currentPage === 1) return null;
                    return {
                        text: title.toUpperCase(),
                        alignment: 'right',
                        fontSize: 9,
                        margin: [40, 20, 40, 0],
                        opacity: 0.3
                    };
                },
                footer: (currentPage, pageCount) => {
                    return {
                        text: `SHOTNEST | Page ${currentPage} of ${pageCount}`,
                        alignment: 'center',
                        fontSize: 8,
                        margin: [0, 20],
                        opacity: 0.5
                    };
                },
                content: [],
                styles: {
                    titleMain: { fontSize: 32, bold: true, alignment: 'center', margin: [0, 150, 0, 10] },
                    titleSub: { fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] },
                    sectionHeader: { fontSize: 20, bold: true, margin: [0, 30, 0, 15], color: '#3b82f6', border: [false, false, false, true] },
                    setupHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5], color: '#1d4ed8' },
                    tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#3b82f6', alignment: 'center', margin: [0, 5] },
                    // Screenplay Styles
                    scene: { fontSize: 12, bold: true, margin: [0, 15, 0, 5] },
                    action: { fontSize: 12, margin: [0, 0, 0, 10] },
                    character: { fontSize: 12, alignment: 'center', margin: [0, 15, 0, 0], width: '50%' },
                    parenthetical: { fontSize: 11, alignment: 'center', margin: [120, 0, 120, 0], italic: true },
                    dialogue: { fontSize: 12, margin: [100, 0, 100, 10] },
                    transition: { fontSize: 12, alignment: 'right', margin: [0, 15, 0, 15] }
                },
                defaultStyle: { font: 'Roboto' }
            };

            // 1. Title Page
            docDefinition.content.push({ text: title.toUpperCase(), style: 'titleMain' });
            docDefinition.content.push({ text: 'Written and Directed by', style: 'titleSub', margin: [0, 50, 0, 10] });
            docDefinition.content.push({ text: director, style: 'titleSub', fontSize: 18, bold: true });
            if (dop) {
                docDefinition.content.push({ text: 'Director of Photography', style: 'titleSub', margin: [0, 30, 0, 10] });
                docDefinition.content.push({ text: dop, style: 'titleSub', fontSize: 16 });
            }
            docDefinition.content.push({ text: `${version} | ${date}`, style: 'titleSub', margin: [0, 100, 0, 0], pageBreak: 'after' });

            // 2. Script Section
            if (document.getElementById('chkScript').checked) {
                docDefinition.content.push({ text: 'SCREENPLAY', style: 'sectionHeader' });
                const scriptDiv = document.getElementById('scriptContent');
                if (scriptDiv) {
                    Array.from(scriptDiv.children).forEach(node => {
                        let style = 'action';
                        let text = node.innerText || '';
                        if (!text.trim() && node.innerHTML !== '<br>') return;

                        if (node.classList.contains('script-scene')) style = 'scene';
                        else if (node.classList.contains('script-char')) style = 'character';
                        else if (node.classList.contains('script-dial')) style = 'dialogue';
                        else if (node.classList.contains('script-paren')) style = 'parenthetical';
                        else if (node.classList.contains('script-trans')) style = 'transition';

                        if (style === 'character') text = text.toUpperCase();
                        docDefinition.content.push({ text: text, style: style });
                    });
                }
                docDefinition.content.push({ text: '', pageBreak: 'after' });
            }

            // 3. Shot List Section
            if (document.getElementById('chkShots').checked) {
                docDefinition.content.push({ text: 'SHOT LIST', style: 'sectionHeader' });
                
                // We use globalProjectData or live DOM?
                // Live DOM is safer for latest changes
                const setupGroups = document.querySelectorAll('.setup-group');
                for (const group of setupGroups) {
                    const setupTitle = group.querySelector('.setup-title-input').value;
                    docDefinition.content.push({ text: setupTitle.toUpperCase(), style: 'setupHeader' });
                    
                    const tableBody = [[
                        { text: 'NO.', style: 'tableHeader' },
                        { text: 'VISUAL', style: 'tableHeader' },
                        { text: 'SIZE/ANGLE', style: 'tableHeader' },
                        { text: 'DESCRIPTION', style: 'tableHeader' },
                        { text: 'TECH SPECS', style: 'tableHeader' }
                    ]];

                    const shotCards = group.querySelectorAll('.shot-card-item');
                    for (const card of shotCards) {
                        const dataIdAttr = card.getAttribute('data-id') || 'SHOT';
                        const id = dataIdAttr.substring(0, 4);
                        
                        const typeEl = card.querySelector('.shot-type');
                        const angleEl = card.querySelector('.shot-angle');
                        const descEl = card.querySelector('.shot-desc');
                        const lensEl = card.querySelector('.shot-lens');
                        const fpsEl = card.querySelector('.shot-fps');
                        const imgEl = card.querySelector('.shot-img-storage');

                        const type = typeEl ? typeEl.value : '';
                        const angle = angleEl ? angleEl.value : '';
                        const desc = descEl ? descEl.innerText : '';
                        const lens = lensEl ? lensEl.value : '';
                        const fps = fpsEl ? fpsEl.value : '';
                        const imgSource = imgEl ? imgEl.src : '';
                        
                        let imgCell = { text: 'NO IMAGE', fontSize: 7, alignment: 'center', margin: [0, 15] };
                        if (imgSource && imgSource.startsWith('http') && !imgSource.includes(window.location.host)) {
                            const base64 = await this.getBase64ImageFromUrl(imgSource);
                            if (base64) {
                                imgCell = { image: base64, width: 80, height: 45, fit: [80, 45], alignment: 'center' };
                            }
                        } else if (imgSource && imgSource.startsWith('data:')) {
                            imgCell = { image: imgSource, width: 80, height: 45, fit: [80, 45], alignment: 'center' };
                        }

                        tableBody.push([
                            { text: id, alignment: 'center', margin: [0, 10] },
                            imgCell,
                            { text: `${type}\n${angle}`, alignment: 'center', margin: [0, 10] },
                            { text: desc, margin: [5, 5] },
                            { text: `${lens}\n${fps} FPS`, alignment: 'center', margin: [0, 10] }
                        ]);
                    }

                    docDefinition.content.push({
                        table: {
                            headerRows: 1,
                            widths: [30, 90, 80, '*', 70],
                            body: tableBody
                        },
                        layout: {
                            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                            vLineWidth: () => 0.5,
                            hLineColor: () => '#e2e8f0',
                            vLineColor: () => '#e2e8f0',
                            paddingLeft: () => 5,
                            paddingRight: () => 5,
                        },
                        margin: [0, 0, 0, 20]
                    });
                }
            }

            // 4. Schedule Section (Stripboard)
            if (document.getElementById('chkSchedule').checked) {
                docDefinition.content.push({ text: 'STRIPBOARD / SCHEDULE', style: 'sectionHeader' });
                
                const dayStrips = document.querySelectorAll('.day-strip');
                if (dayStrips.length === 0) {
                    docDefinition.content.push({ text: 'No scheduled days.', fontSize: 10, italic: true });
                }

                for (const day of dayStrips) {
                    const dayTitle = day.querySelector('.day-title-input').value;
                    docDefinition.content.push({ text: dayTitle.toUpperCase(), style: 'setupHeader', color: '#16a34a' });

                    const items = day.querySelectorAll('.strip-item');
                    if (items.length === 0) {
                        docDefinition.content.push({ text: 'Empty day.', fontSize: 9, margin: [10, 0] });
                        continue;
                    }

                    const stripTable = [[
                        { text: 'SHOT', style: 'tableHeader', fillColor: '#22c55e' },
                        { text: 'DESCRIPTION', style: 'tableHeader', fillColor: '#22c55e' },
                        { text: 'SPECS', style: 'tableHeader', fillColor: '#22c55e' }
                    ]];

                    for (const item of items) {
                        const shotId = item.getAttribute('data-id');
                        // Find shot data from live DOM or state
                        const shotCard = document.getElementById(shotId) || document.querySelector(`.shot-card-item[data-id="${shotId}"]`);
                        
                        let shotNo = shotId ? shotId.substring(0, 4) : 'SHOT';
                        let shotDesc = 'Unknown Shot';
                        let shotSpecs = '';

                        if (shotCard) {
                            const descEl = shotCard.querySelector('.shot-desc');
                            const typeEl = shotCard.querySelector('.shot-type');
                            const angleEl = shotCard.querySelector('.shot-angle');
                            const lensEl = shotCard.querySelector('.shot-lens');
                            
                            shotDesc = descEl ? descEl.innerText : 'No description';
                            shotSpecs = `${typeEl?.value || ''} ${angleEl?.value || ''}\n${lensEl?.value || ''}`;
                        }

                        stripTable.push([
                            { text: shotNo, alignment: 'center', margin: [0, 5] },
                            { text: shotDesc, margin: [0, 5] },
                            { text: shotSpecs, alignment: 'center', fontSize: 8, margin: [0, 5] }
                        ]);
                    }

                    docDefinition.content.push({
                        table: {
                            widths: [50, '*', 100],
                            body: stripTable
                        },
                        layout: 'lightHorizontalLines',
                        margin: [0, 0, 0, 15]
                    });
                }
                docDefinition.content.push({ text: '', pageBreak: 'after' });
            }

            // 5. Crew & Budget (Placeholder)
            if (document.getElementById('chkProd').checked) {
                docDefinition.content.push({ text: 'CREW & PRODUCTION', style: 'sectionHeader' });
                docDefinition.content.push({ text: 'Production data module is in read-only mode for this export version.', fontSize: 10, italic: true });
            }

            pdfMake.createPdf(docDefinition).download(`${title.replace(/\s+/g, '_')}_Shotnest.pdf`);
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> DOWNLOADED';
            setTimeout(() => {
                btn.innerText = oldText;
                btn.disabled = false;
            }, 3000);

        } catch (err) {
            console.error("PDF Export failed:", err);
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> FAILED';
            setTimeout(() => {
                btn.innerText = oldText;
                btn.disabled = false;
            }, 3000);
        }
    }
}
