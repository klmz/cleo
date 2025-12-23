const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById(target).classList.add('active');

            if (target === 'chores') loadChores();
            if (target === 'garbage') loadGarbage();
        });
    });

    // Refresh Buttons
    document.getElementById('refresh-chores').addEventListener('click', loadChores);
    document.getElementById('refresh-garbage').addEventListener('click', loadGarbage);

    // Garbage Form
    document.getElementById('garbage-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('garbage-date').value;
        const type = document.getElementById('garbage-type').value;
        const description = document.getElementById('garbage-desc').value;

        try {
            const res = await fetch(`${API_BASE}/garbage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, type, description })
            });

            if (res.ok) {
                e.target.reset();
                loadGarbage();
            } else {
                alert('Failed to add schedule');
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('Failed to connect to server');
        }
    });

    // Initial Load
    loadChores();
});

async function loadChores() {
    const listEl = document.getElementById('chores-list');
    listEl.innerHTML = '<p>Loading...</p>';

    try {
        const res = await fetch(`${API_BASE}/chores`);
        const chores = await res.json();

        listEl.innerHTML = '';

        if (chores.length === 0) {
            listEl.innerHTML = '<p>No chores found.</p>';
            return;
        }

        chores.forEach(chore => {
            const card = document.createElement('div');
            card.className = `chore-card ${chore.is_overdue ? 'overdue' : 'upcoming'}`;

            let statusText = '';
            if (chore.is_overdue) {
                // Days overdue might be negative, Math.abs to handle logic
                const days = Math.abs(chore.days_until_due);
                statusText = `Overdue by ${days} day${days !== 1 ? 's' : ''}`;
            } else {
                const days = chore.days_until_due;
                statusText = `Due in ${days} day${days !== 1 ? 's' : ''}`;
            }

            // Frequency text
            const freq = chore.frequency_hours >= 24
                ? `${Math.floor(chore.frequency_hours / 24)} day(s)`
                : `${chore.frequency_hours} hours`;

            card.innerHTML = `
                <div class="chore-name">${chore.name}</div>
                <div class="chore-status">${statusText}</div>
                <div class="chore-freq">Repeats every ${freq}</div>
            `;
            listEl.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching chores:', error);
        listEl.innerHTML = '<p class="error">Failed to load chores</p>';
    }
}

async function loadGarbage() {
    const tableBody = document.querySelector('#garbage-table tbody');
    tableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/garbage`);
        const schedule = await res.json();

        tableBody.innerHTML = '';

        if (schedule.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No scheduled pickup found.</td></tr>';
            return;
        }

        schedule.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(entry.scheduled_date)}</td>
                <td>${entry.garbage_type}</td>
                <td>${entry.description || ''}</td>
                <td><button class="btn-delete" onclick="deleteGarbage(${entry.id})">Delete</button></td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching garbage schedule:', error);
        tableBody.innerHTML = '<tr><td colspan="4" class="error">Failed to load schedule</td></tr>';
    }
}

async function deleteGarbage(id) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
        const res = await fetch(`${API_BASE}/garbage/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            loadGarbage();
        } else {
            alert('Failed to delete schedule');
        }
    } catch (error) {
        console.error('Error deleting schedule:', error);
    }
}

function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Make deleteGarbage globally available for onclick
window.deleteGarbage = deleteGarbage;
