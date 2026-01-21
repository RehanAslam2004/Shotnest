// public/js/app.js

// 1. Select DOM Elements
const form = document.getElementById('shotForm');
const sceneInput = document.getElementById('sceneDescription');
const moodInput = document.getElementById('moodSelect');
const resultsArea = document.getElementById('resultsArea');

// 2. Add Event Listener to Form
form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop page from reloading

    const scene = sceneInput.value;
    const mood = moodInput.value;

    // specific check: don't submit if empty
    if (!scene.trim()) {
        alert("Please describe your scene first.");
        return;
    }

    // Call function to get data
    await fetchShots(scene, mood);
});

// 3. Function to Fetch Data from Backend
async function fetchShots(scene, mood) {
    try {
        // Show loading state
        resultsArea.innerHTML = '<p style="text-align:center; color:#888;">Generating shot list...</p>';

        const response = await fetch('/generate-shots', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ scene, mood })
        });

        const data = await response.json();

        if (data.success) {
            displayShots(data.shots);
        } else {
            resultsArea.innerHTML = '<p>Error generating shots.</p>';
        }

    } catch (error) {
        console.error("Error:", error);
        resultsArea.innerHTML = '<p>Something went wrong. Check console.</p>';
    }
}

// 4. Function to Render Cards (DOM Manipulation)
function displayShots(shots) {
    // Clear previous results
    resultsArea.innerHTML = '';

    // Loop through each shot and build HTML
    shots.forEach((shot) => {
        // Create Card Container
        const card = document.createElement('div');
        card.classList.add('shot-card');

        // Shot Header (Number + Type)
        const header = document.createElement('div');
        header.classList.add('shot-header');
        header.innerHTML = `
            <span class="shot-number">#${shot.id}</span>
            <span class="shot-type">${shot.type}</span>
        `;

        // Shot Details (Movement + Notes)
        const body = document.createElement('div');
        body.classList.add('shot-body');
        body.innerHTML = `
            <p><strong>Camera:</strong> ${shot.movement}</p>
            <p class="shot-notes">${shot.description}</p>
        `;

        // Assemble the card
        card.appendChild(header);
        card.appendChild(body);

        // Add to page
        resultsArea.appendChild(card);
    });
}