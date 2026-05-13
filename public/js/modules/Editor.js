export class EditorModule {
    constructor(app) {
        this.app = app;
        this.saveTimeout = null;
        this.init();
    }

    init() {
        const scriptContent = document.getElementById('scriptContent');
        if (!scriptContent) return;

        // Formatting buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                this.formatBlock(type);
            });
        });

        // Key handling
        scriptContent.addEventListener('keydown', (e) => this.handleKeyDown(e));
        scriptContent.addEventListener('input', (e) => this.handleInput(e));

        // Import script
        const importBtn = document.getElementById('importScriptBtn');
        const fileInput = document.getElementById('scriptFileInput');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        // Split text by lines and wrap in divs
                        const lines = ev.target.result.split('\n');
                        scriptContent.innerHTML = lines.map(line => 
                            `<div class="script-action">${line || '<br>'}</div>`
                        ).join('');
                        this.app.saveProject();
                    };
                    reader.readAsText(file);
                }
            });
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter') {
            this.handleEnter(e);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.handleTab(e);
        }
    }

    handleInput(e) {
        // Debounced auto-save
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.app.saveProject();
        }, 1500);

        // Broadcast change via socket (Phase 3 Sync)
        this.app.socketHandler.emit('script-change', {
            projectId: this.app.projectId,
            scriptHtml: e.target.innerHTML
        });
    }

    handleEnter(e) {
        // Wait for browser to create the new line, then style it
        setTimeout(() => {
            const scriptContent = document.getElementById('scriptContent');
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            let node = selection.anchorNode;
            if (node.nodeType === 3) node = node.parentNode;
            
            // If the editor is empty or just has a BR, wrap it
            if (scriptContent.innerHTML === '' || scriptContent.innerHTML === '<br>') {
                scriptContent.innerHTML = '<div class="script-action"><br></div>';
                const range = document.createRange();
                range.selectNodeContents(scriptContent.firstChild);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }

            while (node && node.parentNode !== scriptContent && node !== scriptContent) {
                node = node.parentNode;
            }

            if (node && node.parentNode === scriptContent) {
                const prevNode = node.previousElementSibling;
                if (prevNode) {
                    // SMART LINE SWITCHING LOGIC
                    if (prevNode.classList.contains('script-char')) {
                        node.className = 'script-dial';
                    } else if (prevNode.classList.contains('script-scene')) {
                        node.className = 'script-action';
                    } else if (prevNode.classList.contains('script-dial')) {
                        node.className = 'script-action';
                    } else if (node.className === '') {
                        node.className = 'script-action';
                    }
                } else if (node.className === '') {
                    node.className = 'script-action';
                }
            }
        }, 0);
    }

    handleTab(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        let node = selection.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;
        
        const scriptContent = document.getElementById('scriptContent');
        while (node && node.parentNode !== scriptContent && node !== scriptContent) {
            node = node.parentNode;
        }

        if (node && node.parentNode === scriptContent) {
            const types = ['script-scene', 'script-action', 'script-char', 'script-paren', 'script-dial', 'script-trans'];
            let currentIdx = types.findIndex(t => node.classList.contains(t));
            let nextIdx = (currentIdx + 1) % types.length;
            if (currentIdx === -1) nextIdx = 0;
            
            node.className = types[nextIdx];
            this.app.saveProject();
        }
    }

    formatBlock(type) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;

        const scriptContent = document.getElementById('scriptContent');
        while (node && node.parentNode !== scriptContent && node !== scriptContent) {
            node = node.parentNode;
        }

        if (node && node.parentNode === scriptContent) {
            node.className = ''; 
            switch (type) {
                case 'scene': node.classList.add('script-scene'); break;
                case 'action': node.classList.add('script-action'); break;
                case 'char': node.classList.add('script-char'); break;
                case 'dial': node.classList.add('script-dial'); break;
                case 'parenthetical': node.classList.add('script-paren'); break;
                case 'transition': node.classList.add('script-trans'); break;
            }
            this.app.saveProject();
        }
    }
}
