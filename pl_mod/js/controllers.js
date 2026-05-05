window.AdminControllers = {
    // ── Dashboard Controller ──────────────────────────────────────────────
    dashboard: {
        async init() {
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`../backend/api/admin/dashboard/stats.php?admin_token=${token}`);
                const data = await res.json();
                if (data.success) {
                    const s = data.data;
                    document.getElementById('stat-players').innerText = s.total_players.toLocaleString();
                    document.getElementById('stat-matches').innerText = s.matches_today.toLocaleString();
                    document.getElementById('stat-played').innerText = s.played_matches.toLocaleString();
                    document.getElementById('stat-scores').innerText = s.scores_submitted.toLocaleString();
                    document.getElementById('stat-reports').innerText = s.pending_reports.toLocaleString();
                    document.getElementById('stat-violations').innerText = s.pending_violations.toLocaleString();
                    
                    if (document.getElementById('stat-venues')) {
                        document.getElementById('stat-venues').innerText = s.venue_requests.toLocaleString();
                    }

                    this.renderActivityChart(s.activity_chart);
                }
            } catch(e) { console.error('Dashboard stats error:', e); }
        },
        renderActivityChart(chartData) {
            const ctx = document.getElementById('activityChart');
            if (!ctx) return;

            // Destroy existing chart if it exists to prevent memory leaks/glitches
            if (this._chart) this._chart.destroy();

            const labels = chartData.map(d => d.date);
            const matches = chartData.map(d => d.matches);
            const players = chartData.map(d => d.players);
            const scores = chartData.map(d => d.scores);
            const logs = chartData.map(d => d.logs);

            this._chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Matches',
                            data: matches,
                            borderColor: '#1b52ce',
                            backgroundColor: 'rgba(27, 82, 206, 0.05)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHitRadius: 10
                        },
                        {
                            label: 'Players',
                            data: players,
                            borderColor: '#ff8b00',
                            backgroundColor: 'rgba(247, 148, 29, 0.05)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHitRadius: 10
                        },
                        {
                            label: 'Scores',
                            data: scores,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.05)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHitRadius: 10
                        },
                        {
                            label: 'Activity',
                            data: logs,
                            borderColor: '#a855f7',
                            backgroundColor: 'rgba(168, 85, 247, 0.05)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHitRadius: 10
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#ccc',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                        }
                    }
                }
            });
        },
        toggleDataset(index) {
            if (!this._chart) return;
            const isVisible = this._chart.isDatasetVisible(index);
            this._chart.setDatasetVisibility(index, !isVisible);
            this._chart.update();

            const el = document.getElementById(`legend-${index}`);
            if (el) {
                el.style.opacity = isVisible ? '0.3' : '1';
            }
        }
    },

    // ── Players Controller ───────────────────────────────────────────────
    players: {
        allPlayers: [],
        currentSort: 'name',
        currentOrder: 'ASC',
        async init() {
            console.log('Initializing Players Controller...');
            this.updateSortIcons();
            try {
                await this.fetchPlayers();
                const searchInput = document.getElementById('player-search');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => this.filterPlayers(e.target.value));
                }
                const editForm = document.getElementById('edit-player-form');
                if (editForm) {
                    editForm.addEventListener('submit', (e) => this.handleUpdate(e));
                }
            } catch (err) {
                console.error('Players init error:', err);
            }
        },
        async fetchPlayers(search = '') {
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`../backend/api/admin/players/list.php?search=${search}&sort=${this.currentSort}&order=${this.currentOrder}&admin_token=${token}`);
                const data = await res.json();
                if (data.success) {
                    this.allPlayers = data.data.players;
                    this.renderPlayers(this.allPlayers);
                } else {
                    console.error('Failed to fetch players:', data.message);
                }
            } catch (err) {
                console.error('Network error fetching players:', err);
            }
        },
        renderPlayers(players) {
            const tbody = document.getElementById('player-list');
            if (!tbody) {
                console.error('Table body #player-list not found in DOM');
                return;
            }
            if (players.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--c-text-muted);">No players found.</td></tr>';
                return;
            }
            tbody.innerHTML = players.map(p => `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div class="player-avatar-small">
                                ${p.profile_image_thumb 
                                    ? `<img src="../${p.profile_image_thumb}" alt="" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                                    : `<div style="width:100%; height:100%; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:var(--c-text-muted); font-size:10px;">${(p.nickname || p.first_name || 'S')[0]}</div>`
                                }
                            </div>
                            <div class="player-info-cell">
                                <span class="player-name">${p.full_name || 'No Name'}</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="player-nickname">${p.nickname || '---'}</span>
                                    <span class="player-code">${p.player_code || '---'}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="player-info-cell contact-info">
                            <span>📱 ${p.phone || 'N/A'}</span>
                            <span>✉️ ${p.email || 'N/A'}</span>
                        </div>
                    </td>
                    <td style="text-transform:capitalize; font-size:13px; color:var(--c-text-muted);">${p.gender || '---'}</td>
                    <td>
                        <div style="font-weight:700; color:#fff;">${p.rank_points || 0} <small style="color:var(--c-text-muted)">pts</small></div>
                        <div style="font-size:11px; color:var(--c-orange); font-weight:800;">⚡ ${p.current_buffer || 0} <span style="opacity:0.6">(${p.buffer_matches_left || 0} left)</span></div>
                    </td>
                    <td>
                        <span class="status-tag ${p.account_status || 'active'}">${p.account_status || 'active'}</span>
                    </td>
                    <td style="text-align:right;">
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button onclick="AdminControllers.players.openModal(${p.id})" class="btn-badge" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:8px 16px; font-weight:700;">Edit</button>
                            <button onclick="AdminControllers.players.toggleStatus(${p.id}, '${p.account_status || 'active'}')" class="btn-badge" style="background:rgba(241, 90, 41, 0.1); color:var(--c-red); border:1px solid rgba(241, 90, 41, 0.2); padding:8px 16px; font-weight:700;">
                                ${p.account_status === 'suspended' ? 'Unban' : 'Ban'}
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        },
        filterPlayers(query) {
            const q = query.toLowerCase();
            const filtered = this.allPlayers.filter(p => 
                (p.full_name && p.full_name.toLowerCase().includes(q)) || 
                p.phone.includes(q) || 
                p.email.toLowerCase().includes(q) ||
                p.player_code.toLowerCase().includes(q)
            );
            this.renderPlayers(filtered);
        },
        openModal(userId) {
            const p = this.allPlayers.find(x => x.id == userId);
            if (!p) return;
            document.getElementById('edit-player-id').value = p.id;
            
            // Map Name
            document.getElementById('edit-first-name').value = p.first_name || '';
            document.getElementById('edit-last-name').value = p.last_name || '';
            document.getElementById('edit-email').value = p.email || '';
            document.getElementById('edit-nickname').value = p.nickname || '';
            document.getElementById('edit-gender').value = p.gender || 'male';
            
            // Map Stats
            document.getElementById('edit-rank-points').value = p.rank_points || 0;
            document.getElementById('edit-current-buffer').value = p.current_buffer || 0;
            document.getElementById('edit-buffer-matches').value = p.buffer_matches_left || 0;
            document.getElementById('edit-status').value = p.account_status || 'active';
            
            // Map Avatar
            const preview = document.getElementById('edit-avatar-preview');
            const removeBtn = document.getElementById('btn-remove-avatar');
            const removeStatus = document.getElementById('avatar-remove-status');
            const removeInput = document.getElementById('edit-remove-avatar');

            removeInput.value = "0";
            removeStatus.style.display = 'none';
            removeBtn.style.display = p.profile_image_thumb ? 'block' : 'none';

            if (p.profile_image_thumb) {
                preview.innerHTML = `<img src="../${p.profile_image_thumb}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                preview.innerHTML = `<span style="font-size:24px;">👤</span>`;
            }

            document.getElementById('modal-title').innerText = `Edit ${p.full_name || 'Player'}`;
            document.getElementById('edit-player-modal').style.display = 'flex';
        },
        markAvatarForRemoval() {
            document.getElementById('edit-remove-avatar').value = "1";
            document.getElementById('avatar-remove-status').style.display = 'block';
            document.getElementById('btn-remove-avatar').style.display = 'none';
            document.getElementById('edit-avatar-preview').style.opacity = "0.3";
        },
        closeModal() {
            document.getElementById('edit-player-modal').style.display = 'none';
        },
        async handleUpdate(e) {
            e.preventDefault();
            const token = localStorage.getItem('admin_token');
            const payload = {
                action: 'update_stats',
                user_id: document.getElementById('edit-player-id').value,
                first_name: document.getElementById('edit-first-name').value,
                last_name: document.getElementById('edit-last-name').value,
                email: document.getElementById('edit-email').value,
                nickname: document.getElementById('edit-nickname').value,
                gender: document.getElementById('edit-gender').value,
                rank_points: document.getElementById('edit-rank-points').value,
                current_buffer: document.getElementById('edit-current-buffer').value,
                buffer_matches_left: document.getElementById('edit-buffer-matches').value,
                account_status: document.getElementById('edit-status').value,
                remove_avatar: document.getElementById('edit-remove-avatar').value
            };
            const res = await fetch(`../backend/api/admin/players/update.php?admin_token=${token}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.closeModal();
                this.fetchPlayers();
            } else {
                alert(data.message || 'Update failed');
            }
        },
        async toggleStatus(userId, currentStatus) {
            const isActive = currentStatus === 'active';
            if (!confirm(`Are you sure you want to ${isActive ? 'BAN' : 'UNBAN'} this player?`)) return;
            const token = localStorage.getItem('admin_token');
            const payload = {
                action: 'toggle_status',
                user_id: userId,
                status: currentStatus === 'active' ? 'suspended' : 'active'
            };
            const res = await fetch(`../backend/api/admin/players/update.php?admin_token=${token}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) this.fetchPlayers();
        },
        setSort(field) {
            if (this.currentSort === field) {
                this.currentOrder = (this.currentOrder === 'ASC') ? 'DESC' : 'ASC';
            } else {
                this.currentSort = field;
                this.currentOrder = 'ASC';
            }
            this.updateSortIcons();
            this.fetchPlayers(document.getElementById('player-search')?.value || '');
        },
        updateSortIcons() {
            document.querySelectorAll('.sort-icon').forEach(el => el.innerText = '↕');
            const icon = document.getElementById(`sort-icon-${this.currentSort}`);
            if (icon) {
                icon.innerText = this.currentOrder === 'ASC' ? '↑' : '↓';
                icon.style.color = 'var(--c-primary)';
            }
        }
    },

    // ── Matches Controller ───────────────────────────────────────────────
    matches: {
        currentReportTab: 'profile',
        currentData: null,
        logSort: { field: 'time', order: 'asc' },
        async init() {
            this.bindInvestigate();
        },
        bindInvestigate() {
            // Wait a tiny bit for the header sync to finish
            setTimeout(() => {
                const btn = document.querySelector('#header-actions button');
                const input = document.getElementById('match-code-input');
                if (btn && input) {
                    btn.onclick = () => AdminControllers.matches.investigate();
                    input.onkeypress = (e) => {
                        if (e.key === 'Enter') AdminControllers.matches.investigate();
                    };
                    console.log("Investigate button and input bound in header.");
                }
            }, 100);
        },
        async investigate() {
            const btn = document.querySelector('#header-actions button');
            const originalBtnText = btn ? btn.innerText : 'INVESTIGATE';
            
            try {
                const input = document.getElementById('match-code-input');
                if (!input) return;
                
                const code = input.value.trim();
                if (!code) {
                    alert("Please enter a match code.");
                    return;
                }
                
                if (btn) {
                    btn.disabled = true;
                    btn.innerText = 'LOADING...';
                }
                
                const token = localStorage.getItem('admin_token');
                const res = await fetch(`../backend/api/admin/matches/investigate.php?code=${code}&admin_token=${token}`);
                if (!res.ok) throw new Error("Network error");
                
                const data = await res.json();
                if (data.success) {
                    AdminControllers.matches.renderInvestigation(data.data);
                } else {
                    alert(data.message || "Match not found.");
                }
            } catch (err) {
                console.error("Investigate Error:", err);
                alert("Failed to investigate match. Check console.");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalBtnText;
                }
            }
        },
        renderInvestigation(data) {
            try {
                const container = document.getElementById('investigation-result');
                const empty = document.getElementById('investigation-empty');
                if (!container || !empty) {
                    console.error('Investigation containers not found');
                    return;
                }

                if (!data || !data.match) {
                    alert("No data found for this match code.");
                    return;
                }

                this.currentData = data;
                empty.style.display = 'none';
                container.style.display = 'block';

                const m = data.match;
                const players = data.players || [];
                const scores = data.scores || [];
                const team1 = players.filter(p => p.team_no == 1);
                const team2 = players.filter(p => p.team_no == 2);
                
                container.innerHTML = `
                    <div class="investigator-header" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
                        <div class="card" style="margin-bottom:0; padding:20px;">
                            <label style="font-size:10px; text-transform:uppercase; color:var(--c-text-muted); font-weight:800; letter-spacing:1px;">Venue / Time</label>
                            <div style="color:#fff; font-weight:700; font-size:16px; margin-top:4px;">${m.venue_name || m.venue_name_manual || 'Manual Venue'}</div>
                            <div style="font-size:12px; color:var(--c-text-muted)">${m.match_datetime ? new Date(m.match_datetime).toLocaleString() : 'N/A'}</div>
                        </div>
                        <div class="card" style="margin-bottom:0; padding:20px; display:flex; flex-direction:column; justify-content:center;">
                            <label style="font-size:10px; text-transform:uppercase; color:var(--c-text-muted); font-weight:800; letter-spacing:1.5px; margin-bottom:10px; display:block;">Match Identity</label>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="color:#fff; font-weight:800; font-size:18px; text-transform:capitalize; line-height:1;">${m.match_type || '---'}</div>
                                <span class="status-tag ${m.status || 'open'}" style="font-size:10px; font-weight:900; text-transform:uppercase; padding:4px 10px; border-radius:100px;">
                                    ${(m.status === 'open' ? 'Mixed' : (m.status === 'completed' ? 'Scores' : m.status)) || '---'}
                                </span>
                            </div>
                            <div style="font-size:11px; color:var(--c-text-muted); margin-top:8px; font-weight:600; letter-spacing:0.5px;">CODE: <b style="color:var(--c-primary)">${m.match_code || '---'}</b></div>
                        </div>
                        <div class="card" style="margin-bottom:0; padding:20px;">
                            <label style="font-size:10px; text-transform:uppercase; color:var(--c-text-muted); font-weight:800; letter-spacing:1px;">Point Calculation</label>
                            <div style="color:var(--c-primary); font-weight:700; font-size:16px; margin-top:4px;">v2.2 Standard</div>
                            <div style="font-size:11px; color:var(--c-text-muted)">Audit-ready logic</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-bottom:24px;">
                        <div class="card" style="padding:0; overflow:hidden;">
                            <div style="padding:16px 24px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); font-weight:800; color:#fff; font-size:12px; text-transform:uppercase;">Team 1</div>
                            <div style="padding:12px 0;">
                                ${team1.length ? team1.map(p => `<div style="display:flex; justify-content:space-between; padding:8px 24px;"><span>${p.nickname || 'Unknown'} <small style="opacity:0.6">(${p.player_code || '---'})</small></span> <b style="color:var(--c-primary)">${p.rank_points || 0} pts</b></div>`).join('') : '<div style="padding:16px 24px; color:var(--c-text-muted)">No players.</div>'}
                            </div>
                        </div>
                        <div class="card" style="padding:0; overflow:hidden;">
                            <div style="padding:16px 24px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); font-weight:800; color:#fff; font-size:12px; text-transform:uppercase;">Team 2</div>
                            <div style="padding:12px 0;">
                                ${team2.length ? team2.map(p => `<div style="display:flex; justify-content:space-between; padding:8px 24px;"><span>${p.nickname || 'Unknown'} <small style="opacity:0.6">(${p.player_code || '---'})</small></span> <b style="color:var(--c-primary)">${p.rank_points || 0} pts</b></div>`).join('') : '<div style="padding:16px 24px; color:var(--c-text-muted)">No players.</div>'}
                            </div>
                        </div>
                    </div>

                    <div class="card" style="padding:0; overflow:hidden; margin-bottom:24px;" id="investigation-logs-card">
                        <!-- Rendered by renderLogsTable -->
                    </div>

                    <div class="card" style="padding:0; overflow:hidden;">
                        <div style="padding:16px 24px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); font-weight:800; color:#fff; font-size:12px; text-transform:uppercase;">Score Submissions</div>
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Submitted By</th>
                                    <th>Score (T1 - T2)</th>
                                    <th style="text-align:right;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scores.length ? scores.map(s => `
                                    <tr>
                                        <td>${s.submitter_name || '---'} <small style="opacity:0.6">(${s.submitter_code || '---'})</small></td>
                                        <td><b style="color:#fff">${s.t1_set1}-${s.t2_set1} | ${s.t1_set2}-${s.t2_set2} ${s.t1_set3 ? '| '+s.t1_set3+'-'+s.t2_set3 : ''}</b></td>
                                        <td style="text-align:right;"><span class="status-tag ${s.status}">${s.status}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--c-text-muted)">No scores submitted yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
                
                this.renderLogsTable();
            } catch (err) {
                console.error("Render Investigation Error:", err);
                alert("Error displaying match details. Check console.");
            }
        },
        sortLogs(field) {
            if (this.logSort.field === field) {
                this.logSort.order = (this.logSort.order === 'asc') ? 'desc' : 'asc';
            } else {
                this.logSort.field = field;
                this.logSort.order = 'asc';
            }
            this.renderLogsTable();
        },
        renderLogsTable() {
            const container = document.getElementById('investigation-logs-card');
            if (!container || !this.currentData) return;

            let logs = [...(this.currentData.logs || [])];
            const { field, order } = this.logSort;

            logs.sort((a, b) => {
                let valA = (a[field] || '').toString().toLowerCase();
                let valB = (b[field] || '').toString().toLowerCase();
                if (field === 'time') {
                    valA = new Date(a.time).getTime();
                    valB = new Date(b.time).getTime();
                }
                return order === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
            });

            const getIcon = (f) => {
                if (this.logSort.field !== f) return '↕';
                return this.logSort.order === 'asc' ? '↑' : '↓';
            };

            container.innerHTML = `
                <div style="padding:16px 24px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); font-weight:800; color:#fff; font-size:12px; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center;">
                    <span>Match Activity Log</span>
                    <span style="font-size:10px; color:var(--c-text-muted); text-transform:none; font-weight:400;">Click headers to sort</span>
                </div>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th onclick="AdminControllers.matches.sortLogs('player')" style="cursor:pointer; user-select:none;">Player <span style="font-size:10px; color:var(--c-primary); opacity:0.6;">${getIcon('player')}</span></th>
                            <th onclick="AdminControllers.matches.sortLogs('action')" style="cursor:pointer; user-select:none;">Action <span style="font-size:10px; color:var(--c-primary); opacity:0.6;">${getIcon('action')}</span></th>
                            <th onclick="AdminControllers.matches.sortLogs('time')" style="cursor:pointer; user-select:none; text-align:right;">Timestamp <span style="font-size:10px; color:var(--c-primary); opacity:0.6;">${getIcon('time')}</span></th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.length ? logs.map(l => {
                            let actionText = l.action || '---';
                            let color = 'var(--c-text-muted)';
                            let weight = '700';
                            const isChat = actionText.startsWith('Chat:');
                            const isHidden = l.is_hidden == 1;
                            
                            if (actionText.includes('Joined') || actionText.includes('Accepted')) color = 'var(--c-green)';
                            if (actionText.includes('Withdrew') || actionText.includes('Cancelled')) color = 'var(--c-red)';
                            
                            if (isChat) {
                                color = 'var(--c-primary)';
                                actionText = actionText.replace('Chat:', '💬 Chat:');
                                weight = '400';
                                if (isHidden) actionText = `<span style="color:var(--c-orange); font-weight:800;">[HIDDEN]</span> ` + actionText;
                            }
                            
                            return `
                            <tr style="${isHidden ? 'opacity:0.5; background:rgba(241, 90, 41, 0.02);' : ''}">
                                <td><b style="color:#fff">${l.player || 'System'}</b> ${l.player_code ? `<small style="color:var(--c-text-muted)">(${l.player_code})</small>` : ''}</td>
                                <td><span style="color:${color}; font-weight:${weight};">${actionText}</span></td>
                                <td style="text-align:right; color:var(--c-text-muted); font-size:12px;">${l.time ? new Date(l.time).toLocaleString() : '---'}</td>
                                <td style="text-align:right;">
                                    ${isChat ? `
                                        <button onclick="AdminControllers.matches.toggleChatVisibility(${l.chat_id}, ${l.is_hidden || 0})" class="btn-badge" style="background:rgba(255,255,255,0.03); color:${isHidden ? 'var(--c-primary)' : 'var(--c-text-muted)'}; border-radius:100px; padding:4px 10px; border:1px solid rgba(255,255,255,0.05); font-size:9px;">
                                            ${isHidden ? '👁️' : '🚫'}
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--c-text-muted)">No activity logged yet.</td></tr>'}
                    </tbody>
                </table>
            `;
        },
        async toggleChatVisibility(chatId, currentHidden) {
            const token = localStorage.getItem('admin_token');
            const newStatus = currentHidden ? 0 : 1;
            try {
                const res = await fetch(`../backend/api/admin/system/moderate_chat.php?admin_token=${token}`, {
                    method: 'POST',
                    body: JSON.stringify({ chat_id: chatId, hide: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    const msg = this.currentData.logs.find(l => l.chat_id == chatId);
                    if (msg) msg.is_hidden = newStatus;
                    this.renderLogsTable();
                }
            } catch (e) { console.error('Moderate chat error:', e); }
        }
    },

    // ── Reports Controller ───────────────────────────────────────────────
    reports: {
        currentTab: 'profile',
        allReports: null,
        showArchived: false,
        searchQuery: '',
        async init() {
            console.log('--- Reports Init Start ---');
            await this.fetchReports();
            
            const toggle = document.getElementById('show-archived-reports');
            if (toggle) toggle.checked = this.showArchived;
        },
        async fetchReports() {
            const token = localStorage.getItem('admin_token');
            try {
                console.log('Fetching reports from API...');
                const res = await fetch(`../backend/api/admin/reports/list.php?admin_token=${token}`);
                const data = await res.json();
                console.log('API Response received:', data);
                
                if (data.success) {
                    this.allReports = data.data;
                    console.log('Data stored in allReports:', this.allReports);
                    this.updateCounts();
                    this.renderReports();
                } else {
                    console.error('API Error:', data.message);
                }
            } catch (err) {
                console.error('Fetch Error:', err);
            }
        },
        setSearch(query) {
            this.searchQuery = query.toLowerCase().trim();
            this.renderReports();
        },
        renderReports() {
            console.log('renderReports triggered. currentTab:', this.currentTab);
            try {
                const head = document.getElementById('reports-head');
                const list = document.getElementById('reports-list');
                const empty = document.getElementById('reports-empty');
                
                if (!head || !list) {
                    console.error('Table elements NOT found in DOM!');
                    return;
                }

                if (!this.allReports) {
                    console.warn('allReports is still null.');
                    return;
                }

                let reports = this.currentTab === 'profile' 
                    ? (this.allReports.profile_reports || [])
                    : (this.allReports.match_reports || []);
                
                if (!this.showArchived) {
                    reports = reports.filter(r => !r.is_archived || r.is_archived == 0);
                }

                if (this.searchQuery) {
                    reports = reports.filter(r => {
                        const reporter = (r.reporter_name || '').toLowerCase();
                        const repCode = (r.reporter_code || '').toLowerCase();
                        const reason = (r.reason || r.report_reason || r.reason_text || '').toLowerCase();
                        const target = (r.target_name || '').toLowerCase();
                        const targetCode = (r.target_code || '').toLowerCase();
                        const match = (r.match_code || '').toLowerCase();
                        return reporter.includes(this.searchQuery) || 
                               repCode.includes(this.searchQuery) ||
                               reason.includes(this.searchQuery) || 
                               target.includes(this.searchQuery) || 
                               targetCode.includes(this.searchQuery) ||
                               match.includes(this.searchQuery);
                    });
                }

                console.log(`Found ${reports.length} reports to render.`);

                if (reports.length === 0) {
                    head.innerHTML = '';
                    list.innerHTML = '';
                    if (empty) empty.style.display = 'block';
                    return;
                }
                
                if (empty) empty.style.display = 'none';

                if (this.currentTab === 'profile') {
                    head.innerHTML = `<tr><th>Reporter</th><th>Reported Player</th><th>Reason</th><th>Date</th><th style="text-align:right;">Actions</th></tr>`;
                    list.innerHTML = reports.map(r => `
                        <tr>
                            <td>${r.reporter_name || 'System'} <small style="opacity:0.6">(${r.reporter_code || '---'})</small></td>
                            <td><b style="color:#fff">${r.target_name || 'Unknown'}</b> <small style="opacity:0.6">(${r.target_code || '---'})</small></td>
                            <td style="max-width:400px; font-size:13px; color:var(--c-text-muted); line-height:1.4;">${r.reason || r.report_reason || r.reason_text || 'No reason provided'}</td>
                            <td style="font-size:12px; color:var(--c-text-muted)">${r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}</td>
                            <td style="text-align:right;">
                                <button onclick="AdminControllers.reports.archiveItem(${r.id}, ${r.is_archived || 0}, 'profile')" class="btn-badge" style="background:rgba(255,255,255,0.03); color:${r.is_archived ? 'var(--c-primary)' : 'var(--c-text-muted)'}; border-radius:100px; padding:6px 12px; border:1px solid rgba(255,255,255,0.05);">
                                    ${r.is_archived ? '📂 Unarchive' : '📁 Archive'}
                                </button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    head.innerHTML = `<tr><th>Reporter</th><th>Match Code</th><th>Reason</th><th>Date</th><th style="text-align:right;">Actions</th></tr>`;
                    list.innerHTML = reports.map(r => `
                        <tr>
                            <td>${r.reporter_name || 'System'} <small style="opacity:0.6">(${r.reporter_code || '---'})</small></td>
                            <td><b style="color:var(--c-primary); font-weight:800;">${r.match_code || '---'}</b></td>
                            <td style="max-width:400px; font-size:13px; color:var(--c-text-muted); line-height:1.4;">${r.reason || r.report_reason || r.reason_text || 'No reason provided'}</td>
                            <td style="font-size:12px; color:var(--c-text-muted)">${r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}</td>
                            <td style="text-align:right;">
                                <button onclick="AdminControllers.reports.archiveItem(${r.id}, ${r.is_archived || 0}, 'match')" class="btn-badge" style="background:rgba(255,255,255,0.03); color:${r.is_archived ? 'var(--c-primary)' : 'var(--c-text-muted)'}; border-radius:100px; padding:6px 12px; border:1px solid rgba(255,255,255,0.05);">
                                    ${r.is_archived ? '📂 Unarchive' : '📁 Archive'}
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
                console.log('Render complete.');
            } catch (err) {
                console.error("Render Reports Error:", err);
            }
        },
        updateCounts() {
            if (!this.allReports) return;
            const pUnarchived = (this.allReports.profile_reports || []).filter(r => !r.is_archived || r.is_archived == 0).length;
            const mUnarchived = (this.allReports.match_reports || []).filter(r => !r.is_archived || r.is_archived == 0).length;
            
            const pCountEl = document.getElementById('count-profile-reports');
            const mCountEl = document.getElementById('count-match-reports');
            
            if (pCountEl) pCountEl.innerText = pUnarchived;
            if (mCountEl) mCountEl.innerText = mUnarchived;
        },
        toggleArchived(checked) {
            this.showArchived = checked;
            this.renderReports();
        },
        async archiveItem(id, currentStatus, type) {
            const token = localStorage.getItem('admin_token');
            const newStatus = currentStatus ? 0 : 1;
            const apiType = type === 'profile' ? 'profile_report' : 'match_report';
            
            try {
                const res = await fetch(`../backend/api/admin/system/archive_item.php?admin_token=${token}`, {
                    method: 'POST',
                    body: JSON.stringify({ id, type: apiType, status: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    // Update local state
                    const listKey = type === 'profile' ? 'profile_reports' : 'match_reports';
                    const idx = this.allReports[listKey].findIndex(r => r.id == id);
                    if (idx !== -1) this.allReports[listKey][idx].is_archived = newStatus;
                    this.updateCounts();
                    this.renderReports();
                }
            } catch (e) { console.error('Archive error:', e); }
        },
        switchTab(tab) {
            console.log('Switching tab to:', tab);
            this.currentTab = tab;
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            const activeTab = document.getElementById(`tab-${tab}-reports`);
            if (activeTab) activeTab.classList.add('active');
            this.renderReports();
        }
    },

    // ── Venues Controller ───────────────────────────────────────────────
    venues: {
        allRequests: [],
        async init() {
            await this.fetchRequests();
            const approveForm = document.getElementById('approve-venue-form');
            if (approveForm) {
                approveForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.processRequest('approve');
                });
            }
        },
        async fetchRequests() {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`../backend/api/admin/venues/requests.php?admin_token=${token}`);
            const data = await res.json();
            if (data.success) {
                this.allRequests = data.data.requests;
                this.renderRequests(this.allRequests);
            }
        },
        renderRequests(requests) {
            const tbody = document.getElementById('venue-request-list');
            const noReq = document.getElementById('no-requests');
            if (!tbody || !noReq) return;
            if (requests.length === 0) {
                tbody.innerHTML = '';
                noReq.style.display = 'block';
                return;
            }
            noReq.style.display = 'none';
            tbody.innerHTML = requests.map(r => `<tr><td><b style="color:#fff">${r.venue_name}</b></td><td>${r.requester_name || 'System'} <small style="opacity:0.6">(${r.requester_code || '---'})</small></td><td>${new Date(r.created_at).toLocaleDateString()}</td><td style="text-align:right;"><button onclick="AdminControllers.venues.openModal(${r.id})" class="btn-badge" style="background:var(--c-primary); color:#fff; border:none; padding:8px 20px; font-weight:700;">Review</button></td></tr>`).join('');
        },
        openModal(requestId) {
            const r = this.allRequests.find(x => x.id == requestId);
            if (!r) return;
            document.getElementById('review-request-id').value = r.id;
            document.getElementById('review-name').value = r.venue_name;
            document.getElementById('review-location').value = '';
            document.getElementById('review-venue-modal').style.display = 'flex';
        },
        closeModal() {
            document.getElementById('review-venue-modal').style.display = 'none';
        },
        async processRequest(action) {
            if (action === 'reject' && !confirm('Are you sure you want to reject this request?')) return;
            const token = localStorage.getItem('admin_token');
            const payload = {
                action: action,
                request_id: document.getElementById('review-request-id').value,
                name: document.getElementById('review-name').value,
                location_link: document.getElementById('review-location').value
            };
            const res = await fetch(`../backend/api/admin/venues/approve.php?admin_token=${token}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.closeModal();
                this.fetchRequests();
            } else alert(data.message);
        }
    },

    // ── System Controller ───────────────────────────────────────────────
    system: {
        async runTask(task) {
            const consoleEl = document.getElementById('console-output');
            if (!consoleEl) return;
            consoleEl.innerHTML += `<br>> Running ${task}...`;
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`../backend/api/admin/system/cron_manual.php?admin_token=${token}`, {
                    method: 'POST',
                    body: JSON.stringify({ task: task })
                });
                const data = await res.json();
                if (data.success) {
                    consoleEl.innerHTML += `<br><span style="color:#fff">${data.data.output || 'Done (No output)'}</span>`;
                    consoleEl.innerHTML += `<br>> Task ${task} completed successfully.`;
                } else {
                    consoleEl.innerHTML += `<br><span style="color:var(--c-red)">Error: ${data.message}</span>`;
                }
            } catch (e) { consoleEl.innerHTML += `<br><span style="color:var(--c-red)">Network error.</span>`; }
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    },

    // ── Violations Controller ───────────────────────────────────────────
    violations: {
        allViolations: [],
        showArchived: false,
        async init() {
            console.log('Violations controller init...');
            await this.fetchViolations();
            
            // Sync toggle state if input exists
            const toggle = document.getElementById('show-archived-violations');
            if (toggle) toggle.checked = this.showArchived;
            
            // Bind search - Look specifically in the header actions first
            const searchInput = document.getElementById('violation-search');
            if (searchInput) {
                console.log('Violation search input found, binding event...');
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    console.log('Searching for:', val);
                    this.filterViolations(val);
                });
            } else {
                console.warn('Violation search input NOT found in header.');
            }
        },
        async fetchViolations() {
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`../backend/api/admin/system/violations.php?admin_token=${token}`);
                const data = await res.json();
                if (data.success) {
                    this.allViolations = data.data.violations;
                    this.renderViolations(this.allViolations);
                }
            } catch (e) { console.error('Fetch violations error:', e); }
        },
        filterViolations(query) {
            const q = query.toLowerCase();
            let filtered = this.allViolations.filter(v => 
                (v.match_code && v.match_code.toLowerCase().includes(q)) ||
                (v.player_code && v.player_code.toLowerCase().includes(q)) ||
                (v.player_name && v.player_name.toLowerCase().includes(q)) ||
                (v.event_type && v.event_type.toLowerCase().includes(q)) ||
                (v.reason && v.reason.toLowerCase().includes(q))
            );
            
            if (!this.showArchived) {
                filtered = filtered.filter(v => !v.is_archived || v.is_archived == 0);
            }
            
            this.renderViolations(filtered);
        },
        toggleArchived(checked) {
            this.showArchived = checked;
            this.filterViolations(document.getElementById('violation-search')?.value || '');
        },
        async archiveItem(id, currentStatus) {
            const token = localStorage.getItem('admin_token');
            const newStatus = currentStatus ? 0 : 1;
            try {
                const res = await fetch(`../backend/api/admin/system/archive_item.php?admin_token=${token}`, {
                    method: 'POST',
                    body: JSON.stringify({ id, type: 'violation', status: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    // Update local state
                    const idx = this.allViolations.findIndex(v => v.id == id);
                    if (idx !== -1) this.allViolations[idx].is_archived = newStatus;
                    this.filterViolations(document.getElementById('violation-search')?.value || '');
                }
            } catch (e) { console.error('Archive error:', e); }
        },
        renderViolations(listToRender) {
            const list = document.getElementById('violations-list');
            const empty = document.getElementById('violations-empty');
            if (!list) return;

            if (listToRender.length === 0) {
                list.innerHTML = '';
                if (empty) empty.style.display = 'block';
                return;
            }
            if (empty) empty.style.display = 'none';

            list.innerHTML = listToRender.map(v => {
                const isWithdrawal = v.event_type === 'late_withdrawal';
                const tagClass = isWithdrawal ? 'withdrawal' : 'cancellation';
                const tagLabel = isWithdrawal ? 'LATE WITHDRAWAL' : 'LATE CANCEL';
                
                return `
                    <tr>
                        <td>
                            <div class="player-info-cell">
                                <span class="player-name">${v.player_name || 'System'}</span>
                                ${v.player_code ? `<span class="player-code">${v.player_code}</span>` : ''}
                            </div>
                        </td>
                        <td><span class="event-tag ${tagClass}">${tagLabel}</span></td>
                        <td>
                            <b style="color:var(--c-primary)">${v.match_code || '---'}</b>
                            <br><small style="color:var(--c-text-muted)">${v.match_datetime ? new Date(v.match_datetime).toLocaleDateString() : ''}</small>
                        </td>
                        <td><span class="time-badge">${v.hours_until} hrs</span></td>
                        <td style="max-width:250px; font-size:12px; color:var(--c-text-muted)">${v.reason}</td>
                        <td style="font-size:12px; color:var(--c-text-muted)">${new Date(v.created_at).toLocaleString()}</td>
                        <td style="text-align:right;">
                            <button onclick="AdminControllers.violations.archiveItem(${v.id}, ${v.is_archived || 0})" class="btn-badge" style="background:rgba(255,255,255,0.03); color:${v.is_archived ? 'var(--c-primary)' : 'var(--c-text-muted)'}; border-radius:100px; padding:6px 12px; border:1px solid rgba(255,255,255,0.05);">
                                ${v.is_archived ? '📂 Unarchive' : '📁 Archive'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    },

    // ── Logs Controller ──────────────────────────────────────────────────
    logs: {
        allLogs: [],
        async init() {
            console.log('Logs controller init...');
            await this.fetchLogs();
            
            // Bind search and filter
            const search = document.getElementById('log-search');
            const type = document.getElementById('log-type-filter');
            
            if (search) {
                search.addEventListener('input', (e) => this.fetchLogs(e.target.value, type.value));
            }
            if (type) {
                type.addEventListener('change', (e) => this.fetchLogs(search.value, e.target.value));
            }
        },
        async fetchLogs(search = '', type = 'all') {
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`../backend/api/admin/logs/list.php?search=${search}&type=${type}&admin_token=${token}`);
                const data = await res.json();
                if (data.success) {
                    this.allLogs = data.data.logs;
                    this.renderLogs();
                }
            } catch (e) { console.error('Fetch logs error:', e); }
        },
        renderLogs() {
            const list = document.getElementById('logs-list');
            const empty = document.getElementById('logs-empty');
            if (!list) return;

            if (this.allLogs.length === 0) {
                list.innerHTML = '';
                if (empty) empty.style.display = 'block';
                return;
            }
            if (empty) empty.style.display = 'none';

            list.innerHTML = this.allLogs.map(l => {
                const time = new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                const typeLabel = l.event_type.replace('_', ' ');
                const isChat = l.event_type === 'chat_message';
                const isHidden = l.is_hidden == 1;
                
                return `
                    <tr style="${isHidden ? 'opacity:0.5; background:rgba(241, 90, 41, 0.02);' : ''}">
                        <td style="color:var(--c-text-muted); font-size:12px; font-family:monospace;">${time}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div class="player-avatar-small">
                                    ${l.user_avatar 
                                        ? `<img src="../${l.user_avatar}" alt="" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                                        : `<div style="width:100%; height:100%; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:var(--c-text-muted); font-size:10px;">${(l.user_name || 'S')[0]}</div>`
                                    }
                                </div>
                                <div>
                                    <div style="font-weight:700; color:#fff;">${l.user_name || 'System'}</div>
                                    <div style="font-size:11px; color:var(--c-primary); font-weight:800;">${l.user_code || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td><span class="event-type-tag ${l.event_type}">${typeLabel}</span></td>
                        <td><b style="color:#fff">${l.match_code || '---'}</b></td>
                        <td style="max-width:300px; font-size:13px; color:var(--c-text-muted); line-height:1.4;">
                            ${isChat && isHidden ? '<span style="color:var(--c-orange); font-weight:800; font-size:10px;">[HIDDEN]</span> ' : ''}
                            ${l.details}
                        </td>
                        <td style="text-align:right;">
                            ${isChat ? `
                                <button onclick="AdminControllers.logs.toggleChatVisibility(${l.chat_id}, ${l.is_hidden || 0})" class="btn-badge" style="background:rgba(255,255,255,0.03); color:${isHidden ? 'var(--c-primary)' : 'var(--c-text-muted)'}; border-radius:100px; padding:6px 12px; border:1px solid rgba(255,255,255,0.05); font-size:10px;">
                                    ${isHidden ? '👁️ Unhide' : '🚫 Hide'}
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        },
        async toggleChatVisibility(chatId, currentHidden) {
            const token = localStorage.getItem('admin_token');
            const newStatus = currentHidden ? 0 : 1;
            try {
                const res = await fetch(`../backend/api/admin/system/moderate_chat.php?admin_token=${token}`, {
                    method: 'POST',
                    body: JSON.stringify({ chat_id: chatId, hide: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    const msg = this.allLogs.find(l => l.chat_id == chatId);
                    if (msg) msg.is_hidden = newStatus;
                    this.renderLogs();
                }
            } catch (e) { console.error('Moderate chat error:', e); }
        }
    }
};
