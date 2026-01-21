// public/js/theme.js
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if(savedTheme === 'light') {
        html.classList.add('light-mode');
        updateIcon(true);
    }

    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            html.classList.toggle('light-mode');
            const isLight = html.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateIcon(isLight);
        });
    }

    function updateIcon(isLight) {
        if(!themeBtn) return;
        const icon = themeBtn.querySelector('i');
        if(isLight) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
});