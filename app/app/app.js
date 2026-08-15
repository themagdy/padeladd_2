document.addEventListener('DOMContentLoaded', () => {
    fetchLatestScores();
});

/* ═══════════════════════════════════════════════════════════════════════════
   LATEST RECENT MATCH SCORES (SOFASCORE / FLASHSCORE STYLE)
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchLatestScores() {
    const list = document.getElementById('scores-list');
    if (!list) return;

    try {
        const res = await fetch('app/api/latest_scores.php');
        const data = await res.json();

        if (data && data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
            renderScores(data.data);
        } else {
            renderFallbackScores();
        }
    } catch (e) {
        renderFallbackScores();
    }
}

function renderScores(matches) {
    const list = document.getElementById('scores-list');
    if (!list) return;

    list.innerHTML = matches.map(match => {
        const teamANames = match.team_a && match.team_a.length > 0
            ? match.team_a.map(p => escapeHtml(p.name)).join(' / ')
            : 'Team A';

        const teamBNames = match.team_b && match.team_b.length > 0
            ? match.team_b.map(p => escapeHtml(p.name)).join(' / ')
            : 'Team B';

        // Parse sets e.g. "6-4, 7-5" -> Team A sets: [6, 7], Team B sets: [4, 5]
        const setsRaw = (match.score || '6-4, 7-5').split(',');
        const setsA = [];
        const setsB = [];

        setsRaw.forEach(s => {
            const parts = s.trim().split('-');
            if (parts.length === 2) {
                setsA.push(parts[0].trim());
                setsB.push(parts[1].trim());
            }
        });

        const setsAHtml = setsA.map((s, idx) => {
            const isWinnerSet = parseInt(s) > parseInt(setsB[idx] || '0');
            return `<span class="set-score ${isWinnerSet ? 'set-win' : ''}">${escapeHtml(s)}</span>`;
        }).join('');

        const setsBHtml = setsB.map((s, idx) => {
            const isWinnerSet = parseInt(s) > parseInt(setsA[idx] || '0');
            return `<span class="set-score ${isWinnerSet ? 'set-win' : ''}">${escapeHtml(s)}</span>`;
        }).join('');

        return `
            <div class="score-card">
                <div class="score-meta">
                    <span class="venue-name">${escapeHtml(match.venue)}</span>
                    <span class="match-date">${escapeHtml(match.date)}</span>
                </div>
                
                <div class="team-line">
                    <div class="team-players">
                        <span class="player-names">${teamANames}</span>
                    </div>
                    <div class="set-scores-group">${setsAHtml}</div>
                </div>

                <div class="team-line">
                    <div class="team-players">
                        <span class="player-names">${teamBNames}</span>
                    </div>
                    <div class="set-scores-group">${setsBHtml}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderFallbackScores() {
    const fallbacks = [
        {
            venue: 'Maadi Padel Club',
            date: 'Today',
            score: '6-4, 7-5',
            team_a: [{ name: 'Mohab' }, { name: 'Abdo' }],
            team_b: [{ name: 'Emamoz' }, { name: 'ahmed' }]
        },
        {
            venue: 'Smouha Club',
            date: 'Yesterday',
            score: '6-3, 4-6, 7-6',
            team_a: [{ name: 'Mohamed Ali' }, { name: 'Karim' }],
            team_b: [{ name: 'Omar K.' }, { name: 'Youssef' }]
        },
        {
            venue: 'Palm Hills Court',
            date: '12 Aug',
            score: '7-6, 6-2',
            team_a: [{ name: 'Hassan' }, { name: 'Amer' }],
            team_b: [{ name: 'Nour' }, { name: 'Ziad' }]
        }
    ];

    renderScores(fallbacks);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
