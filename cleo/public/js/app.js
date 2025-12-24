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

        renderChores(chores, listEl);

    } catch (error) {
        console.error('Error fetching chores:', error);
        listEl.innerHTML = '<p class="error">Failed to load chores</p>';
    }
}

function renderChores(chores, listEl) {
    listEl.innerHTML = '';

    const now = Date.now();

    chores.forEach(chore => {
        const card = document.createElement('div');

        // Logic for "Completed":
        // 1. Must not be overdue.
        // 2. Must have been completed previously.
        // 3. The completion must be within the frequency period (i.e. we are in the "grace period" of doing it).
        //    User suggestion: "mark it complete if you have a completion in the last 24 hours" (for daily).

        let isCompleted = false;
        if (!chore.is_overdue && chore.last_completed) {
            const freqMs = chore.frequency_hours * 60 * 60 * 1000;
            const timeSinceCompletion = now - chore.last_completed;
            if (timeSinceCompletion < freqMs) {
                isCompleted = true;
            }
        }

        card.className = `chore-card ${chore.is_overdue ? 'overdue' : 'upcoming'} ${isCompleted ? 'completed' : ''}`;
        card.dataset.id = chore.id;

        let statusText = '';
        if (chore.is_overdue) {
            const days = Math.abs(chore.days_until_due);
            statusText = `Overdue by ${days} day${days !== 1 ? 's' : ''}`;
        } else if (isCompleted) {
            statusText = 'Completed';
        } else {
            // It's upcoming/due soon
            const days = chore.days_until_due;
            if (days === 0) {
                // Less than 24 hours
                statusText = 'Due today';
            } else {
                statusText = `Due in ${days} day${days !== 1 ? 's' : ''}`;
            }
        }

        // Frequency text
        const freq = chore.frequency_hours >= 24
            ? `${Math.floor(chore.frequency_hours / 24)} day(s)`
            : `${chore.frequency_hours} hours`;

        const lastBy = chore.last_completed_by ? `Last done by ${chore.last_completed_by}` : 'Not completed yet';

        card.innerHTML = `
            <div class="chore-name">${chore.name}</div>
            <div class="chore-status">${statusText}</div>
            <div class="chore-completed-by">${lastBy}</div>
            <div class="chore-freq">Repeats every ${freq}</div>
            <div class="chore-stats" style="display: none;">Loading stats...</div>
        `;

        card.addEventListener('click', (e) => toggleStats(e, chore.id));

        listEl.appendChild(card);
    });
}

async function toggleStats(e, choreId) {
    const card = e.currentTarget;
    const statsDiv = card.querySelector('.chore-stats');

    if (statsDiv.style.display === 'none') {
        statsDiv.style.display = 'block';
        if (statsDiv.dataset.loaded !== 'true') {
            try {
                const res = await fetch(`${API_BASE}/chores/${choreId}/stats`);
                if (!res.ok) throw new Error('Failed to fetch stats');

                const stats = await res.json();

                if (Array.isArray(stats) && stats.length === 0) {
                    statsDiv.innerHTML = '<div class="stat-row">No history</div>';
                } else if (Array.isArray(stats)) {
                    statsDiv.innerHTML = stats.map(s => `
                        <div class="stat-row">
                            <span class="stat-user">${s.user}</span>
                            <span class="stat-count">${s.count}x</span>
                        </div>
                    `).join('');
                } else {
                    throw new Error('Invalid stats format');
                }
                statsDiv.dataset.loaded = 'true';
            } catch (err) {
                statsDiv.innerHTML = '<div class="stat-row error">Failed to load stats</div>';
                console.error(err);
            }
        }
    } else {
        statsDiv.style.display = 'none';
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
