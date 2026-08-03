// Utility helpers for dates and relative time
const isToday = (d) => {
    if (!d) return false;
    const date = new Date(d.replace(' ', 'T')); // Handle PHP datetime format
    const now = new Date();
    return date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
};

const relTime = (d) => {
    if (!d) return '';
    try {
        const date = new Date(d.replace(' ', 'T'));
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
};

const UI = {
    showError: function (inputName, message, form) {
        const input = form.querySelector(`[name="${inputName}"]`);
        if (!input) return;

        input.classList.add('error');
        const group = input.closest('.form-group');
        if (!group) return;

        let errorSpan = group.querySelector('.form-error');
        if (!errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'form-error';
            group.appendChild(errorSpan);
        }
        errorSpan.innerText = message;
        errorSpan.style.display = 'block';
        errorSpan.style.marginTop = '4px';

        // Smoothly scroll the error into view if it's not fully visible
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    clearErrors: function (form) {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
    },
    _lastNavAvatar: null,
    syncNav: async function () {
        if (!Auth.isAuthenticated()) return;
        const res = await API.post('/profile/get', {});
        if (!res || !res.success) return;
        const { user, profile } = res.data;

        // Nav avatar
        const av = document.getElementById('nav-avatar');
        if (av) {
            const thumb = profile.profile_image_thumb || profile.profile_image;
            if (profile && thumb) {
                // Only update DOM if the image changed to prevent flickering/re-loading
                if (UI._lastNavAvatar !== thumb) {
                    av.innerHTML = safeHTML(UI.getAvatarHtml(thumb, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;'));
                    av.style.background = 'none';
                    UI._lastNavAvatar = thumb;
                }
            } else {
                const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || (user.nickname?.[0] || '?').toUpperCase();
                if (UI._lastNavAvatar !== initials) {
                    av.innerHTML = safeHTML(`<div class="avatar-placeholder" style="width:100%; height:100%; border-radius:50%; font-size: 14px;">${initials}</div>`);
                    av.style.background = 'none';
                    UI._lastNavAvatar = initials;
                }
            }
            av.setAttribute('href', 'profile/view');
        }

        // Notification badge — pull real unread count from Phase 6
        NotificationsController.pollBadge();
    },

    getAvatarHtml: function (thumb, style = '', wrapperStyle = '', initials = '?', className = '', extraAttr = '') {
        if (thumb) {
            const avatarUrl = `${CONFIG.ASSET_BASE}/${thumb}`;
            // If the element is rendered dynamically, we add a class/attr to check for duplication.
            // On load, we tag the image. On subsequent renders, if the browser sees the exact same img tag
            // with the same src/data-src, adding class='loaded' immediately or storing the cache state prevents flickering.
            return `<div class="avatar-wrap ${className}" style="${wrapperStyle}" ${extraAttr} data-avatar-src="${avatarUrl}"><img src="${avatarUrl}" style="${style}" onload="this.parentElement.classList.add('loaded')" onerror="this.parentElement.classList.add('loaded'); this.style.display='none';"></div>`;
        } else {
            return `<div class="avatar-placeholder ${className}" style="${wrapperStyle}" ${extraAttr}>${initials}</div>`;
        }
    },
    formatMatchDateOnly: function (dateVal) {
        if (!dateVal) return '';
        try {
            const dt = new Date(dateVal.replace(' ', 'T'));
            const now = new Date();
            const isTodayCalendar = dt.toDateString() === now.toDateString();
            if (isTodayCalendar && now.getHours() >= 4) {
                return 'Today';
            }
            const shortWeekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = dt.getDate();
            const fullMonth = dt.toLocaleDateString('en-US', { month: 'long' });
            let formatted = `${shortWeekday}, ${dayNum} ${fullMonth}`;
            if (dt.getFullYear() !== now.getFullYear()) {
                formatted += ` ${dt.getFullYear()}`;
            }
            return formatted;
        } catch (e) {
            return dateVal;
        }
    },
    formatDate: function (dateStr, includeTime = false) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr.replace(' ', 'T'));
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            if (includeTime) {
                options.hour = 'numeric';
                options.minute = '2-digit';
            }
            return date.toLocaleDateString('en-US', options);
        } catch (e) { return dateStr; }
    },
    formatStoryVenue: function (venueName) {
        if (!venueName) return 'Padel Court';
        const parts = venueName.split(' - ');
        if (parts.length > 1) {
            return `${parts[0]}<br><span style="font-size: 0.9em; opacity: 0.8; font-weight: 500;">${parts[1]}</span>`;
        }
        return venueName;
    },
    formatStoryDate: function (dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr.replace(' ', 'T'));
            const now = new Date();
            const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diffDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
            const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
            const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            let prefix = '';
            if (diffDays === 1 || (diffDays > 1 && diffDays < 7)) prefix = 'Next ';
            else if (diffDays === -1 || (diffDays < -1 && diffDays > -7)) prefix = 'Last ';
            if (diffDays === 0) return `Today at ${time}`;
            return `${prefix}${weekday} at ${time}`;
        } catch (e) { return dateStr; }
    }
};

// -------------------------------------------------------
//  STORIES CONTROLLER
// -------------------------------------------------------
const StoriesController = {
    _activeStories: [],
    _currentFeed: [],
    _currentIndex: 0,
    _isShowing: false,
    _isPaused: false,
    _pressStartTime: 0,
    _isHolding: false,
    _progressInterval: null,
    _progressValue: 0,
    _STORY_DURATION: 5000,
    _icons: {
        pause: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="5" x2="9" y2="19"></line><line x1="15" y1="5" x2="15" y2="19"></line></svg>`,
        play: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7 4 19 12 7 20 7 4"></polygon></svg>`,
        close: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
    },
    _cache: null,
    _lastTrayFingerprint: '',
    _trayItems: [],

    initTray: async function () {
        const tray = document.getElementById('story-tray');
        if (!tray) return;

        // Reset fingerprint to force render on the newly created DOM element
        this._lastTrayFingerprint = '';

        // 1. Instant load from persistent or memory cache
        if (!this._cache) {
            try {
                const saved = localStorage.getItem('stories_cache');
                if (saved) {
                    const savedStories = JSON.parse(saved);
                    this._cache = this.sortStories(savedStories);
                    this._activeStories = this._cache;
                }
            } catch (e) { console.error('Stories cache load failed', e); }
        }

        if (this._cache) {
            this.renderTray();
            tray.classList.add('revealed');
        }

        // 1.5. Set up auto-refresh timer (every 10 seconds)
        if (this._refreshTimer) clearInterval(this._refreshTimer);
        this._refreshTimer = setInterval(() => {
            if (!this._isShowing) { // Only refresh if not currently watching stories
                this.renderTray();
            }
        }, 10000);

        // 2. Refresh from API in background
        const res = await API.post('/stories/list');
        if (res && res.success) {
            const newStoriesJson = JSON.stringify(res.data.stories);
            const oldStoriesJson = JSON.stringify(this._cache);

            if (newStoriesJson !== oldStoriesJson) {
                const sorted = this.sortStories(res.data.stories);
                this._activeStories = sorted;
                this._cache = sorted;
                this.renderTray();

                // Persist new data
                try {
                    localStorage.setItem('stories_cache', newStoriesJson);
                } catch (e) { }

                // Trigger animation if not already revealed
                setTimeout(() => {
                    tray.classList.add('revealed');
                }, 100);
            } else if (this._activeStories.length > 0) {
                // Even if data is same, ensure it's revealed
                tray.classList.add('revealed');
            }
        }
    },

    sortStories: function (stories) {
        if (!stories) return [];
        return [...stories].sort((a, b) => {
            // 1. Priority: Your Story (is_mine)
            const mineA = parseInt(a.is_mine) === 1 ? 1 : 0;
            const mineB = parseInt(b.is_mine) === 1 ? 1 : 0;
            if (mineA !== mineB) return mineB - mineA;

            // 2. Unseen first
            const seenA = a.is_seen ? 1 : 0;
            const seenB = b.is_seen ? 1 : 0;
            if (seenA !== seenB) return seenA - seenB;

            // 3. Latest first (by match_datetime)
            const dateA = new Date(a.match_datetime).getTime();
            const dateB = new Date(b.match_datetime).getTime();
            if (dateA !== dateB) return dateB - dateA;

            return parseInt(b.id) - parseInt(a.id);
        });
    },

    renderTray: function () {
        const tray = document.getElementById('story-tray');
        if (!tray) return;

        if (this._activeStories.length === 0) {
            tray.style.display = 'none';
            return;
        }

        tray.style.display = 'flex';
        const currentUserId = DashboardController._currentUser?.id || parseInt(localStorage.getItem('auth_user_id'));

        // 1. Group stories by player (Unique Avatars)
        const playerGroups = {}; // playerId -> { player: obj, stories: [], isMine: bool }

        this._activeStories.forEach(s => {
            const players = s.players || [];
            const isMine = parseInt(s.is_mine) === 1;
            const followedIds = (s.followed_player_ids || '').split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

            if (isMine) {
                const me = players.find(p => parseInt(p.id) === currentUserId) || players[0];
                if (!playerGroups[currentUserId]) playerGroups[currentUserId] = { player: me, stories: [], isMine: true };
                // Deduplicate stories within the same player (shouldn't happen with match-based IDs but safe)
                if (!playerGroups[currentUserId].stories.find(st => st.id === s.id)) {
                    playerGroups[currentUserId].stories.push(s);
                }
            }

            followedIds.forEach(fid => {
                if (fid === currentUserId) return;
                const p = players.find(player => parseInt(player.id) === fid);
                if (p) {
                    if (!playerGroups[fid]) playerGroups[fid] = { player: p, stories: [], isMine: false };
                    if (!playerGroups[fid].stories.find(st => st.id === s.id)) {
                        playerGroups[fid].stories.push(s);
                    }
                }
            });
        });

        // 2. Build tray items with seen status and sort priority
        const trayItems = Object.values(playerGroups).map(group => {
            // A player bubble is "seen" only if ALL its stories are seen
            const isSeen = group.stories.every(s => !!s.is_seen || parseInt(s.is_mine) === 1);
            // Latest story date for sorting
            const latestDate = Math.max(...group.stories.map(s => new Date(s.match_datetime).getTime()));

            return {
                ...group,
                isSeen,
                latestDate
            };
        });

        // 3. Sort for the Tray: Me first, then Unseen, then Latest
        trayItems.sort((a, b) => {
            if (a.isMine !== b.isMine) return b.isMine - a.isMine;
            if (a.isSeen !== b.isSeen) return a.isSeen - b.isSeen;
            return b.latestDate - a.latestDate;
        });

        // Save tray items to maintain playback sequence
        this._trayItems = trayItems;

        let html = '';
        trayItems.forEach((item, idx) => {
            const initials = ((item.player?.first_name?.[0] || '') + (item.player?.last_name?.[0] || '')).toUpperCase() || '?';

            html += `
                <div class="story-item ${item.isSeen ? 'seen' : ''}" onclick="StoriesController.playPlayerByIndex(${idx})">
                    <div class="story-avatar-ring">
                        ${UI.getAvatarHtml(item.player?.profile_image_thumb || item.player?.profile_image, 'width:100%;height:100%;border-radius:50%;object-fit:cover;', 'width:100%;height:100%;border-radius:50%;font-size:18px;', initials)}
                    </div>
                    <span class="story-label text-truncate" style="max-width: 75px;">${item.isMine ? 'Your Story' : (item.player.nickname || item.player.first_name)}</span>
                </div>
            `;

            // Add separator after the user's stories section, but only if there are other stories
            if (item.isMine && trayItems.length > 1 && (idx === trayItems.length - 1 || !trayItems[idx + 1].isMine)) {
                html += `<div class="story-separator"></div>`;
            }
        });

        // Fingerprint check to avoid flickering
        const fingerprint = trayItems.map(it => `${it.player.id}:${it.isSeen}`).join('|');
        if (this._lastTrayFingerprint === fingerprint) return;
        this._lastTrayFingerprint = fingerprint;

        tray.innerHTML = safeHTML(html);
    },

    playPlayerByIndex: function (trayIdx) {
        if (!this._trayItems || !this._trayItems[trayIdx]) return;

        // Construct the playback feed following the tray sequence
        const fullFeed = [];
        const seenStoryIds = new Set(); // Keep track of already added stories to prevent duplicates in playback

        for (let i = trayIdx; i < this._trayItems.length; i++) {
            const group = this._trayItems[i];

            // Sort stories within the player's stack: oldest first for natural story flow
            const sortedStories = [...group.stories].sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));

            sortedStories.forEach(s => {
                const storyId = parseInt(s.id);
                if (!seenStoryIds.has(storyId)) {
                    seenStoryIds.add(storyId);
                    fullFeed.push({
                        ...s,
                        _overlayPlayer: group.player // Attach context for the header
                    });
                }
            });
        }

        if (fullFeed.length === 0) return;

        this._currentFeed = fullFeed;
        this._currentIndex = 0;
        this._isShowing = true;
        this.renderPlayerOverlay();
        this.startStory();
    },

    playUserStories: async function (userId) {
        const res = await API.post('/stories/user', { user_id: userId });
        if (res && res.success && res.data.stories.length > 0) {
            this._currentIndex = 0;
            // For profile view, we just show that user's stories
            this._currentFeed = res.data.stories.map(s => ({ ...s, _overlayPlayer: res.data.player }));
            this._isShowing = true;
            this.renderPlayerOverlay();
            this.startStory();
        } else {
            Toast.show('No active stories for this player');
        }
    },


    renderPlayerOverlay: function () {
        let overlay = document.getElementById('story-player-overlay');
        if (!overlay) return; // Should exist in index.html
        overlay.style.display = 'flex';

        // Save scroll position
        this._scrollPos = window.pageYOffset || document.documentElement.scrollTop;
        document.documentElement.classList.add('story-open');
        document.body.classList.add('story-open');
        const app = document.getElementById('app');
        if (app) app.classList.add('story-open');

        // Offset body to stay at same visual position
        document.body.style.top = `-${this._scrollPos}px`;
    },

    startStory: function () {
        const story = this._currentFeed[this._currentIndex];
        if (!story) {
            this.closePlayer();
            return;
        }

        this._isPaused = false;
        this.renderStoryContent(story);
        this.startProgress();
        this.markSeen(story.id);
    },

    renderStoryContent: function (story) {
        const overlay = document.getElementById('story-player-overlay');
        if (!overlay) return;

        const isScore = story.type === 'score';
        const players = story.players || [];

        // Use the context-aware player for the header
        const headerPlayer = story._overlayPlayer || players[0];

        let progressHtml = '';
        this._currentFeed.forEach((_, idx) => {
            let width = '0%';
            if (idx < this._currentIndex) width = '100%';
            progressHtml += `<div class="story-progress-bar"><div class="story-progress-fill" style="width: ${width}"></div></div>`;
        });

        const venueName = story.official_venue_name || story.venue_name || 'Padel Court';
        const initials = ((headerPlayer?.first_name?.[0] || '') + (headerPlayer?.last_name?.[0] || '')).toUpperCase() || '?';
        const profileId = headerPlayer?.player_code || headerPlayer?.player_xcode || headerPlayer?.id; const isMine = parseInt(story.is_mine) === 1;
        const viewers = story.viewers || [];
        let viewersHtml = '';
        if (isMine && viewers.length > 0) {
            const limit = 4;
            const displayViewers = viewers.slice(0, limit);
            const extra = viewers.length - displayViewers.length;

            const avatarsListHtml = displayViewers.map((u, index) => {
                const initials = ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || '?';
                return `
                    <div style="width: 26px; height: 26px; border-radius: 50%; overflow: hidden; border: 2px solid var(--c-bg-card); margin-left: ${index > 0 ? '-10px' : '0'}px; z-index: ${10 - index}; flex-shrink: 0; box-shadow: 1px 1px 3px rgba(0,0,0,0.2);">
                        ${UI.getAvatarHtml(u.profile_image_thumb || u.profile_image, 'width:100%; height:100%; object-fit:cover;', 'width:100%; height:100%; font-size:9px; font-weight:700;', initials)}
                    </div>
                `;
            }).join('');

            viewersHtml = `
                <div class="story-viewers-bar" 
                     onclick="event.stopPropagation(); StoriesController.showViewers();" 
                     style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; transition: background 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.15); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    <div style="display: flex; align-items: center;">
                        ${avatarsListHtml}
                    </div>
                    <span style="font-size: 13px; font-weight: 600; color: #fff; font-family: 'Montserrat', sans-serif; letter-spacing: 0.3px;">
                        ${viewers.length} player${viewers.length > 1 ? 's' : ''} saw this
                    </span>
                </div>
            `;
        }

        overlay.innerHTML = safeHTML(`
            <div class="story-header">
                <div class="story-progress-container">${progressHtml}</div>
                <div class="story-meta">
                    <div class="story-user" onclick="Router.navigate('/p/${profileId}'); StoriesController.closePlayer();">
                        <div class="story-user-avatar">
                             ${UI.getAvatarHtml(headerPlayer?.profile_image_thumb, 'width:100%;height:100%;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;', initials)}
                        </div>
                        <div class="story-user-info">
                            <span class="story-username text-truncate" style="max-width: 120px;">${headerPlayer?.nickname || headerPlayer?.first_name}</span>
                            <span class="story-time">${story.type === 'upcoming' ? 'Upcoming Match' : 'Match Result'}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        <button class="story-pause" onclick="StoriesController.togglePause(event)" style="padding: 4px; display: flex; align-items: center; justify-content: center;">
                            <span id="story-pause-icon" style="display: flex;">${this._icons.pause}</span>
                        </button>
                        <button class="story-close" onclick="StoriesController.closePlayer()" style="padding: 4px; display: flex; align-items: center; justify-content: center;">
                            ${this._icons.close}
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="story-content-area"
                 onmousedown="StoriesController.handlePressStart(event)"
                 onmouseup="StoriesController.handlePressEnd(event)"
                 onmouseleave="StoriesController.handlePressEnd(event)">
                <div class="story-card ${story.type}">
                    <div class="story-match-type-badge">${story.match_type === 'competition' ? '🏆 COMPETITION' : '🤝 FRIENDLY'}</div>
                    
                    ${isScore ? this.renderScoreStory(story) : this.renderUpcomingStory(story)}
 
                    <div class="story-footer-actions" style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 22px;">
                        ${viewersHtml ? viewersHtml : ''}
                        <button class="btn btn-primary" style="width:100%; height:54px; border-radius:16px; font-weight:800; font-family:'Outfit'; box-shadow:0 10px 25px rgba(27, 82, 206, 0.4);" onclick="Router.navigate('/matches/${story.match_code}'); StoriesController.closePlayer();">VIEW MATCH DETAILS</button>
                    </div>
                </div>
            </div>
        `);

        // Attach touch handlers programmatically with passive:false so e.preventDefault() works
        // on Android WebView (inline ontouchstart handlers are passive and ignore preventDefault)
        const contentArea = overlay.querySelector('.story-content-area');
        if (contentArea) {
            contentArea.addEventListener('touchstart', (e) => StoriesController.handlePressStart(e), { passive: false });
            contentArea.addEventListener('touchend', (e) => StoriesController.handlePressEnd(e), { passive: false });
            contentArea.addEventListener('touchcancel', (e) => StoriesController.handlePressEnd(e), { passive: false });
        }
    },

    renderUpcomingStory: function (story) {
        const players = story.players || [];
        const team1 = players.filter(p => parseInt(p.team_no) === 1);
        const team2 = players.filter(p => parseInt(p.team_no) === 2);

        const renderTeamCardUpcoming = (teamPlayers) => {
            const p1 = teamPlayers[0];
            const p2 = teamPlayers[1];

            const p1Initials = p1 ? ((p1.first_name?.[0] || '') + (p1.last_name?.[0] || '')).toUpperCase() || '?' : '';
            const p2Initials = p2 ? ((p2.first_name?.[0] || '') + (p2.last_name?.[0] || '')).toUpperCase() || '?' : '';

            const p1Code = p1 ? (p1.player_code || p1.player_xcode || p1.id) : '';
            const p2Code = p2 ? (p2.player_code || p2.player_xcode || p2.id) : '';

            return `
                <div class="story-team-card upcoming" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        <!-- Overlapping Avatars on the Left -->
                        <div class="story-team-avatars" style="display: flex; flex-shrink: 0; align-items: center;">
                            <div class="story-team-avatar-mini" style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; border: 2px solid var(--c-bg-card); background: var(--c-bg-card); position: relative; z-index: 2;">
                                ${p1 ? UI.getAvatarHtml(p1.profile_image_thumb, 'width:100%;height:100%;object-fit:cover;', 'width:100%;height:100%;', p1Initials) : '<div class="avatar-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:16px;">+</div>'}
                            </div>
                            <div class="story-team-avatar-mini" style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; border: 2px solid var(--c-bg-card); background: var(--c-bg-card); position: relative; z-index: 1; margin-left: -15px;">
                                ${p2 ? UI.getAvatarHtml(p2.profile_image_thumb, 'width:100%;height:100%;object-fit:cover;', 'width:100%;height:100%;', p2Initials) : '<div class="avatar-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:16px;">+</div>'}
                            </div>
                        </div>

                        <!-- Names and Player Codes Stacked -->
                        <div style="display: flex; flex: 1; align-items: center; justify-content: space-around; gap: 8px; min-width: 0;">
                            <!-- Player 1 Column -->
                            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; min-width: 0;">
                                <span style="font-size: 14px; font-weight: 700; color: #fff; font-family: 'Montserrat', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${p1 ? (p1.nickname || p1.first_name) : '<span style="font-style:italic; opacity:0.4;">Open Slot</span>'}</span>
                                ${p1 ? `<span style="font-size: 10px; font-weight: 800; color: var(--c-orange); font-family: 'Outfit'; margin-top: 2px;">${p1Code}</span>` : ''}
                            </div>

                            <!-- Spacer slash -->
                            <div style="font-size: 10px; color: rgba(255,255,255,0.15); font-weight: 800; font-family: 'Outfit'; flex-shrink: 0;">/</div>

                            <!-- Player 2 Column -->
                            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; min-width: 0;">
                                <span style="font-size: 14px; font-weight: 700; color: #fff; font-family: 'Montserrat', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${p2 ? (p2.nickname || p2.first_name) : '<span style="font-style:italic; opacity:0.4;">Open Slot</span>'}</span>
                                ${p2 ? `<span style="font-size: 10px; font-weight: 800; color: var(--c-orange); font-family: 'Outfit'; margin-top: 2px;">${p2Code}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        const venueName = story.official_venue_name || story.venue_name || 'Padel Court';

        return `
            <div class="story-score-refined">
                <div class="story-result-label">MATCH PREVIEW</div>
                
                <div class="story-teams-stack">
                    ${renderTeamCardUpcoming(team1)}
                    <div class="story-vs-divider">VS</div>
                    ${renderTeamCardUpcoming(team2)}
                </div>

                <div class="story-match-details">
                    <div class="story-detail-item">
                        <div class="icon-wrap">📍</div>
                        <div class="text">${UI.formatStoryVenue(venueName)}</div>
                    </div>
                    <div class="story-detail-item">
                        <div class="icon-wrap">📅</div>
                        <div class="text">${UI.formatStoryDate(story.match_datetime)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderScoreStory: function (story) {
        const scores = story.score_data || [];
        const s = scores[0] || {};
        let players = story.players || [];

        // Handle team switches and external replacements (Composition JSON)
        if (s.composition_json) {
            try {
                const comp = typeof s.composition_json === 'string' ? JSON.parse(s.composition_json) : s.composition_json;

                // Build a new player list based on the composition
                const updatedPlayers = comp.map(compPlayer => {
                    // Try to find original player data (for avatars, etc.)
                    const original = players.find(p => parseInt(p.id) === parseInt(compPlayer.user_id));
                    if (original) {
                        return { ...original, ...compPlayer };
                    }
                    // If not found in original list (replacement), use comp data as is
                    return {
                        id: compPlayer.user_id,
                        first_name: compPlayer.name,
                        nickname: compPlayer.name,
                        ...compPlayer
                    };
                });

                if (updatedPlayers.length > 0) players = updatedPlayers;
            } catch (e) { console.error("Story composition parse failed", e); }
        }

        const team1 = players.filter(p => parseInt(p.team_no) === 1);
        const team2 = players.filter(p => parseInt(p.team_no) === 2);

        // Process sets
        const sets = [];
        let t1Sets = 0, t2Sets = 0;
        for (let i = 1; i <= 3; i++) {
            const s1 = s[`t1_set${i}`];
            const s2 = s[`t2_set${i}`];
            if (s1 === undefined || s2 === undefined) continue;
            if (i > 1 && parseInt(s1) === 0 && parseInt(s2) === 0) continue;

            sets.push({ s1, s2 });
            if (parseInt(s1) > parseInt(s2)) t1Sets++;
            else if (parseInt(s2) > parseInt(s1)) t2Sets++;
        }

        const t1Wins = t1Sets > t2Sets;
        const t2Wins = t2Sets > t1Sets;

        const renderTeamCard = (teamPlayers, isWinner) => `
            <div class="story-team-card ${isWinner ? 'winner' : ''}">
                <div style="display:flex; align-items:flex-start;">
                    <div class="story-team-avatars">
                        ${teamPlayers.map(p => `
                            <div class="story-team-avatar-mini">
                                ${UI.getAvatarHtml(p.profile_image_thumb, 'width:100%;height:100%;object-fit:cover;', 'width:100%;height:100%;', (p.nickname?.[0] || p.first_name[0]))}
                            </div>
                        `).join('')}
                    </div>
                    <div class="story-team-names">
                        ${teamPlayers.map(p => `<span>${p.nickname || p.first_name}</span>`).join('')}
                        ${isWinner ? '<div class="story-winner-badge">WINNERS</div>' : ''}
                    </div>
                </div>
                <div class="story-team-score-sets" style="align-self: flex-start; margin-top: 2px;">
                    ${sets.map(set => `
                        <div class="story-set-box ${(teamPlayers === team1 ? parseInt(set.s1) > parseInt(set.s2) : parseInt(set.s2) > parseInt(set.s1)) ? 'set-won' : ''}">
                            ${teamPlayers === team1 ? set.s1 : set.s2}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const venueName = story.official_venue_name || story.venue_name || 'Padel Court';

        return `
            <div class="story-score-refined">
                <div class="story-result-label">MATCH RESULT</div>
                
                <div class="story-teams-stack">
                    ${renderTeamCard(team1, t1Wins)}
                    <div class="story-vs-divider">VS</div>
                    ${renderTeamCard(team2, t2Wins)}
                </div>

                <div class="story-match-details">
                    <div class="story-detail-item">
                        <div class="icon-wrap">📍</div>
                        <div class="text">${UI.formatStoryVenue(venueName)}</div>
                    </div>
                    <div class="story-detail-item">
                        <div class="icon-wrap">📅</div>
                        <div class="text">${UI.formatStoryDate(story.match_datetime)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    startProgress: function () {
        if (this._progressInterval) clearInterval(this._progressInterval);
        this._progressValue = 0;
        this.resumeProgress();
    },

    togglePause: function (e) {
        if (e) e.stopPropagation();
        this._isPaused = !this._isPaused;
        const icon = document.getElementById('story-pause-icon');
        if (icon) icon.innerHTML = this._isPaused ? this._icons.play : this._icons.pause;

        if (this._isPaused) {
            if (this._progressInterval) clearInterval(this._progressInterval);
        } else {
            this.resumeProgress();
        }
    },

    resumeProgress: function () {
        if (this._progressInterval) clearInterval(this._progressInterval);
        const bars = document.querySelectorAll('.story-progress-fill');
        const bar = bars[this._currentIndex];
        if (!bar) return;

        const duration = this._STORY_DURATION;
        const interval = 50;
        const step = 100 / (duration / interval);

        this._progressInterval = setInterval(() => {
            if (this._isPaused || this._isHolding) return;
            this._progressValue += step;
            bar.style.width = Math.min(this._progressValue, 100) + '%';
            if (this._progressValue >= 100) {
                this.next();
            }
        }, interval);
    },

    handlePressStart: function (e) {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.story-viewers-bar')) return;

        // Prevent context menus, magnification glasses, dragging, and text selection on hold
        if (e.type === 'touchstart' || e.type === 'mousedown') {
            e.preventDefault();
        }

        this._pressStartTime = Date.now();
        this._isHolding = true;
        // Do NOT clear the interval — let the tick's _isHolding check freeze progress naturally
    },

    handlePressEnd: function (e) {
        if (!this._isHolding) return;
        this._isHolding = false;

        const duration = Date.now() - this._pressStartTime;

        // Interval is still running — just unfreezing it via _isHolding = false is enough.
        // Only call resumeProgress if the interval was somehow lost.
        if (!this._progressInterval && !this._isPaused) {
            this.resumeProgress();
        }

        if (duration < 250) {
            this.handleTap(e);
        }
    },

    handleTap: function (e) {
        if (e.target.closest('button') || e.target.closest('a')) return;

        let x = e.clientX;
        if (x === undefined && e.changedTouches && e.changedTouches.length > 0) {
            x = e.changedTouches[0].clientX;
        }
        if (x === undefined && e.touches && e.touches.length > 0) {
            x = e.touches[0].clientX;
        }
        if (x === undefined) return;

        const w = window.innerWidth;

        if (x < w / 2) {
            this.prev();
        } else {
            this.next();
        }
    },

    showViewers: function () {
        const story = this._currentFeed[this._currentIndex];
        if (!story || !story.viewers || story.viewers.length === 0) return;

        // Pause playback while modal is open
        if (!this._isPaused) {
            this.togglePause();
        }

        const list = story.viewers;
        const myId = parseInt(localStorage.getItem('auth_user_id')) || 0;
        let html = '<div style="max-height:50vh; overflow-y:auto; text-align:left; padding-right:5px; margin-top:10px;" class="custom-scroll">';

        list.forEach(u => {
            let initials = '?';
            const name = u.nickname || (u.first_name + ' ' + u.last_name).trim();
            if (u.first_name && u.last_name) {
                initials = (u.first_name.charAt(0) + u.last_name.charAt(0)).toUpperCase();
            } else {
                initials = name.substring(0, 2).toUpperCase();
            }
            const avatarHtml = UI.getAvatarHtml(u.profile_image_thumb || u.profile_image, 'width:100%; height:100%; border-radius:50%; object-fit:cover;', 'width:40px; height:40px; border-radius:50%; flex-shrink:0; font-size:14px; font-weight:700; letter-spacing:0.5px; display:flex; align-items:center; justify-content:center; padding-top:2px;', initials);

            html += `<div onclick="ConfirmModal.close(); StoriesController.closePlayer(); Router.navigate('/profile/view/${u.player_code}')" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; cursor:pointer; background:rgba(255,255,255,0.02); margin-bottom:6px; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">${avatarHtml}<div style="flex:1; min-width:0; text-align:left;"><div style="font-weight:700; font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div><div style="font-size:10px; font-weight:600; color:var(--c-orange); font-family:monospace; margin-top:1px;">${u.player_code}</div></div></div>`;
        });
        html += '</div>';

        ConfirmModal.show({
            title: `Seen by ${list.length}`,
            message: html,
            icon: '👓',
            showCancel: false,
            confirmText: 'Close',
            type: 'info',
            headerLayout: 'row'
        }).then(() => {
            // Replay the same story from the start when the popup is closed
            this._isPaused = false;
            const icon = document.getElementById('story-pause-icon');
            if (icon) icon.innerHTML = this._icons.pause;

            this._progressValue = 0;
            const bars = document.querySelectorAll('.story-progress-fill');
            const bar = bars[this._currentIndex];
            if (bar) bar.style.width = '0%';

            this.resumeProgress();
        });
    },

    next: function () {
        if (this._currentIndex < this._currentFeed.length - 1) {
            this._currentIndex++;
            this.startStory();
        } else {
            this.closePlayer();
        }
    },

    prev: function () {
        if (this._currentIndex > 0) {
            this._currentIndex--;
            this.startStory();
        } else {
            this.startStory();
        }
    },

    closePlayer: function () {
        this._isShowing = false;
        if (this._progressInterval) clearInterval(this._progressInterval);
        const overlay = document.getElementById('story-player-overlay');
        if (overlay) overlay.style.display = 'none';

        document.documentElement.classList.remove('story-open');
        document.body.classList.remove('story-open');
        const app = document.getElementById('app');
        if (app) app.classList.remove('story-open');

        // Restore scroll position
        document.body.style.top = '';
        window.scrollTo(0, this._scrollPos || 0);

        if (Router.currentPath === 'dashboard') {
            this.initTray();
        }
    },

    markSeen: async function (storyId) {
        const story = this._activeStories.find(s => parseInt(s.id) === parseInt(storyId));
        if (!story) return;

        // Do not record own stories in the seen list
        if (parseInt(story.is_mine) === 1) return;

        if (!story.is_seen) {
            story.is_seen = 1;
            // Re-render tray in background so it's updated when user closes story
            this.renderTray();
            await API.post('/stories/mark_seen', { story_id: storyId });
        }
    }
};

const Sanitizer = {
    // Strips emojis and special symbols to keep text professional
    cleanName: function (str) {
        if (!str) return '';
        // Trim and remove common emojis/symbols
        return str.trim().replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    }
};

const AuthController = {
    initLogin: function () {
        if (Auth.isAuthenticated()) {
            if (Auth.hasProfile()) Router.navigate('/dashboard');
            else Router.navigate('/profile/edit');
            return;
        }
        const form = document.getElementById('login-form');
        if (!form) return;

        const q = (name) => form.querySelector(`[name="${name}"]`);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            const emailInput = q('email');
            const passwordInput = q('password');

            if (!emailInput || !emailInput.value) { UI.showError('email', 'Phone number or email is required', form); return; }
            if (!passwordInput || !passwordInput.value) { UI.showError('password', 'Password is required', form); return; }

            const payload = {
                email: emailInput.value,
                password: passwordInput.value
            };

            const res = await API.post('/login', payload);
            if (res && res.success) {
                Auth.setToken(res.data.token);
                if (res.data.user_id) localStorage.setItem('auth_user_id', res.data.user_id);
                Auth.setHasProfile(res.data.has_profile);
                Auth.setHasLevel(res.data.has_profile);

                // Initialize push notifications
                if (typeof PushNotificationsController !== 'undefined') {
                    PushNotificationsController.init();
                }

                if (res.data.has_profile) {
                    Router.navigate('/dashboard');
                } else {
                    Router.navigate('/terms');
                }
            } else {
                if (res && res.data && res.data.needs_verification) {
                    localStorage.setItem('verify_user_id', res.data.user_id);
                    Router.navigate('/verify');
                } else {
                    // Unified style: show backend error on the first field (email)
                    UI.showError('email', res ? res.message : 'Invalid email or password', form);
                }
            }
        });
    },

    initRegister: function () {
        if (Auth.isAuthenticated()) {
            if (Auth.hasProfile() && Auth.hasLevel()) Router.navigate('/dashboard');
            else Router.navigate('/terms');
            return;
        }
        const form = document.getElementById('register-form');
        if (!form) return;

        const q = (name) => form.querySelector(`[name="${name}"]`);

        // Check invite-only mode
        const inviteGroup = document.getElementById('reg-invite-group');
        let inviteOnlyActive = false;

        API.post('/invite/get_mode', {}).then(res => {
            if (res && res.success && res.data && res.data.invite_only_mode) {
                inviteOnlyActive = true;
                if (inviteGroup) {
                    inviteGroup.style.display = 'block';
                }
            }
        }).catch(err => {
            console.error('Error fetching invite-only mode status:', err);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Auth.clearAll();
            UI.clearErrors(form);

            const fnInput = q('first_name');
            const lnInput = q('last_name');
            const emailInput = q('email');
            const mobileInput = q('mobile');
            const passInput = q('password');
            const inviteInput = q('invite_code');

            if (!fnInput || !fnInput.value) { UI.showError('first_name', 'First name is required', form); return; }
            if (!lnInput || !lnInput.value) { UI.showError('last_name', 'Last name is required', form); return; }
            if (!emailInput || !emailInput.value || !emailInput.value.includes('@')) { UI.showError('email', 'Invalid email address', form); return; }

            const mobileVal = mobileInput ? mobileInput.value.trim() : '';
            const mobileRegex = /^01[0125][0-9]{8}$/;
            if (!mobileRegex.test(mobileVal)) {
                UI.showError('mobile', 'Enter a valid 11-digit Egyptian mobile (e.g. 01012345678)', form);
                return;
            }

            if (inviteOnlyActive) {
                if (!inviteInput || !inviteInput.value.trim()) {
                    UI.showError('invite_code', 'Invitation code is required', form);
                    return;
                }
            }

            if (!passInput || !passInput.value || passInput.value.length < 8) { UI.showError('password', 'Password must be at least 8 chars', form); return; }

            const payload = {
                first_name: Sanitizer.cleanName(fnInput.value),
                last_name: Sanitizer.cleanName(lnInput.value),
                mobile: mobileVal,
                email: emailInput.value.trim().toLowerCase(),
                password: passInput.value
            };

            if (inviteOnlyActive && inviteInput) {
                payload.invite_code = inviteInput.value.trim().toUpperCase();
            }

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Registering...';

            const res = await API.post('/register', payload);
            if (res && res.success) {
                localStorage.setItem('verify_user_id', res.data.user_id);
                console.log("TEST CODES:", res.data);
                Router.navigate('/verify');
            } else {
                const msg = (res && res.message) ? res.message.toLowerCase() : '';
                if (msg.includes('email')) UI.showError('email', res.message, form);
                else if (msg.includes('mobile')) UI.showError('mobile', res.message, form);
                else Toast.show(res ? res.message : 'Registration failed');

                btn.disabled = false;
                btn.innerText = 'Continue →';
            }
        });
    },

    initVerify: function () {
        const smsForm = document.getElementById('verify-sms-form');
        const continueBtn = document.getElementById('btn-complete-verify');
        const userId = localStorage.getItem('verify_user_id');

        let isEmailVerified = false;
        let isPhoneVerified = false;

        const updateUI = () => {
            const emailBadge = document.getElementById('email-status-badge');
            const smsBadge = document.getElementById('sms-status-badge');
            const emailMsg = document.getElementById('email-verified-msg');

            if (isEmailVerified && emailBadge) {
                emailBadge.innerText = 'Verified';
                emailBadge.className = 'badge badge-green';
                if (emailMsg) emailMsg.style.display = 'block';
            }
            if (isPhoneVerified && smsBadge) {
                smsBadge.innerText = 'Verified';
                smsBadge.className = 'badge badge-green';
                if (smsForm) {
                    smsForm.querySelector('button').disabled = true;
                    smsForm.querySelector('button').innerText = '✓ Verified';
                }
            }

            if (isEmailVerified && isPhoneVerified && continueBtn) {
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';

                // Auto-advance so they don't get stuck verifying again
                setTimeout(() => {
                    if (Auth.hasProfile() && Auth.hasLevel()) {
                        Router.navigate('/dashboard');
                    } else {
                        Router.navigate('/terms');
                    }
                }, 1500);
            }
        };

        const checkStatus = async () => {
            const res = await API.post('/check-verification', { user_id: userId });
            if (res && res.success) {
                isEmailVerified = !!res.data.email_verified;
                isPhoneVerified = !!res.data.phone_verified;
                if (res.data.token) {
                    Auth.setToken(res.data.token);
                }
                if (res.data.fully_verified || (isEmailVerified && isPhoneVerified)) {
                    Auth.setHasProfile(res.data.has_profile);
                    Auth.setHasLevel(res.data.has_profile);
                }
                updateUI();
            }
        };

        if (!userId) {
            if (Auth.isAuthenticated()) {
                if (Auth.hasProfile() && Auth.hasLevel()) Router.navigate('/dashboard');
                else Router.navigate('/profile/edit');
                return;
            }
            Router.navigate('/login'); return;
        }

        // Check status immediately and then every 3s
        checkStatus();
        const poll = setInterval(() => {
            if (isEmailVerified && isPhoneVerified) {
                clearInterval(poll);
                return;
            }
            // Only poll if the page is still the verify page
            if (!document.getElementById('verify-sms-form')) {
                clearInterval(poll);
                return;
            }
            checkStatus();
        }, 3000);

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                if (!continueBtn.disabled) {
                    Router.navigate('/terms');
                }
            });
        }

        if (smsForm) {
            smsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = smsForm.code.value;
                const res = await API.post('/verify-otp', { user_id: userId, code });
                if (res && res.success) {
                    isPhoneVerified = true;
                    if (res.data.token) {
                        Auth.setToken(res.data.token);
                    }
                    if (res.data.fully_verified) {
                        Auth.setHasProfile(res.data.has_profile);
                        Auth.setHasLevel(res.data.has_profile);
                    }
                    updateUI();
                } else {
                    Toast.show(res ? res.message : 'Invalid code');
                }
            });
        }

        const resendBtn = document.getElementById('resend-codes');
        if (resendBtn) {
            resendBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                resendBtn.style.opacity = '0.5';
                resendBtn.style.pointerEvents = 'none';
                const res = await API.post('/auth/resend-otp', { user_id: userId });
                if (res && res.success) {
                    Toast.show('Code resent to WhatsApp!');
                } else {
                    Toast.show(res ? res.message : 'Failed to resend code');
                }
                setTimeout(() => {
                    resendBtn.style.opacity = '1';
                    resendBtn.style.pointerEvents = 'auto';
                }, 30000); // 30s cooldown
            });
        }

        window._verifyState = {
            setEmailVerified: (val) => {
                isEmailVerified = val;
                updateUI();
            }
        };
    },

    handleEmailLink: async function () {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
            Toast.show('Invalid verification link.');
            Router.navigate('/login');
            return;
        }

        const res = await API.post('/verify-email-link', { token });
        if (res && res.success) {
            if (res.data.token) {
                Auth.setToken(res.data.token);
            }
            if (res.data.fully_verified) {
                Auth.setHasProfile(res.data.has_profile);
                Auth.setHasLevel(res.data.has_profile);
            }
            const badge = document.getElementById('email-status-badge');
            const msg = document.getElementById('email-verified-msg');
            if (badge) {
                badge.innerText = 'Verified';
                badge.className = 'badge badge-green';
            }
            if (msg) msg.style.display = 'block';

            if (window._verifyState) {
                window._verifyState.setEmailVerified(true);
            }

            Toast.show('Email verified successfully! Now please complete the WhatsApp step.', 'success');
        } else {
            Toast.show(res ? res.message : 'Verification link expired or invalid.');
            Router.navigate('/login');
        }
    },

    initTerms: function () {
        this._agreedOnce = false; // Reset confirmation state
        const btnText = document.getElementById('agree-btn-text');
        if (btnText) btnText.innerHTML = 'AGREE <span style="opacity:0.4; font-weight:300;">|</span> موافق';

        const agreeContainer = document.getElementById('terms-agree-container');
        if (agreeContainer && Auth.isAuthenticated() && !Auth.hasProfile()) {
            agreeContainer.style.display = 'block';
        }

        // Programmatic click binding to bypass DOMPurify sanitization
        const agreeBtn = btnText ? btnText.closest('button') : null;
        if (agreeBtn) {
            agreeBtn.onclick = () => this.agreeTerms();
        }
    },
    agreeTerms: function () {
        const title = document.getElementById('terms-agree-title');
        const btnText = document.getElementById('agree-btn-text');

        if (!this._agreedOnce) {
            this._agreedOnce = true;

            if (title) {
                // Animation: Bounce up and fade in
                title.style.opacity = '1';
                title.style.transform = 'translateY(0)';
            }

            if (btnText) {
                btnText.style.opacity = '0';
                setTimeout(() => {
                    btnText.innerHTML = 'YES <span style="opacity:0.4; font-weight:300;">|</span> أكيد';
                    btnText.style.opacity = '1';
                }, 200);
            }
            return;
        }

        sessionStorage.setItem('padeladd_agreed_terms', 'true');
        Router.navigate('/profile/edit');
    },

    initForgotPassword: function () {
        const form = document.getElementById('forgot-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { email: form.email.value };
            const res = await API.post('/forgot-password', payload);
            if (res && res.success) {
                Toast.show(res.message, 'success');
                if (res.data && res.data.test_reset_token) {
                    console.log('RESET TOKEN (DEV ONLY): ', res.data.test_reset_token);
                    // store for easy testing flow
                    localStorage.setItem('test_reset_token', res.data.test_reset_token);
                }
                Router.navigate('/login');
            } else {
                Toast.show(res && res.message ? res.message : 'Error processing request.');
            }
        });
    },

    initResetPassword: function () {
        const form = document.getElementById('reset-form');
        if (!form) return;

        // Auto-fill test token or URL token if available
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const testToken = localStorage.getItem('test_reset_token');

        if (urlToken && form.token) {
            form.token.value = urlToken;
        } else if (testToken && form.token) {
            form.token.value = testToken;
            localStorage.removeItem('test_reset_token');
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pt = form.password.value;
            const pc = form.password_confirm.value;
            if (pt !== pc) {
                Toast.show('Passwords do not match');
                return;
            }

            const payload = { token: form.token.value, new_password: pt };
            const res = await API.post('/reset-password', payload);
            Toast.show(res ? res.message : 'Error resetting password');
            if (res && res.success) {
                Router.navigate('/login');
            }
        });
    }
};

// -------------------------------------------------------
//  DASHBOARD CONTROLLER
// -------------------------------------------------------
const DashboardController = {
    _announcementsCache: null,
    _allMatches: [],
    _currentMatchTab: 'completed',
    _currentRankTab: 'male',
    _currentUser: null,
    _currentProfile: null,
    _cache: {}, // Stores user profile and recent matches
    _rankingCache: {}, // Stores dashboard-specific ranking lists
    _messages: [
        "Enter the Game.",
        "Next Round!",
        "Survive the Court.",
        "The Ladder is watching.",
        "Play to Rise.",
        "No Easy Matches.",
        "The Game Begins.",
        "Only One Rises.",
        "Ready to Compete?",
        "Prove Your Level.",
        "The Court Decides.",
        "Climb or disappear.",
        "Let the games begin."
    ],

    init: async function (isSilent = false) {
        if (!isSilent) {
            UI.syncNav();
            StoriesController.initTray();
            DashboardController.initInviteButton();
            // Restore announcements cache from localStorage if empty
            if (!DashboardController._announcementsCache) {
                try {
                    const savedAnn = localStorage.getItem('dash_announcements_cache');
                    if (savedAnn) DashboardController._announcementsCache = JSON.parse(savedAnn);
                } catch (e) { console.error('Announcements cache restore failed', e); }
            }
            DashboardController.loadAnnouncements();
        }

        // Use cache for instant render if available
        if (!isSilent && DashboardController._cache.profile) {
            // Restore ranking cache from localStorage if empty
            if (Object.keys(DashboardController._rankingCache).length === 0) {
                try {
                    const savedRanking = localStorage.getItem('dash_ranking_cache');
                    if (savedRanking) DashboardController._rankingCache = JSON.parse(savedRanking);
                } catch (e) { console.error('Ranking cache restore failed', e); }
            }
            DashboardController.applyData(DashboardController._cache.profile, DashboardController._cache.matches);
        }

        // Use Promise.all for initial data
        const [res, matchRes] = await Promise.all([
            API.post('/profile/get', { app_build_ref: CONFIG.APP_BUILD_REF }),
            API.post('/matches/recent', { limit: 10 })
        ]);

        if (!res || !res.success) {
            if (!res || res.message === 'Unauthorized') {
                Auth.clearAll();
                Router.navigate('/login');
            }
            return;
        }

        // Compare with cache
        const profileJson = JSON.stringify(res.data);
        const matchesJson = matchRes?.success ? JSON.stringify(matchRes.data.matches) : '';

        if (isSilent && DashboardController._cache.profile_json === profileJson && DashboardController._cache.matches_json === matchesJson) {
            return;
        }

        DashboardController._cache.profile = res.data;
        DashboardController._cache.profile_json = profileJson;
        if (matchRes?.success) {
            DashboardController._cache.matches = matchRes.data.matches;
            DashboardController._cache.matches_json = matchesJson;
        }

        DashboardController.applyData(res.data, matchRes?.success ? matchRes.data.matches : [], isSilent);

        // Start polling if this is the first load
        if (!isSilent && typeof PollManager !== 'undefined') {
            PollManager.start('dashboard', () => DashboardController.init(true), 10000);
        }
    },

    loadAnnouncements: async function () {
        const container = document.getElementById('announcements-carousel-container');
        const carousel = document.getElementById('announcements-carousel');
        const indicatorsContainer = document.getElementById('announcements-indicators');

        if (!container || !carousel) return;

        // Helper to preload images in background
        const preloadImages = (list) => {
            list.forEach(a => {
                const img = new Image();
                img.src = `${CONFIG.ASSET_BASE}/${a.image_url}`;
            });
        };

        const renderList = (list) => {
            container.style.display = 'block';

            // Render Carousel Cards with skeleton class and onload handler
            carousel.innerHTML = list.map(a => `
                <div class="announcement-card skeleton" onclick="Router.navigate('/announcement/${a.id}')">
                    <img src="${CONFIG.ASSET_BASE}/${a.image_url}" class="announcement-card-img" alt="${a.title}" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');">
                </div>
            `).join('');

            // Render Indicators if > 1 announcement
            if (list.length > 1) {
                indicatorsContainer.innerHTML = list.map((_, idx) => `
                    <span class="indicator ${idx === 0 ? 'active' : ''}" onclick="const c = document.getElementById('announcements-carousel'); c.scrollTo({ left: c.children[${idx}].offsetLeft, behavior: 'smooth' })"></span>
                `).join('');

                // Update indicator active class on scroll
                carousel.onscroll = () => {
                    const width = carousel.offsetWidth;
                    const scrollPos = carousel.scrollLeft;
                    const indicators = indicatorsContainer.querySelectorAll('.indicator');

                    // Find closest card to active scroll position
                    let activeIndex = 0;
                    let minDiff = Infinity;
                    for (let i = 0; i < carousel.children.length; i++) {
                        const diff = Math.abs(carousel.children[i].offsetLeft - scrollPos);
                        if (diff < minDiff) {
                            minDiff = diff;
                            activeIndex = i;
                        }
                    }

                    indicators.forEach((ind, idx) => {
                        if (idx === activeIndex) {
                            ind.classList.add('active');
                        } else {
                            ind.classList.remove('active');
                        }
                    });
                };
            } else {
                indicatorsContainer.innerHTML = '';
            }
        };

        // If we have cached announcements, render them instantly
        if (DashboardController._announcementsCache) {
            preloadImages(DashboardController._announcementsCache);
            renderList(DashboardController._announcementsCache);
            // Fetch in background silently to update the cache
            API.post('/announcements/list').then(res => {
                if (res && res.success && res.data && res.data.announcements) {
                    DashboardController._announcementsCache = res.data.announcements;
                    localStorage.setItem('dash_announcements_cache', JSON.stringify(res.data.announcements));
                    preloadImages(res.data.announcements);
                }
            }).catch(e => console.error('Silent announcements reload failed:', e));
            return;
        }

        try {
            const res = await API.post('/announcements/list');
            if (res && res.success && res.data && res.data.announcements && res.data.announcements.length > 0) {
                DashboardController._announcementsCache = res.data.announcements;
                localStorage.setItem('dash_announcements_cache', JSON.stringify(res.data.announcements));
                preloadImages(DashboardController._announcementsCache);
                renderList(DashboardController._announcementsCache);
            } else {
                container.style.display = 'none';
                localStorage.removeItem('dash_announcements_cache');
            }
        } catch (e) {
            console.error('Failed to load announcements:', e);
            container.style.display = 'none';
        }
    },

    applyData: function (profileData, matchData, isSilent = false) {
        const { user, profile, stats } = profileData;
        DashboardController._currentUser = user;
        DashboardController._currentProfile = profile;

        if (user && user.id) {
            localStorage.setItem('auth_user_id', user.id);
        }

        // Default ranking tab to user's gender or saved preference
        const savedRankGender = sessionStorage.getItem('ranking_gender');
        if (savedRankGender) {
            DashboardController._currentRankTab = savedRankGender;
        } else if (profile && profile.gender) {
            DashboardController._currentRankTab = profile.gender;
        }

        const currentGender = DashboardController._currentRankTab;

        // Update UI buttons in dashboard
        const males = document.getElementById('tab-males');
        const females = document.getElementById('tab-females');
        if (males && females) {
            males.style.borderBottomColor = currentGender === 'male' ? 'var(--c-primary)' : 'transparent';
            males.style.color = currentGender === 'male' ? 'var(--c-text)' : 'var(--c-text-muted)';
            females.style.borderBottomColor = currentGender === 'female' ? '#D81B60' : 'transparent';
            females.style.color = currentGender === 'female' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }

        if (matchData) {
            DashboardController._allMatches = matchData;
        }

        // Welcome name
        const nameEl = document.getElementById('dash-name');
        if (nameEl) nameEl.textContent = profile?.player_code || user.first_name;

        // Stats
        StatsUI.update(stats, 'dash');

        DashboardController.renderMatches();
        DashboardController.renderRanking(isSilent);

        // Random subtitle if not silent (initial load) and not already set
        const subEl = document.getElementById('dash-subtitle');
        if (subEl && !isSilent && !subEl.textContent.trim()) {
            const msg = DashboardController._messages[Math.floor(Math.random() * DashboardController._messages.length)];
            subEl.textContent = msg;
        }
    },

    switchRankTab: function (gender) {
        DashboardController._currentRankTab = gender;
        sessionStorage.setItem('ranking_gender', gender);
        const males = document.getElementById('tab-males');
        const females = document.getElementById('tab-females');
        if (males) {
            males.style.borderBottomColor = gender === 'male' ? 'var(--c-primary)' : 'transparent';
            males.style.color = gender === 'male' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        if (females) {
            females.style.borderBottomColor = gender === 'female' ? '#D81B60' : 'transparent';
            females.style.color = gender === 'female' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        DashboardController.renderRanking();
    },

    switchMatchTab: function (tab) {
        DashboardController._currentMatchTab = tab;
        const comp = document.getElementById('tab-completed');
        const upco = document.getElementById('tab-upcoming');
        if (comp) {
            comp.style.borderBottomColor = tab === 'completed' ? 'var(--c-primary)' : 'transparent';
            comp.style.color = tab === 'completed' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        DashboardController.renderMatches();
    },

    renderMatches: function () {
        const listEl = document.getElementById('dash-matches-list');
        if (!listEl) return;
        const filtered = DashboardController._allMatches.filter(m => m.status === DashboardController._currentMatchTab);
        if (filtered.length === 0) {
            listEl.innerHTML = safeHTML(`<div class="empty-state"><div class="empty-icon">🎾</div><h3>No ${DashboardController._currentMatchTab} matches</h3><p>Your matches will appear here.</p></div>`);
            return;
        }
        const uid = DashboardController._currentUser?.id;

        let html = '';
        if (DashboardController._currentMatchTab === 'completed') {
            // Flatten all scores from all completed matches into a single list of cards
            const allScoreCards = [];
            filtered.forEach(m => {
                if (m.scores && m.scores.length > 0) {
                    m.scores.forEach(s => {
                        allScoreCards.push(DashboardController.renderMatchCard(m, uid, s));
                    });
                } else {
                    allScoreCards.push(DashboardController.renderMatchCard(m, uid));
                }
            });
            // Show only the latest 4 scores
            html = allScoreCards.slice(0, 4).join('');
        } else {
            // For upcoming, show everything
            filtered.forEach(m => {
                html += DashboardController.renderMatchCard(m, uid);
            });
        }

        // Prevent flicker: only update DOM if HTML changed
        if (listEl._lastHtml === html) return;
        listEl.innerHTML = safeHTML(html);
        listEl._lastHtml = html;
    },

    renderMatchCard: function (m, userId, specificScore = null) {
        if (m.status === 'completed' && (specificScore || (m.scores && m.scores.length > 0))) {
            const scoreToRender = specificScore || m.scores[0];
            const allPlayers = [...(m.team_a || []), ...(m.team_b || [])];
            const scoreHtml = ScoreUI.renderMatchScore(m, scoreToRender, allPlayers, false);

            const dateObj = new Date(m.scheduled_at.replace(' ', 'T'));
            const dayStr = UI.formatMatchDateOnly(m.scheduled_at);
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');

            let matchTypeBadge = '';
            if (m.match_type === 'competition') {
                matchTypeBadge = `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(255,165,0,0.1); color:var(--c-orange); padding:2px 6px; border-radius:4px; margin-right:4px;">🏆 Competition</span>`;
            } else if (m.match_type === 'friendly') {
                matchTypeBadge = `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(27, 82, 206, 0.15); color:#5A91FF; padding:2px 6px; border-radius:4px; margin-right:4px;">🤝 Friendly</span>`;
            }

            const dashHeader = `
                <div style="font-size:10px; font-weight:800; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding:0 20px; display:flex; justify-content:space-between; align-items:center;">
                    <span>${dayStr}</span>
                    <div style="text-transform:none;">${matchTypeBadge}</div>
                </div>
            `;

            return `
                <div onclick="Router.navigate('/matches/${m.match_code}')" class="dash-match-card" style="cursor:pointer; background:var(--c-bg-card); border-radius:var(--r-lg); padding:10px 0; margin-bottom:29px; transition:var(--t-fast);">
                    ${dashHeader}
                    ${scoreHtml}
                </div>
            `;
        }

        const userTeam = m.user_team;
        const dateObj = m.scheduled_at ? new Date(m.scheduled_at.replace(' ', 'T')) : null;
        const dateStr = dateObj
            ? `${UI.formatMatchDateOnly(m.scheduled_at)} · ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : 'TBD';

        const renderTeamRow = (players) => {
            const p1 = players[0] || { name: '—' };
            const p2 = players[1] || { name: '—' };
            return `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-size:13px; font-weight:700;">${p1.name}</div>
                    <div style="font-size:13px; font-weight:700;">${p2.name}</div>
                </div>
            `;
        };

        return `
        <div onclick="Router.navigate('/matches/${m.match_code}')" style="background:var(--c-bg-card); border-radius:var(--r-lg); padding:16px; margin-bottom:12px; cursor:pointer; transition:all 0.2s;">
            <div style="font-size:11px; color:var(--c-text-muted); font-weight:600; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">${m.venue || 'Venue TBD'} · ${dateStr}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:16px; align-items:center;">
                    ${renderTeamRow(m.team_a)}
                    <div class="match-vs-badge" data-no-sound style="width:14px; height:14px; min-width:14px;" onclick="event.stopPropagation(); FX.ignite(this)">
                        <div class="vs-fire-fx"></div>
                        <img src="assets/vs.svg" style="width:14px; height:14px; opacity:0.6;" alt="VS">
                    </div>
                    ${renderTeamRow(m.team_b)}
                </div>
                <div class="status-badge" style="font-size:10px;">${m.status.toUpperCase()}</div>
            </div>
        </div>`;
    },

    renderRanking: async function (isSilent = false) {
        const listEl = document.getElementById('dash-ranking-list');
        if (!listEl) return;

        // Use current tab gender
        const gender = DashboardController._currentRankTab || 'male';

        // Check cache for instant render
        const cached = DashboardController._rankingCache[gender];
        const cachedJson = DashboardController._rankingCache[gender + '_json'];

        if (cached) {
            // Only render if list is empty or gender changed to avoid flickering avatars
            const currentRenderedGender = listEl.getAttribute('data-rendered-gender');
            if (listEl.innerHTML.trim() === '' || currentRenderedGender !== gender) {
                DashboardController._renderRankingList(cached);
            }
        } else if (!isSilent && listEl.innerHTML.trim() === '') {
            listEl.innerHTML = RankingUI.renderSkeleton(5);
        }

        const res = await API.post('/ranking/list', { gender: gender, limit: 10 });
        if (!res || !res.success) {
            if (!cached) {
                listEl.innerHTML = safeHTML(`<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">⚠️</div><h3>Unable to load ranking</h3></div>`);
            }
            return;
        }

        const ranking = res.data.ranking;
        const rankingJson = JSON.stringify(ranking);

        // Prevent redundant render if data hasn't changed
        if (cachedJson === rankingJson) return;

        // Update cache and render
        DashboardController._rankingCache[gender] = ranking;
        DashboardController._rankingCache[gender + '_json'] = rankingJson;

        // Persist to localStorage for next app load
        try {
            localStorage.setItem('dash_ranking_cache', JSON.stringify(DashboardController._rankingCache));
        } catch (e) { }

        DashboardController._renderRankingList(ranking);
    },

    _renderRankingList: function (ranking) {
        const listEl = document.getElementById('dash-ranking-list');
        if (!listEl) return;

        if (ranking.length === 0) {
            listEl.innerHTML = safeHTML(`<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">🏅</div><h3>No rankings yet</h3><p>Rankings will appear after the first matches are recorded.</p></div>`);
            return;
        }

        let html = '';
        ranking.forEach((r, idx) => {
            const isLast = idx === ranking.length - 1;
            const trend = r.points_this_week;
            const trendHtml = trend > 0 ? `<span style="color:var(--c-green);">+${trend}</span>` : (trend < 0 ? `<span style="color:var(--c-red);">${trend}</span>` : `<span style="color:var(--c-text-dim);">0</span>`);

            const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || (r.nickname?.[0] || '?').toUpperCase();
            const thumb = r.profile_image_thumb || r.profile_image;
            const hasStory = !!r.has_active_story;
            const extraAttr = hasStory ? `onclick="event.stopPropagation(); StoriesController.playUserStories(${r.user_id})"` : '';
            const avatarHtml = UI.getAvatarHtml(thumb, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', `width:32px; height:32px; border-radius:50%; flex-shrink:0; border:1px solid var(--c-border);`, initials, hasStory ? 'story-ring' : '', extraAttr);

            let rankHtml = `<span style="font-weight:800; color:#fff; font-size:15px;">${r.rank}</span>`;
            if (r.rank === 1) {
                rankHtml = `<img src="assets/icons/rank/rank1.png" style="width:42px; height:42px; object-fit:contain;" alt="Gold Medal">`;
            } else if (r.rank === 2) {
                rankHtml = `<img src="assets/icons/rank/rank2.png" style="width:42px; height:42px; object-fit:contain;" alt="Silver Medal">`;
            } else if (r.rank === 3) {
                rankHtml = `<img src="assets/icons/rank/rank3.png" style="width:42px; height:42px; object-fit:contain;" alt="Bronze Medal">`;
            }

            html += `
                <div onclick="Router.navigate('/profile/view/${r.player_code}')" class="rank-grid-dash" style="padding:12px 10px 12px 8px; align-items:center; transition:all 0.2s; cursor:pointer; border-bottom: ${isLast ? 'none' : '1px solid rgba(255,255,255,0.05)'};" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    <div style="display:flex; justify-content:center; align-items:center;">${rankHtml}</div>
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        ${avatarHtml}
                        <div style="min-width:0; overflow:hidden;">
                            <div class="text-truncate" style="font-size:14px; font-weight:700; max-width: 140px;">${r.nickname}</div>
                            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:4px; color:var(--c-text-muted); font-family:monospace; font-weight:700; text-transform:uppercase;">${r.player_code}</span>
                                <span style="font-size:10px; color:var(--c-text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.first_name} ${r.last_name}</span>
                            </div>
                        </div>
                    </div>
                    <span class="hide-mobile" style="text-align:center; font-size:13px; font-weight:600; color:var(--c-text-muted);">${r.age || '—'}</span>
                    <span style="text-align:right; font-size:14px; font-weight:800; color:#fff;">${r.points}</span>
                    <span class="hide-mobile" style="text-align:right; font-size:12px; font-weight:700;">${trendHtml}</span>
                </div>
            `;
        });
        // Only update innerHTML if it's different to prevent image flickering/re-fading
        if (listEl._lastHtml === html) return;
        listEl.innerHTML = safeHTML(html);
        listEl._lastHtml = html;
        listEl.setAttribute('data-rendered-gender', DashboardController._currentRankTab || 'male');
    },

    reportProblem: async function () {
        const reason = await ConfirmModal.show({
            title: 'Report a Problem',
            message: '<b>Common reasons:</b>\n• Technical issue\n• Bug report\n• Feature request',
            showInput: true,
            inputPlaceholder: 'Type your message here...',
            inputMaxLength: 300,
            tipText: 'Help us improve by being specific.',
            confirmText: 'Submit Report',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/system/report', { reason });
        if (res && res.success) {
            Toast.show(res.message, 'success');
        } else {
            Toast.show(res ? res.message : 'Report failed', 'error');
        }
    },

    initInviteButton: async function () {
        const row = document.getElementById('dash-invite-row');
        const btn = document.getElementById('btn-dash-invite');
        if (!row || !btn) return;

        try {
            let res = window._cachedInvitesRes;
            if (!res) {
                res = await API.post('/invite/get_invites', {});
                window._cachedInvitesRes = res;
            }
            if (res && res.success && res.data) {
                if (!res.data.invite_only_mode) {
                    row.style.display = 'none';
                    return;
                }
                const invites = res.data.keys || [];
                const unusedCount = invites.filter(inv => !inv.used_at).length;
                btn.innerHTML = `<span>Share Exclusive Invites</span><span style="color:var(--c-orange); display:flex; align-items:center; gap:6px;">(${unusedCount} Left) <span style="font-size:16px;">🎟️</span></span>`;
                row.style.display = 'flex';
                btn.onclick = () => {
                    InviteModal.show(invites, (updatedInvites) => {
                        res.data.keys = updatedInvites;
                        const newUnused = updatedInvites.filter(inv => !inv.used_at).length;
                        btn.innerHTML = `<span>Share Exclusive Invites</span><span style="color:var(--c-orange); display:flex; align-items:center; gap:6px;">(${newUnused} Left) <span style="font-size:16px;">🎟️</span></span>`;
                    });
                };
            }
        } catch (e) {
            console.error('Error loading invites on dashboard:', e);
        }
    }
};



// -------------------------------------------------------
//  PROFILE VIEW CONTROLLER
// -------------------------------------------------------
const ProfileViewController = {
    _viewCache: {},
    _limit: 20,
    _offset: 0,
    _hasMore: true,
    _isLoading: false,
    _targetUserId: null,
    _cacheMatches: [],
    _lastRequestId: 0,
    init: async function (params, isSilent = false, reqId = null) {
        // Guard: All profile views require authentication
        if (!Auth.isAuthenticated()) {
            Router.navigate('/login');
            return;
        }

        if (!isSilent) {
            UI.syncNav();
            // Instantly hide the full-screen spinner so the layout structure, details, 
            // and match skeleton placeholders render dynamically on page load.
            const loader = document.getElementById('global-loader');
            if (loader) loader.style.display = 'none';
        }

        // Determine currentReqId based on whether the call is silent or has an explicit reqId
        const currentReqId = reqId || (isSilent ? ProfileViewController._lastRequestId : ++ProfileViewController._lastRequestId);

        // ID could be user_id (numeric) or player_code (string)
        const payload = {};
        if (params && params.id) {
            if (/^\d+$/.test(params.id)) payload.target_id = params.id;
            else payload.player_code = params.id;
        }

        const cacheKey = params && params.id ? params.id : 'self';
        const hasCache = ProfileViewController._viewCache[cacheKey];

        let res;

        if (!isSilent && hasCache) {
            // Render instantly from cache
            res = { success: true, data: hasCache };

            // Trigger silent background fetch for SWR
            setTimeout(() => {
                ProfileViewController.init(params, true, currentReqId);
            }, 10);
        } else {
            // Full network load
            res = await API.post('/profile/get', payload);
            if (currentReqId !== ProfileViewController._lastRequestId) return;
            if (res && res.success && res.data) {
                ProfileViewController._viewCache[cacheKey] = res.data;
            }
        }
        if (!res || !res.success) {
            if (currentReqId !== ProfileViewController._lastRequestId) return;
            const pageEl = document.querySelector('.page.active');
            if (pageEl) {
                pageEl.innerHTML = safeHTML(`
                    <div style="width:100%; max-width:500px; margin:0 auto; padding:90px 20px 40px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        <div style="font-size:64px; margin-bottom:20px;">🎾🔎</div>
                        <h1 style="font-size:32px; font-weight:800; color:#fff; margin-bottom:12px;">Player Not Found</h1>
                        <p style="color:var(--c-text-muted); font-size:16px; margin-bottom:32px;">The player XCode you are looking for does not exist or has been removed.</p>
                        <button onclick="Router.navigate(Auth.isAuthenticated() ? '/dashboard' : '/')" class="btn btn-primary" style="width:auto; padding:14px 40px;">
                            ${Auth.isAuthenticated() ? 'Return to Dashboard' : 'Go to Homepage'}
                        </button>
                        ${Auth.isAuthenticated() ? `
                            <div style="margin-top:40px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05); width:100%;">
                                <p style="color:var(--c-text-dim); font-size:14px; margin-bottom:12px;">Not you? Or having issues?</p>
                                <button onclick="API.post('/logout', {}).then(() => { Auth.clearAll(); Router.navigate('/login'); })" style="background:transparent; border:none; color:var(--c-orange); font-size:14px; font-weight:700; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">Sign Out</button>
                            </div>
                        ` : ''}
                    </div>
                `);
            }
            return;
        }
        if (currentReqId !== ProfileViewController._lastRequestId) return;
        // Normalize data: 'res' might be the full response {success, data} or just the data from cache
        const profileData = res.data || res;
        const { user, profile, stats, is_self, is_following, has_active_story, followers_count, following_count } = profileData;
        ProfileViewController._targetUserId = user.id;

        // Compare new profile data with the cache to prevent redundant details rendering
        const hasProfileChanged = !isSilent || !hasCache || JSON.stringify(hasCache) !== JSON.stringify(profileData);

        if (hasProfileChanged) {
            // Avatar with Story Ring
            const av = document.getElementById('prof-avatar');
            const ring = document.getElementById('prof-ring');
            const avWrap = document.getElementById('prof-avatar-wrap');

            if (av) {
                const thumb = profile.profile_image_thumb || profile.profile_image;
                const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || (user.nickname?.[0] || '?').toUpperCase();

                if (has_active_story) {
                    if (ring) ring.style.display = 'block';
                    if (avWrap) avWrap.onclick = () => StoriesController.playUserStories(user.id);
                } else {
                    if (ring) ring.style.display = 'none';
                    if (avWrap) avWrap.onclick = null;
                }

                if (profile && thumb) {
                    av.innerHTML = safeHTML(UI.getAvatarHtml(thumb, 'width:100%; height:100%; border-radius:43%; object-fit:cover;', 'width:100%; height:100%; border-radius:43%;', initials) + (isSilent ? '' : '<div class="avatar-scan-overlay"></div>'));
                    av.classList.remove('avatar-placeholder');
                    av.style.background = 'none';
                } else {
                    av.innerHTML = safeHTML(UI.getAvatarHtml(null, '', 'width:100%; height:100%; border-radius:43%;', initials) + (isSilent ? '' : '<div class="avatar-scan-overlay"></div>'));
                    av.classList.add('avatar-placeholder');
                    av.style.background = has_active_story ? 'none' : 'var(--g-primary)';
                }
            }

            const actionsRow = document.querySelector('.prof-actions-row');
            if (actionsRow) {
                if (is_self) {
                    actionsRow.style.display = 'none';
                } else {
                    actionsRow.style.display = 'flex';

                    const followContainer = document.getElementById('prof-follow-container');
                    if (followContainer) {
                        followContainer.style.display = 'block';
                        const followBtn = document.getElementById('prof-follow-btn');
                        if (followBtn) {
                            followBtn.style.height = '32px';
                            followBtn.style.fontSize = '11px';
                            followBtn.style.fontWeight = '700';
                            followBtn.style.textTransform = 'uppercase';
                            followBtn.style.letterSpacing = '0.5px';
                            followBtn.style.background = is_following ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #0055FF, #0033BB)';
                            followBtn.style.borderColor = is_following ? 'rgba(255,255,255,0.1)' : '#0044CC';
                            followBtn.style.color = is_following ? 'var(--c-text-muted)' : '#fff';
                            followBtn.querySelector('.follow-text').style.display = 'block';
                            followBtn.querySelector('.follow-text').textContent = is_following ? 'Unfollow' : 'Follow';
                            followBtn.querySelector('.follow-icon').style.display = 'none';
                            followBtn.onclick = () => ProfileViewController.toggleFollow();
                        }
                    }

                    const reportContainer = document.getElementById('prof-report-container');
                    if (reportContainer) {
                        reportContainer.style.display = 'block';
                    }
                }
            }

            // Action cards visibility (only for self)
            const actionCards = document.getElementById('prof-action-cards');
            if (actionCards) {
                actionCards.style.display = is_self ? 'flex' : 'none';
            }

            // Invite button visibility (only for self)
            const inviteRow = document.getElementById('prof-invite-row');
            if (inviteRow) {
                if (is_self) {
                    ProfileViewController.initInviteButton();
                } else {
                    inviteRow.style.display = 'none';
                }
            }

            // Report player button (only for others)
            const reportContainer = document.getElementById('prof-report-container');
            if (reportContainer) {
                if (!is_self) {
                    reportContainer.style.display = 'block';
                    const reportBtn = document.getElementById('prof-report-btn');
                    if (reportBtn) {
                        reportBtn.onclick = () => ProfileController.reportPlayer(user.id);
                    }
                } else {
                    reportContainer.style.display = 'none';
                }
            }

            // Names (Nickname + Full Name)
            const nickEl = document.getElementById('prof-nickname');
            if (nickEl) nickEl.textContent = profile?.nickname || user.first_name;

            const fullEl = document.getElementById('prof-fullname');
            if (fullEl) {
                if (profile?.nickname) {
                    fullEl.textContent = user.first_name + ' ' + user.last_name;
                    fullEl.style.display = 'block';
                } else {
                    fullEl.style.display = 'none';
                }
            }

            // Player code
            const codeEl = document.getElementById('prof-code');
            if (codeEl) {
                if (profile?.player_code) {
                    codeEl.innerHTML = safeHTML(`
                        <div style="background: linear-gradient(135deg, #8E2DE2, #4A00E0); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">XCODE</div>
                        <span style="color:var(--c-orange); font-weight:800; font-family: 'Montserrat', monospace; letter-spacing: 1px; padding: 0 8px;">${profile.player_code}</span>
                    `);
                    codeEl.onclick = () => {
                        navigator.clipboard.writeText(profile.player_code).then(() => {
                            Toast.show('Player code copied to clipboard!', 'success');
                        }).catch(e => {
                            console.error('Copy failed', e);
                            Toast.show('Failed to copy player code');
                        });
                    };
                    codeEl.style.display = 'inline-flex';
                } else {
                    codeEl.style.display = 'none';
                }
            }

            // Followers Counts
            const followersCountsEl = document.getElementById('prof-followers-counts');
            if (followersCountsEl) {
                if (profile?.player_code) {
                    followersCountsEl.style.display = 'flex';
                    document.getElementById('prof-followers-num').textContent = followers_count || 0;
                    document.getElementById('prof-following-num').textContent = following_count || 0;

                    const followersBtn = document.getElementById('prof-followers-btn');
                    const followingBtn = document.getElementById('prof-following-btn');

                    if (is_self) {
                        followersBtn.style.cursor = 'pointer';
                        followingBtn.style.cursor = 'pointer';
                        followersBtn.onclick = () => ProfileViewController.showFollowsList('followers');
                        followingBtn.onclick = () => ProfileViewController.showFollowsList('following');
                    } else {
                        followersBtn.style.cursor = 'default';
                        followingBtn.style.cursor = 'default';
                        followersBtn.onclick = null;
                        followingBtn.onclick = null;
                    }
                } else {
                    followersCountsEl.style.display = 'none';
                }
            }

            // Meta pills (location, hand)
            const metaEl = document.getElementById('prof-meta');
            if (metaEl) {
                const items = [];
                const metaStyle = `display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.02); padding:4px 12px 4px 4px; border-radius:30px; border:1px solid rgba(255,255,255,0.05);`;
                const iconCircle = `width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);`;
                const labelStyle = `font-size:9px; font-weight:800; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:0.8px;`;

                if (profile?.location) {
                    items.push(`
                        <div style="${metaStyle}">
                            <div style="${iconCircle}">📍</div>
                            <span style="${labelStyle}">${profile.location}</span>
                        </div>
                    `);
                }
                if (profile?.playing_side) {
                    const label = profile.playing_side === 'flexible' ? 'Flexible' : profile.playing_side + ' side';
                    items.push(`
                        <div style="${metaStyle}">
                            <div style="${iconCircle}">🎾</div>
                            <span style="${labelStyle}">${label}</span>
                        </div>
                    `);
                }
                if (profile?.age) {
                    const isFemale = (profile?.gender || '').toLowerCase() === 'female';
                    items.push(`
                        <div style="${metaStyle} ${isFemale ? 'display: none !important;' : ''}">
                            <div style="${iconCircle}">🎂</div>
                            <span style="${labelStyle}">Age ${profile.age}</span>
                        </div>
                    `);
                }
                metaEl.innerHTML = items.join('');
                metaEl.style.gap = '8px';
            }

            // Bio
            const bioEl = document.getElementById('prof-bio');
            if (bioEl && profile?.bio) {
                bioEl.textContent = profile.bio;
                bioEl.style.display = 'block';
            }

            // Level badge update
            const levelBadge = document.getElementById('prof-level-badge');
            if (levelBadge && stats) {
                const pts = stats.points ?? 0;
                const buf = stats.current_buffer ?? 0;
                const calculatedLevel = ((pts + buf) / 100).toFixed(1);
                levelBadge.textContent = calculatedLevel;
                levelBadge.style.display = 'flex';
            }

            // Stats cards
            StatsUI.update(stats, 'pv');

            // Update achievements empty msg based on context
            const achMsg = document.getElementById('prof-achievements-empty-msg');
            if (achMsg) {
                achMsg.textContent = is_self ? 'Complete matches to earn trophies and special badges!' : 'This player hasn\'t earned any trophies yet.';
            }

            // Final reveal for the profile header and stats
            const contentEl = document.getElementById('prof-view-content');
            if (contentEl) contentEl.style.opacity = '1';
        }

        // Load matches list asynchronously so it doesn't block the instant navigation
        if (!isSilent) {
            ProfileViewController._limit = 20;
            ProfileViewController._offset = 0;
            ProfileViewController._hasMore = true;
            ProfileViewController._isLoading = false;
            ProfileViewController._cacheMatches = [];
            window.removeEventListener('scroll', ProfileViewController.handleScroll);
            window.addEventListener('scroll', ProfileViewController.handleScroll);

            const listEl = document.getElementById('pv-matches-list');
            if (listEl && listEl.innerHTML.trim() === '') {
                listEl.innerHTML = ScoreUI.renderSkeleton(2);
                listEl._lastHtml = ''; // Clear to force-render on initial data arrival
            }

            // Wait to showcase placeholder loaders for matches
            await new Promise(r => setTimeout(r, CONFIG.SKELETON_DELAY));
        }

        if (currentReqId !== ProfileViewController._lastRequestId) return;

        await ProfileViewController.loadMatches(isSilent, false, currentReqId);
    },

    loadMatches: async function (isSilent = false, isLoadMore = false, reqId = null) {
        const currentReqId = reqId || ProfileViewController._lastRequestId;
        if (currentReqId !== ProfileViewController._lastRequestId) return;
        if (ProfileViewController._isLoading) return;
        if (isLoadMore && !ProfileViewController._hasMore) return;

        if (isLoadMore) {
            ProfileViewController._isLoading = true;
            const listEl = document.getElementById('pv-matches-list');
            if (listEl && !listEl.querySelector('.pagination-loader')) {
                listEl.insertAdjacentHTML('beforeend', `<div class="pagination-loader"><div class="pagination-spinner"></div></div>`);
            }
        }

        const currentLength = ProfileViewController._cacheMatches ? ProfileViewController._cacheMatches.length : 0;
        const matchPayload = {
            target_id: ProfileViewController._targetUserId,
            limit: isSilent ? Math.max(20, currentLength) : (isLoadMore ? ProfileViewController._limit : 20),
            offset: isLoadMore ? ProfileViewController._offset : 0,
            status: 'completed'
        };

        const matchRes = await API.post('/matches/user', matchPayload);
        if (currentReqId !== ProfileViewController._lastRequestId) return;
        ProfileViewController._isLoading = false;

        const listEl = document.getElementById('pv-matches-list');
        if (!listEl) return;

        const newMatches = matchRes?.data?.matches || [];
        ProfileViewController._hasMore = matchRes?.data?.has_more || false;

        if (isLoadMore) {
            // Remove pagination loading indicator
            const loader = listEl.querySelector('.pagination-loader');
            if (loader) loader.remove();

            const existingIds = new Set(ProfileViewController._cacheMatches.map(m => m.id));
            const uniqueNewMatches = newMatches.filter(m => !existingIds.has(m.id));
            ProfileViewController._cacheMatches = [...ProfileViewController._cacheMatches, ...uniqueNewMatches];
            ProfileViewController._offset += newMatches.length;
        } else if (isSilent) {
            const existing = ProfileViewController._cacheMatches || [];
            if (JSON.stringify(existing) !== JSON.stringify(newMatches)) {
                ProfileViewController._cacheMatches = newMatches;
                ProfileViewController._offset = newMatches.length;
            } else {
                return;
            }
        } else {
            ProfileViewController._cacheMatches = newMatches;
            ProfileViewController._offset = newMatches.length;
        }

        // Render completed history matches only
        const historyMatches = ProfileViewController._cacheMatches.filter(m => m.status === 'completed');

        let finalHtml = '';
        if (historyMatches.length === 0) {
            const isSelf = ProfileViewController._targetUserId === Auth.getUserId();
            const emptySub = isSelf ? 'Complete matches to see them in history.' : 'This player hasn\'t completed any matches yet.';
            finalHtml = `<div class='empty-state' style='padding:60px 0;'><div class='empty-icon'>🎾</div><h3>No match results yet</h3><p>${emptySub}</p></div>`;
        } else {
            let html = '';
            for (const m of historyMatches) {
                if (m.scores && m.scores.length > 0) {
                    for (const s of m.scores) {
                        html += DashboardController.renderMatchCard(m, ProfileViewController._targetUserId, s);
                    }
                } else {
                    html += DashboardController.renderMatchCard(m, ProfileViewController._targetUserId);
                }
            }
            finalHtml = html;
        }

        // Append pagination spinner at the bottom if there are more matches
        if (ProfileViewController._hasMore) {
            finalHtml += `<div class="pagination-loader"><div class="pagination-spinner"></div></div>`;
        }

        // Smart rendering check to completely eliminate visual flickering
        if (listEl._lastHtml !== finalHtml) {
            listEl.innerHTML = safeHTML(finalHtml);
            listEl._lastHtml = finalHtml;
        }

        // Restore scroll position for profile views after dynamic scores render (only if popstate/back navigation)
        const savedScroll = sessionStorage.getItem('profile_scroll_pos');
        const isBackNav = sessionStorage.getItem('is_back_navigation') === 'true';

        // Always clean up flags so they don't leak into subsequent forward navigations
        sessionStorage.removeItem('profile_scroll_pos');
        sessionStorage.removeItem('is_back_navigation');

        if (savedScroll !== null && isBackNav) {
            requestAnimationFrame(() => {
                window.scrollTo(0, parseInt(savedScroll));
            });
        }
    },

    handleScroll: function () {
        const listEl = document.getElementById('pv-matches-list');
        if (!listEl) {
            window.removeEventListener('scroll', ProfileViewController.handleScroll);
            return;
        }

        const clientHeight = document.documentElement.clientHeight;
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        // If we are within 300px of the bottom, load the next page of matches
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            ProfileViewController.loadMatches(true, true);
        }
    },

    toggleFollow: async function () {
        // Try to get target ID from Router params, but fallback to 'self'
        const cacheKey = Router.params && Router.params.id ? Router.params.id : 'self';
        const cached = ProfileViewController._viewCache[cacheKey];

        // Safety: If we don't have cached data, we can't perform the action
        if (!cached || !cached.user) {
            console.error('Follow action failed: No cached user data for', cacheKey);
            return;
        }

        const targetUserId = cached.user.id;
        const btn = document.getElementById('prof-follow-btn');
        if (btn) btn.disabled = true;

        const activeReqId = ProfileViewController._lastRequestId;
        const res = await API.post('/profile/follow', { target_user_id: targetUserId });
        if (res && res.success) {
            if (activeReqId !== ProfileViewController._lastRequestId) return;
            // Update cache
            cached.is_following = res.data.is_following;
            // Refresh view silently
            ProfileViewController.init(Router.params, true, activeReqId);
        } else {
            Toast.show(res ? res.message : 'Action failed');
        }
        if (btn) btn.disabled = false;
    },

    toggleFollowInList: async function (targetUserId, btn) {
        if (btn) btn.disabled = true;
        const activeReqId = ProfileViewController._lastRequestId;
        const res = await API.post('/profile/follow', { target_user_id: targetUserId });
        if (res && res.success) {
            if (activeReqId !== ProfileViewController._lastRequestId) return;
            const isFollowing = res.data.is_following;
            if (isFollowing) {
                btn.textContent = 'Following';
                btn.style.background = 'rgba(255,255,255,0.1)';
            } else {
                btn.textContent = 'Follow';
                btn.style.background = 'var(--c-primary)';
            }
            // Update profile view silently in case it affects the current counts
            ProfileViewController.init(Router.params, true, activeReqId);
        } else {
            Toast.show(res ? res.message : 'Action failed', 'error');
        }
        if (btn) btn.disabled = false;
    },

    showFollowsList: async function (type) {
        const title = type === 'followers' ? 'Followers' : 'Following';

        // Immediately open the modal with a loading spinner
        ConfirmModal.show({
            title: title,
            message: `<div id="follows-list-loader" style="text-align:center; padding:30px 0;"><div class="pagination-spinner" style="margin:0 auto;"></div></div>`,
            icon: '👥',
            showCancel: false,
            confirmText: 'Close',
            type: 'info',
            headerLayout: 'row'
        });

        const res = await API.post(`/profile/follows_list`, { type: type });

        // Ensure the loader element still exists (modal wasn't closed or changed)
        const loaderEl = document.getElementById('follows-list-loader');
        if (!loaderEl) return;

        if (!res || !res.success) {
            loaderEl.parentElement.innerHTML = `<div style="text-align:center; color:var(--c-red); padding:10px 0;">Failed to load list.</div>`;
            return;
        }

        const list = res.data || [];

        if (list.length === 0) {
            loaderEl.parentElement.innerHTML = `<div style="text-align:center; color:var(--c-text-muted); padding:10px 0;">No ${type} found.</div>`;
            return;
        }

        const myId = parseInt(localStorage.getItem('auth_user_id')) || 0;
        let html = '<div style="max-height:50vh; overflow-y:auto; text-align:left; padding-right:5px; margin-top:10px;" class="custom-scroll">';
        list.forEach(u => {
            let initials = '?';
            if (u.first_name && u.last_name) {
                initials = (u.first_name.charAt(0) + u.last_name.charAt(0)).toUpperCase();
            } else if (u.name) {
                const parts = u.name.trim().split(' ');
                initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : u.name.substring(0, 2).toUpperCase();
            }
            const avatarHtml = UI.getAvatarHtml(u.image, 'width:100%; height:100%; border-radius:50%; object-fit:cover;', 'width:40px; height:40px; border-radius:50%; flex-shrink:0; font-size:14px; font-weight:700; letter-spacing:0.5px; display:flex; align-items:center; justify-content:center; padding-top:2px;', initials);

            let followBtnHtml = '';
            if (u.id !== myId) {
                if (u.is_following) {
                    followBtnHtml = `<button onclick="event.stopPropagation(); ProfileViewController.toggleFollowInList(${u.id}, this)" class="btn btn-sm" style="background:rgba(255,255,255,0.1); color:#fff; border:none; width:78px; height:28px; font-size:11px; border-radius:20px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; padding:0;">Following</button>`;
                } else {
                    followBtnHtml = `<button onclick="event.stopPropagation(); ProfileViewController.toggleFollowInList(${u.id}, this)" class="btn btn-sm" style="background:var(--c-primary); color:#fff; border:none; width:78px; height:28px; font-size:11px; border-radius:20px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; padding:0;">Follow</button>`;
                }
            }

            html += `<div onclick="ConfirmModal.close(); Router.navigate('/profile/view/${u.player_code}')" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; cursor:pointer; background:rgba(255,255,255,0.02); margin-bottom:6px; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">${avatarHtml}<div style="flex:1; min-width:0; text-align:left;"><div style="font-weight:700; font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</div><div style="font-size:10px; font-weight:600; color:var(--c-orange); font-family:monospace; margin-top:1px;">${u.player_code}</div></div>${followBtnHtml ? `<div style="flex-shrink:0;">${followBtnHtml}</div>` : ''}</div>`;
        });
        html += '</div>';

        loaderEl.parentElement.innerHTML = html;
    },

    initInviteButton: async function () {
        const row = document.getElementById('prof-invite-row');
        const btn = document.getElementById('btn-prof-invite');
        if (!row || !btn) return;

        try {
            let res = window._cachedInvitesRes;
            if (!res) {
                res = await API.post('/invite/get_invites', {});
                window._cachedInvitesRes = res;
            }
            if (res && res.success && res.data) {
                if (!res.data.invite_only_mode) {
                    row.style.display = 'none';
                    return;
                }
                const invites = res.data.keys || [];
                const unusedCount = invites.filter(inv => !inv.used_at).length;
                btn.innerHTML = `<span>Share Exclusive Invites</span><span style="color:var(--c-orange); display:flex; align-items:center; gap:6px;">(${unusedCount} Left) <span style="font-size:16px;">🎟️</span></span>`;
                row.style.display = 'flex';
                btn.onclick = () => {
                    InviteModal.show(invites, (updatedInvites) => {
                        res.data.keys = updatedInvites;
                        const newUnused = updatedInvites.filter(inv => !inv.used_at).length;
                        btn.innerHTML = `<span>Share Exclusive Invites</span><span style="color:var(--c-orange); display:flex; align-items:center; gap:6px;">(${newUnused} Left) <span style="font-size:16px;">🎟️</span></span>`;
                    });
                };
            }
        } catch (e) {
            console.error('Error loading invites on profile:', e);
        }
    }
};

const ProfileController = {

    confirmDeleteAccount: async function () {
        const password = await ConfirmModal.show({
            title: 'Delete Account?',
            message: '<span style="color:#fff;"><b>Are you sure you want to delete your account?</b>\n\nThis will permanently delete:</span>\n• Your profile details and photos\n• Your points, matches, and stats\n\n⚠️ <i>You will be logged out immediately and this cannot be undone.</i>',
            confirmText: 'Yes, Delete Account',
            cancelText: 'Cancel',
            type: 'warning',
            showInput: true,
            inputType: 'password',
            required: true,
            inputPlaceholder: 'Enter your password...',
            inputMaxLength: 100
        });

        if (!password) return;

        const res = await API.post('/profile/delete', { password: password });
        if (res && res.success) {
            Toast.show('Account successfully deleted.', 'success');
            Auth.clearAll();
            Router.navigate('/login');
        } else {
            Toast.show(res ? res.message : 'Deletion failed. Please try again.', 'error');
        }
    },

    reportPlayer: async function (targetUserId) {
        const reason = await ConfirmModal.show({
            title: 'Report player conduct',
            message: '<b>Common reasons:</b>\n• No show\n• Rude behavior\n• Wrong skill level',
            showInput: true,
            inputPlaceholder: 'Unfair behavior / Inappropriate conduct...',
            inputMaxLength: 300,
            tipText: 'Tell us exactly what this player did.',
            confirmText: 'Submit Report',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/profile/report', { target_user_id: targetUserId, reason });
        if (res && res.success) {
            Toast.show('Report submitted successfully.', 'success');
        } else {
            Toast.show(res ? res.message : 'Report failed', 'error');
        }
    },

    _cropper: null,

    cancelCrop: function () {
        document.getElementById('crop-modal-overlay').style.display = 'none';
        if (this._cropper) {
            this._cropper.destroy();
            this._cropper = null;
        }
        const input = document.getElementById('avatar-input');
        if (input) input.value = '';
    },

    zoom: function (amount) {
        if (this._cropper) {
            this._cropper.zoom(amount);
        }
    },

    confirmCrop: async function () {
        if (!this._cropper) return;

        const canvas = this._cropper.getCroppedCanvas({
            width: 500,
            height: 500
        });

        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'avatar.png');

            document.getElementById('crop-modal-overlay').style.display = 'none';
            this._cropper.destroy();
            this._cropper = null;

            // Save original states in case of failure
            const imgEl = document.getElementById('edit-avatar-img');
            const previewEl = document.getElementById('edit-avatar-preview');
            const origImgDisplay = imgEl ? imgEl.style.display : 'none';
            const origPreviewDisplay = previewEl ? previewEl.style.display : 'flex';
            const origPreviewHtml = previewEl ? previewEl.innerHTML : '';

            if (imgEl && previewEl) {
                imgEl.style.display = 'none';
                previewEl.innerHTML = `<div class="pagination-spinner" style="width:36px; height:36px; border-width:4px; border-top-color:var(--c-orange);"></div>`;
                previewEl.style.display = 'flex';
            }

            try {
                const res = await fetch(CONFIG.API_BASE_URL + '/profile/upload_image', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
                    body: formData
                }).then(r => r.json());

                if (res && res.success) {
                    const displayImg = res.data.profile_image_thumb || res.data.profile_image;
                    const removeBtn = document.getElementById('remove-avatar-btn');

                    if (imgEl && previewEl) {
                        imgEl.src = CONFIG.ASSET_BASE + '/' + displayImg;
                        imgEl.style.display = 'block';
                        previewEl.style.display = 'none';
                    }

                    if (removeBtn) removeBtn.style.display = 'block';
                    Toast.show('Photo updated', 'success');
                    UI.syncNav();
                } else {
                    if (imgEl && previewEl) {
                        imgEl.style.display = origImgDisplay;
                        previewEl.style.display = origPreviewDisplay;
                        previewEl.innerHTML = origPreviewHtml;
                    }
                    Toast.show(res ? res.message : 'Upload failed', 'error');
                }
            } catch (err) {
                if (imgEl && previewEl) {
                    imgEl.style.display = origImgDisplay;
                    previewEl.style.display = origPreviewDisplay;
                    previewEl.innerHTML = origPreviewHtml;
                }
                Toast.show('Upload failed', 'error');
            }
        }, 'image/png');
    },

    initEdit: async function () {
        const form = document.getElementById('profile-form');
        if (!form) return;

        const q = (name) => form.querySelector(`[name="${name}"]`);

        // Populate locations dynamically
        const locSelect = document.getElementById('edit-profile-location') || q('location_id');
        if (locSelect) {
            locSelect.innerHTML = '<option value="">Select city...</option>';
            try {
                const locRes = await API.post('/profile/locations', {});
                if (locRes && locRes.success && locRes.data) {
                    locRes.data.forEach(loc => {
                        const opt = new Option(loc.name, loc.id);
                        locSelect.add(opt);
                    });
                }
            } catch (err) {
                console.error('Failed to load locations:', err);
            }
        }

        // Populate days
        const daySelect = q('dob_day');
        if (daySelect) {
            for (let i = 1; i <= 31; i++) {
                const val = i.toString().padStart(2, '0');
                daySelect.options.add(new Option(i, val));
            }
        }

        // Populate years (for 16-65yo)
        const yearSelect = q('dob_year');
        if (yearSelect) {
            const currentYear = new Date().getFullYear();
            for (let i = currentYear - 16; i >= currentYear - 65; i--) {
                yearSelect.options.add(new Option(i, i));
            }
        }
        // Only show logout option if they don't have a profile yet
        const logoutOption = document.getElementById('logout-option');
        if (logoutOption) {
            logoutOption.style.display = Auth.hasProfile() ? 'none' : 'block';
        }

        // Load existing data if they already have a profile
        const isExisting = Auth.hasProfile();

        // Dynamic content based on state
        const titleEl = document.getElementById('edit-profile-title');
        const subtitleEl = document.getElementById('edit-profile-subtitle');
        const submitBtn = document.getElementById('edit-profile-submit');

        if (isExisting) {
            if (titleEl) titleEl.textContent = 'Edit Profile';
            if (subtitleEl) subtitleEl.style.display = 'none';
            if (submitBtn) submitBtn.textContent = 'Save changes';
        } else {
            if (titleEl) titleEl.textContent = 'Complete Your Profile';
            if (subtitleEl) subtitleEl.style.display = 'block';
            if (submitBtn) submitBtn.textContent = 'Join Leaderboard →'; // Match initial design
        }

        // Preload avatar instantly from profile view cache for immediate feedback
        const selfCache = ProfileViewController._viewCache['self'];
        if (selfCache) {
            const p = selfCache.profile;
            const u = selfCache.user;
            const imgEl = document.getElementById('edit-avatar-img');
            const previewEl = document.getElementById('edit-avatar-preview');
            const removeBtn = document.getElementById('remove-avatar-btn');

            if (imgEl && previewEl) {
                const displayImg = p?.profile_image_thumb || p?.profile_image;
                if (displayImg) {
                    imgEl.src = CONFIG.ASSET_BASE + '/' + displayImg;
                    imgEl.style.display = 'block';
                    previewEl.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'block';
                } else if (u) {
                    const initials = (u.first_name[0] + (u.last_name ? u.last_name[0] : '')).toUpperCase();
                    previewEl.innerHTML = `<span style="font-size:28px;">${initials}</span>`;
                    previewEl.style.display = 'flex';
                    imgEl.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            }
        }

        // Fetch data to pre-fill (even for new users to get first/last name from reg step)
        API.post('/profile/get', {}).then(res => {
            if (res && res.success) {
                const p = res.data.profile;
                const u = res.data.user;
                if (u) {
                    const fn = q('first_name');
                    const ln = q('last_name');
                    if (fn) fn.value = u.first_name || '';
                    if (ln) ln.value = u.last_name || '';

                    // Populate read-only contact info
                    const emailEl = document.getElementById('edit-email');
                    const phoneEl = document.getElementById('edit-phone');
                    if (emailEl) emailEl.textContent = u.email || '—';
                    if (phoneEl) phoneEl.textContent = u.mobile || '—';
                }
                if (p) {
                    const nick = q('nickname');
                    if (nick && p.nickname) nick.value = p.nickname;

                    const genderSelect = q('gender');
                    if (genderSelect && p.gender) {
                        const val = p.gender.charAt(0).toUpperCase() + p.gender.slice(1);

                        // Create a readonly input to replace the dropdown
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.name = 'gender';
                        input.className = 'form-input';
                        input.value = val;
                        input.readOnly = true;
                        input.style.cursor = 'default';
                        input.style.background = 'rgba(255,255,255,0.02)';
                        input.style.color = 'var(--c-text-muted)';
                        input.title = 'Gender cannot be changed once set.';

                        genderSelect.parentNode.replaceChild(input, genderSelect);
                        // Force form element update
                        if (form.elements) form.elements['gender'] = input;
                    }
                    const psSelect = q('playing_side');
                    if (psSelect && p.playing_side) psSelect.value = p.playing_side;

                    const locSelect = document.getElementById('edit-profile-location') || q('location_id');
                    if (locSelect && p.location_id) {
                        locSelect.value = p.location_id;
                    }
                    const bioText = q('bio');
                    if (bioText && p.bio) bioText.value = p.bio;

                    Auth.setHasProfile(true); // They have a profile row
                    Auth.setHasLevel(!!p.level);

                    if (!p.level) {
                        const modal = document.getElementById('level-selection-modal');
                        if (modal) {
                            modal.style.display = 'flex';
                            document.body.style.overflow = 'hidden';
                            document.documentElement.style.overflow = 'hidden';
                        }
                    }

                    if (p.date_of_birth) {
                        const parts = p.date_of_birth.split('-');
                        if (parts.length === 3) {
                            const dy = q('dob_year');
                            const dm = q('dob_month');
                            const dd = q('dob_day');
                            if (dy) dy.value = parts[0];
                            if (dm) dm.value = parts[1];
                            if (dd) dd.value = parts[2];
                        }
                    }
                }

                // Avatar setup
                const imgEl = document.getElementById('edit-avatar-img');
                const previewEl = document.getElementById('edit-avatar-preview');
                const removeBtn = document.getElementById('remove-avatar-btn');

                const displayImg = p.profile_image_thumb || p.profile_image;
                if (displayImg && imgEl && previewEl) {
                    imgEl.src = CONFIG.ASSET_BASE + '/' + displayImg;
                    imgEl.style.display = 'block';
                    previewEl.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'block';
                } else if (u && previewEl && imgEl) {
                    // Show initials if no photo
                    const initials = (u.first_name[0] + (u.last_name ? u.last_name[0] : '')).toUpperCase();
                    previewEl.innerHTML = `<span style="font-size:28px;">${initials}</span>`;
                    previewEl.style.display = 'flex';
                    imgEl.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            }
        });

        // Avatar Upload Handlers
        const avatarInput = document.getElementById('avatar-input');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Clear the input value so the same file can be selected again if needed
                e.target.value = "";

                const reader = new FileReader();
                reader.onload = (event) => {
                    const overlay = document.getElementById('crop-modal-overlay');
                    const imageEl = document.getElementById('crop-image-el');
                    imageEl.src = event.target.result;
                    overlay.style.display = 'flex';

                    if (ProfileController._cropper) {
                        ProfileController._cropper.destroy();
                    }

                    const zoomBar = document.getElementById('crop-zoom-bar');
                    if (zoomBar) zoomBar.value = 1;

                    ProfileController._cropper = new Cropper(imageEl, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        modal: true,
                        guides: false,
                        center: true,
                        highlight: false,
                        background: false,
                        restore: false,
                        checkOrientation: true,
                        cropBoxMovable: false,
                        cropBoxResizable: false,
                        toggleDragModeOnDblclick: false,
                        ready: function () {
                            const data = ProfileController._cropper.getCanvasData();
                            const initialRatio = data.width / data.naturalWidth;
                            if (zoomBar) {
                                zoomBar.min = initialRatio;
                                zoomBar.max = initialRatio * 5; // 5x zoom max
                                zoomBar.value = initialRatio;
                            }
                        },
                        zoom: function (e) {
                            if (zoomBar) zoomBar.value = e.detail.ratio;
                        }
                    });

                    if (zoomBar) {
                        zoomBar.oninput = (e) => {
                            if (ProfileController._cropper) {
                                ProfileController._cropper.zoomTo(parseFloat(e.target.value));
                            }
                        };
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        const uploadPhotoBtn = document.getElementById('upload-photo-btn');
        if (uploadPhotoBtn) {
            uploadPhotoBtn.onclick = (e) => {
                e.preventDefault();
                const input = document.getElementById('avatar-input');
                if (input) input.click();
            };
        }

        const removeAvatarBtn = document.getElementById('remove-avatar-btn');
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', async () => {
                const res = await API.post('/profile/remove_image', {});
                if (res && res.success) {
                    const cached = ProfileViewController._viewCache['self'];
                    if (cached && cached.profile) {
                        cached.profile.profile_image = null;
                        cached.profile.profile_image_thumb = null;
                    }
                    const imgEl = document.getElementById('edit-avatar-img');
                    const previewEl = document.getElementById('edit-avatar-preview');
                    if (imgEl) imgEl.style.display = 'none';
                    if (previewEl) {
                        let initials = '?';
                        if (cached && cached.user) {
                            const u = cached.user;
                            initials = (u.first_name[0] + (u.last_name ? u.last_name[0] : '')).toUpperCase();
                        }
                        previewEl.innerHTML = `<span style="font-size:28px;">${initials}</span>`;
                        previewEl.style.display = 'flex';
                    }
                    removeAvatarBtn.style.display = 'none';
                    Toast.show('Photo removed', 'success');
                    UI.syncNav();
                }
            });
        }

        // Bind level selection radios (programmatic bypass for DOMPurify event stripping)
        const levelRadios = document.querySelectorAll('input[name="player_level"]');
        const submitLevelBtn = document.getElementById('level-selection-submit');
        if (levelRadios.length && submitLevelBtn) {
            levelRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    submitLevelBtn.disabled = false;
                    submitLevelBtn.classList.add('active');
                });
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            const getVal = (name) => {
                const el = (name === 'location_id') ? (document.getElementById('edit-profile-location') || q(name)) : q(name);
                return el ? el.value : '';
            };

            const firstName = getVal('first_name');
            const lastName = getVal('last_name');
            const gender = getVal('gender');
            const playingSide = getVal('playing_side');
            const locationId = getVal('location_id');
            const nickname = getVal('nickname');
            const bio = getVal('bio');
            const dobDay = getVal('dob_day');
            const dobMonth = getVal('dob_month');
            const dobYear = getVal('dob_year');

            if (!firstName) { UI.showError('first_name', 'First name is required', form); return; }
            if (!lastName) { UI.showError('last_name', 'Last name is required', form); return; }
            if (!dobDay) { UI.showError('dob_day', 'Select day', form); return; }
            if (!dobMonth) { UI.showError('dob_month', 'Select month', form); return; }
            if (!dobYear) { UI.showError('dob_year', 'Select year', form); return; }

            const age = new Date().getFullYear() - parseInt(dobYear);
            if (age < 16 || age > 65) {
                UI.showError('dob_year', 'Age must be between 16 and 65', form);
                return;
            }

            if (!gender) { UI.showError('gender', 'Please select gender', form); return; }
            if (!playingSide) { UI.showError('playing_side', 'Please select your side', form); return; }
            if (!locationId) { UI.showError('location_id', 'Please select location', form); return; }

            const dob = `${dobYear}-${dobMonth}-${dobDay}`;

            const payload = {
                first_name: Sanitizer.cleanName(firstName),
                last_name: Sanitizer.cleanName(lastName),
                date_of_birth: dob,
                gender: gender,
                playing_side: playingSide,
                nickname: Sanitizer.cleanName(nickname),
                location_id: parseInt(locationId),
                bio: bio.trim()
            };

            const res = await API.post('/profile/update', payload);
            if (res && res.success) {
                Auth.setHasProfile(true);
                // Important: Don't set hasLevel(true) here yet!

                if (res.data && res.data.is_new_profile) {
                    const modal = document.getElementById('level-selection-modal');
                    if (modal) {
                        modal.style.display = 'flex';
                        document.body.style.overflow = 'hidden';
                        document.documentElement.style.overflow = 'hidden';
                    }
                } else if (isExisting) {
                    Auth.setHasLevel(true); // Existing profile means they already have a level (or we are just editing)
                    Router.navigate('/profile/view');
                } else {
                    // This case shouldn't normally happen for new profiles without level
                    Router.navigate('/dashboard');
                }
            } else {
                Toast.show(res ? res.message : 'Failed to save profile');
            }
        });
    },

    submitLevel: async function () {
        const selected = document.querySelector('input[name="player_level"]:checked');
        if (!selected) return;
        const level = selected.value;
        const btn = document.getElementById('level-selection-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        const res = await API.post('/profile/set_level', { level });
        if (res && res.success) {
            Auth.setHasLevel(true);
            document.getElementById('level-selection-modal').style.display = 'none';
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            Router.navigate('/dashboard');
        } else {
            Toast.show(res ? res.message : 'Failed to save level');
            if (btn) { btn.disabled = false; btn.textContent = 'Complete Profile'; }
        }
    }
};

// -------------------------------------------------------
//  MATCHES CONTROLLER  (Phase 3)
// -------------------------------------------------------
const MatchesController = {
    _lastMode: 'play',
    _currentTab: 'play_upcoming',
    _playFilterType: 'competition',
    _playFilterGender: 'same_gender',
    _lastRequestId: 0,
    _cache: {}, // Stores lists per tab/filters
    _viewCache: {}, // Stores match details by ID
    _lastMatchId: null,
    _lastMatchState: null,
    _partnerEnabled: false,
    _offset: 0,
    _limit: 20,
    _hasMore: true,
    _isLoading: false,
    _countdownInterval: null,

    // ── Create ──────────────────────────────────────────

    initCreate: function () {
        UI.syncNav();

        const genderBtn = document.getElementById('cm-gender-restricted-btn');
        if (genderBtn) {
            const updateGenderLabel = (p) => {
                if (!p || !p.gender) return;
                const isFemale = p.gender.toLowerCase() === 'female';
                genderBtn.textContent = isFemale ? 'Women Only' : 'Men Only';
                if (isFemale && genderBtn.classList.contains('active')) {
                    genderBtn.style.background = 'var(--c-pink)';
                }
            };

            if (DashboardController._currentProfile) {
                updateGenderLabel(DashboardController._currentProfile);
            } else {
                API.post('/profile/get', {}).then(res => {
                    if (res && res.success) updateGenderLabel(res.data.profile);
                });
            }
        }

        const dateScroller = document.getElementById('cm-date-scroller');
        const timeScroller = document.getElementById('cm-time-scroller');
        const dateInput = document.getElementById('cm-date');
        const timeInput = document.getElementById('cm-time');

        if (dateScroller && dateInput) {
            // Generate next 4 days (Today + 3)
            let html = '';
            for (let i = 0; i < 4; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const iso = d.toISOString().slice(0, 10);
                const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = d.getDate();

                html += `
                <div class="pill ${i === 0 ? 'active' : ''}" data-value="${iso}" onclick="MatchesController._selectPill(this, 'cm-date')">
                    <span class="pill-sub">${dayName}</span>
                    <span class="pill-main">${dayNum}</span>
                </div>`;
                if (i === 0) dateInput.value = iso;
            }
            dateScroller.innerHTML = safeHTML(html);
        }

        if (timeScroller && timeInput) {
            // Generate 30-min slots from 07:00 to 02:00 (next day)
            let html = '';
            for (let h = 7; h <= 26; h++) {
                ['00', '30'].forEach(m => {
                    if (h === 26 && m === '30') return; // Max time is 2:00 AM

                    const actualHour = h % 24;
                    const h24 = actualHour.toString().padStart(2, '0');
                    const t = `${h24}:${m}`;

                    // Display label (12h format)
                    const ampm = actualHour >= 12 ? 'PM' : 'AM';
                    const displayHr = actualHour % 12 || 12;
                    const displayTime = `${displayHr}:${m}`;

                    html += `
                    <div class="pill" data-value="${t}" onclick="MatchesController._selectPill(this, 'cm-time')">
                        <span class="pill-main">${displayTime}</span>
                        <span class="pill-sub">${ampm}</span>
                    </div>`;
                });
            }
            timeScroller.innerHTML = safeHTML(html);

            // Scroll to 4:00 PM (16:00) by default as a starting point, but don't select it
            const defaultTime = '16:00';
            const defaultPill = timeScroller.querySelector(`.pill[data-value="${defaultTime}"]`);
            if (defaultPill) {
                // Use a small timeout to ensure DOM is ready for scrolling
                setTimeout(() => {
                    defaultPill.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                }, 100);
            }
        }




        // Venue Autocomplete
        const venueInput = document.getElementById('cm-venue');
        const venueDrop = document.getElementById('cm-venue-dropdown');
        let venueTimeout = null;

        if (venueInput && venueDrop) {
            venueInput.addEventListener('input', (e) => {
                clearTimeout(venueTimeout);
                const q = e.target.value.trim();

                if (q.length < 1) {
                    venueDrop.style.display = 'none';
                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');
                    if (addBtnWrap) addBtnWrap.style.display = 'none';
                    return;
                }

                venueTimeout = setTimeout(async () => {
                    const res = await API.post('/match/venues', { q: q });
                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');
                    const dbFlag = document.getElementById('cm-venue-is-db');
                    const idInput = document.getElementById('cm-venue-id');

                    if (res && res.success && res.data.venues.length > 0) {
                        venueDrop.innerHTML = safeHTML(res.data.venues.map(v => `<li data-id="${v.id}">${v.name}</li>`).join(''));
                        venueDrop.style.display = 'block';

                        // Auto-link if exact case-insensitive match is found
                        const exactMatch = res.data.venues.find(v => v.name.trim().toLowerCase() === q.toLowerCase());
                        if (exactMatch) {
                            if (dbFlag) dbFlag.value = '1';
                            if (idInput) idInput.value = exactMatch.id;
                            if (addBtnWrap) addBtnWrap.style.display = 'none';
                        } else {
                            if (dbFlag) dbFlag.value = '0';
                            if (idInput) idInput.value = '';
                            if (addBtnWrap) addBtnWrap.style.display = 'block';
                        }
                    } else {
                        venueDrop.style.display = 'none';
                        if (addBtnWrap) addBtnWrap.style.display = 'block';
                        if (dbFlag) dbFlag.value = '0';
                        if (idInput) idInput.value = '';
                    }
                }, 300);

                // Reset DB flag on input
                const dbFlag = document.getElementById('cm-venue-is-db');
                if (dbFlag) dbFlag.value = '0';
            });

            // Handle selection
            venueDrop.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const fullText = e.target.textContent;
                    const venueId = e.target.dataset.id;
                    venueInput.value = fullText;
                    venueDrop.style.display = 'none';

                    const dbFlag = document.getElementById('cm-venue-is-db');
                    if (dbFlag) dbFlag.value = '1';

                    const idInput = document.getElementById('cm-venue-id');
                    if (idInput) idInput.value = venueId;

                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');
                    if (addBtnWrap) addBtnWrap.style.display = 'none';
                }
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (e.target !== venueInput && e.target !== venueDrop) {
                    venueDrop.style.display = 'none';
                }
            });
        }

        // Partner Code Check
        const partnerInput = document.getElementById('cm-partner-code');
        const partnerHelp = document.getElementById('cm-partner-help');
        let partnerTimeout = null;

        // Badge references removed.

        if (partnerInput && partnerHelp) {

            partnerInput.addEventListener('input', (e) => {
                clearTimeout(partnerTimeout);

                const q = e.target.value.trim();
                partnerHelp.textContent = "Enter your partner's player XCode";
                partnerHelp.style.color = 'var(--c-text-muted)';
                partnerInput.classList.remove('error');

                if (q.length >= 3 && q.length <= 7) {
                    partnerHelp.textContent = "Looking up player...";
                    partnerTimeout = setTimeout(async () => {
                        const res = await API.post('/profile/check_code', { code: q });
                        if (res && res.success) {
                            partnerInput.value = q; // Standardize value to just the code
                            partnerHelp.innerHTML = safeHTML(`✓ Found player: <strong style="color:var(--c-text); margin-left:4px;">${res.data.name}</strong>`); partnerHelp.style.color = "var(--c-primary)";
                        } else {
                            partnerHelp.textContent = (res && res.message) ? res.message : "Player not found or invalid";
                            partnerHelp.style.color = "var(--c-danger)";
                            partnerInput.classList.add('error');
                        }
                    }, 400);
                } else if (q.length > 4) {
                    // Trim long inputs if pasted
                    e.target.value = q.substring(0, 4);
                    e.target.dispatchEvent(new Event('input'));
                } else {
                    // Do nothing
                }
            });
        }

        const form = document.getElementById('create-match-form');

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            const venue = form.venue_name.value.trim();
            const court = form.court_name.value.trim();
            const dateVal = dateInput ? dateInput.value : '';
            const timeVal = timeInput ? timeInput.value : '';
            const isDbVenue = document.getElementById('cm-venue-is-db')?.value === '1';

            if (!venue) { UI.showError('venue_name', 'Venue name is required', form); return; }
            if (!isDbVenue) {
                UI.showError('venue_name', 'Please select a venue from the official list or add a new one.', form);
                return;
            }
            if (!court) { UI.showError('court_name', 'Court name or number is required', form); return; }

            if (!dateVal) { UI.showError('date', 'Please select a date', form); return; }
            if (!timeVal) { UI.showError('time', 'Please select a time', form); return; }

            // Combine
            const combined = dateVal + 'T' + timeVal;
            const pickedDt = new Date(combined);
            const now = new Date();
            now.setMinutes(now.getMinutes() + 15); // Buffer

            if (pickedDt <= now) {
                UI.showError('time', 'Match date must be in the future', form);
                return;
            }


            const payload = {
                venue_id: form.venue_id.value,
                venue_name: venue,
                court_name: form.court_name.value.trim(),
                match_datetime: combined,
                duration_minutes: parseInt(form.duration_minutes.value) || 90,
                gender_type: form.gender_type.value,
                match_type: form.match_type.value
            };

            if (MatchesController._partnerEnabled) {
                let code = form.partner_player_code.value.trim();
                // Strip the name if it was appended (e.g. "A123 (Ahmed Magdy)" -> "A123")
                if (code.includes(' (')) {
                    code = code.split(' (')[0].trim();
                }
                if (!code || code.length < 3 || code.length > 7) {
                    UI.showError('partner_player_code', "Enter a valid player XCode", form);
                    return;
                }
                payload.partner_player_code = code;
            }


            const btn = document.getElementById('cm-submit');
            btn.disabled = true;
            btn.textContent = 'Creating…';

            const res = await API.post('/match/create', payload);

            if (res && res.success) {
                Toast.show('Match created!', 'success');
                SoundManager.play('success');
                Router.navigate('/matches/' + res.data.match_code, true, true);
            } else {
                btn.disabled = false;
                btn.textContent = '🎾 Create Match';
                Toast.show(res ? res.message : 'Failed to create match', 'error');
            }
        });
    },

    setToggle: function (fieldName, btn) {
        document.getElementById('cm-' + fieldName.replace('_', '-')).value = btn.dataset.val;
        const container = btn.parentElement;
        const buttons = container.querySelectorAll('button');
        buttons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--c-text-muted)';
        });
        btn.classList.add('active');
        let activeBg = 'var(--c-primary)';
        if (btn.textContent.includes('Women Only')) activeBg = 'var(--c-pink)';
        btn.style.background = activeBg;
        btn.style.color = '#fff';
    },

    showMatchTypeInfo: function () {
        Toast.show("Competition matches affect your points and ranking; friendly matches do not.", "info", 6000);
    },

    showVenueRequest: function () {
        ConfirmModal.show({
            title: 'Venue details',
            message: 'Enter the name and location of the venue you would like to add.',
            confirmText: 'Submit Request',
            showInput: true,
            inputPlaceholder: 'Venue Name, City',
            inputMaxLength: 100,
            tipText: 'Format: Club Name, City',
            type: 'info'
        }).then(res => {
            // 'res' is the string input if confirmed, or false/null if cancelled
            if (res && typeof res === 'string' && res.trim()) {
                const venueName = res.trim();
                API.post('/match/request_venue', { venue_name: venueName }).then(response => {
                    Toast.show("Our team will review and add this venue shortly. Stay tuned!", "success", 6000);
                });
            }
        });
    },

    _selectPill: function (el, inputId) {
        const parent = el.parentElement;
        parent.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        document.getElementById(inputId).value = el.dataset.value;
    },

    scroll: function (id, direction) {
        const el = document.getElementById(id);
        if (el) {
            const scrollAmount = el.clientWidth * 0.6;
            el.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    },



    togglePartner: function () {
        MatchesController._partnerEnabled = !MatchesController._partnerEnabled;
        const row = document.getElementById('cm-partner-toggle-row');
        const section = document.getElementById('cm-partner-section');
        if (MatchesController._partnerEnabled) {
            row.classList.add('toggle-on');
            if (section) section.style.display = 'block';
        } else {
            row.classList.remove('toggle-on');
            if (section) section.style.display = 'none';
        }
    },

    // ── List ──────────────────────────────────────────
    initList: async function (mode = 'play') {
        // Resolve sub-tab: check if we have a saved sub-tab for this mode
        const savedTab = sessionStorage.getItem('last_sub_tab_' + mode);
        let defaultSubTab = mode === 'play' ? 'play_upcoming' : 'mine_upcoming';

        MatchesController._currentTab = savedTab || defaultSubTab;
        MatchesController._lastMode = mode;

        if (mode === 'play') {
            const savedType = sessionStorage.getItem('last_play_filter_type');
            const savedGender = sessionStorage.getItem('last_play_filter_gender');
            if (savedType) MatchesController._playFilterType = savedType;
            if (savedGender) MatchesController._playFilterGender = savedGender;
        }

        UI.syncNav();
        const skeleton = document.getElementById('ml-skeleton');
        const list = document.getElementById('ml-list');
        const headerTitleEl = document.getElementById('ml-header-title');
        const headerSubEl = document.getElementById('ml-header-sub');
        const tabsContainer = document.getElementById('ml-tabs-container');
        const rulesBtn = document.getElementById('ml-rules-btn');
        const createBtn = document.getElementById('ml-create-btn');

        if (rulesBtn) rulesBtn.style.display = mode === 'play' ? 'flex' : 'none';
        if (createBtn) createBtn.style.display = mode === 'play' ? 'flex' : 'none';

        if (headerTitleEl) {
            if (mode === 'play') {
                headerTitleEl.textContent = 'Play';

                headerSubEl.textContent = 'Join Solo or Squad!';
                const dot = document.createElement('span');
                dot.style.cssText = 'display:inline-block; width:5px; height:5px; border-radius:50%; background:#10B981; box-shadow:0 0 8px #10B981; margin-right:8px; vertical-align:middle;';
                headerSubEl.insertBefore(dot, headerSubEl.firstChild);

                if (tabsContainer) {
                    tabsContainer.innerHTML = `
                      <button id="ml-tab-play_upcoming" onclick="MatchesController.switchTab('play_upcoming')"
                        style="flex:1; background:none; border:none; color:${MatchesController._currentTab === 'play_upcoming' ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:15px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${MatchesController._currentTab === 'play_upcoming' ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s;">
                        ⏳ Upcoming
                      </button>
                      <button id="ml-tab-play_past" onclick="MatchesController.switchTab('play_past')"
                        style="flex:1; background:none; border:none; color:${MatchesController._currentTab === 'play_past' ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:15px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${MatchesController._currentTab === 'play_past' ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s;">
                        🏆 Scores
                      </button>
                      `;
                }
            } else {
                headerTitleEl.textContent = 'My Matches';

                headerSubEl.textContent = 'Your upcoming and history';
                const dot = document.createElement('span');
                dot.style.cssText = 'display:inline-block; width:5px; height:5px; border-radius:50%; background:#10B981; box-shadow:0 0 8px #10B981; margin-right:8px; vertical-align:middle;';
                headerSubEl.insertBefore(dot, headerSubEl.firstChild);

                const isUpcoming = MatchesController._currentTab === 'mine_upcoming';
                const isPast = MatchesController._currentTab === 'mine_past';
                const isCompleted = MatchesController._currentTab === 'mine_completed';

                tabsContainer.innerHTML = `
                  <button id="ml-tab-mine_upcoming" onclick="MatchesController.switchTab('mine_upcoming')" 
                    style="flex:1; background:none; border:none; color:${isUpcoming ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isUpcoming ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    ⏳ Upcoming
                  </button>
                  <button id="ml-tab-mine_past" onclick="MatchesController.switchTab('mine_past')" 
                    style="flex:1; background:none; border:none; color:${isPast ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isPast ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    🌘 Past
                  </button>
                  <button id="ml-tab-mine_completed" onclick="MatchesController.switchTab('mine_completed')" 
                    style="flex:1; background:none; border:none; color:${isCompleted ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isCompleted ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    🏆 Scores
                  </button>
                `;
            }
        }

        await MatchesController.updatePlayFiltersUI();

        // Reset pagination
        MatchesController._offset = 0;
        MatchesController._hasMore = true;
        MatchesController._isLoading = false;

        // Scroll listener for pagination
        window.removeEventListener('scroll', MatchesController.handleScroll);
        window.addEventListener('scroll', MatchesController.handleScroll);

        await MatchesController.loadList();
        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_list', () => MatchesController.loadList(true), 10000);
        }
    },

    updatePlayFiltersUI: async function () {
        const filterEl = document.getElementById('ml-play-filters');
        if (!filterEl) return;

        const isUpcomingPlay = MatchesController._currentTab === 'play_upcoming';
        filterEl.style.display = isUpcomingPlay ? 'block' : 'none';

        if (isUpcomingPlay) {
            // Sync active states for type buttons
            filterEl.querySelectorAll('.ml-type-filter-btn').forEach(btn => {
                const isActive = btn.dataset.val === MatchesController._playFilterType;
                btn.classList.toggle('active', isActive);
                btn.style.background = isActive ? 'var(--c-primary)' : 'transparent';
                btn.style.color = isActive ? '#fff' : 'var(--c-text-muted)';
                btn.style.boxShadow = isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none';
            });

            // Sync active states for gender buttons
            filterEl.querySelectorAll('.ml-gender-filter-btn').forEach(btn => {
                const isActive = btn.dataset.val === MatchesController._playFilterGender;
                btn.classList.toggle('active', isActive);
                btn.style.background = isActive ? 'var(--c-primary)' : 'transparent';
                btn.style.color = isActive ? '#fff' : 'var(--c-text-muted)';
                btn.style.boxShadow = isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none';
            });

            const btn = document.getElementById('ml-gender-restricted-filter-btn');
            if (btn) {
                const updateLabel = (p) => {
                    if (!p || !p.gender) return;
                    const isFemale = p.gender.toLowerCase() === 'female';
                    btn.textContent = isFemale ? 'Women' : 'Men';
                    // Apply pink when Women is the active filter
                    if (isFemale && btn.classList.contains('active')) {
                        btn.style.background = 'var(--c-pink)';
                    }
                };

                if (DashboardController._currentProfile) {
                    updateLabel(DashboardController._currentProfile);
                } else {
                    API.post('/profile/get', {}).then(res => {
                        if (res && res.success) updateLabel(res.data.profile);
                    });
                }
            }
        }
    },

    setPlayFilter: function (type, val, btn) {
        if (type === 'match_type') {
            MatchesController._playFilterType = val;
            sessionStorage.setItem('last_play_filter_type', val);
        }
        if (type === 'gender_type') {
            MatchesController._playFilterGender = val;
            sessionStorage.setItem('last_play_filter_gender', val);
        }

        // Update UI
        const btns = btn.parentElement.querySelectorAll('button');
        btns.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--c-text-muted)';
            b.style.boxShadow = 'none';
        });

        btn.classList.add('active');
        // Use pink for Women same-gender button
        const activeBg = btn.textContent.includes('Women') ? 'var(--c-pink)' : 'var(--c-primary)';
        btn.style.background = activeBg;
        btn.style.color = '#fff';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        // Reset pagination
        MatchesController._offset = 0;
        MatchesController._hasMore = true;
        MatchesController._isLoading = false;

        MatchesController.loadList();
    },

    switchTab: async function (tab) {
        MatchesController._currentTab = tab;
        sessionStorage.setItem('last_sub_tab_' + MatchesController._lastMode, tab);

        await MatchesController.updatePlayFiltersUI();

        // Reset all tabs
        const tabsContainer = document.getElementById('ml-tabs-container');
        if (tabsContainer) {
            tabsContainer.querySelectorAll('button').forEach(btn => {
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = 'var(--c-text-muted)';
            });
            const activeBtn = document.getElementById('ml-tab-' + tab);
            if (activeBtn) {
                activeBtn.style.borderBottomColor = 'var(--c-primary)';
                activeBtn.style.color = 'var(--c-text)';
            }
        }

        // Reset pagination
        MatchesController._offset = 0;
        MatchesController._hasMore = true;
        MatchesController._isLoading = false;

        await MatchesController.loadList();
        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_list', () => MatchesController.loadList(true), 10000);
        }
    },

    loadList: async function (isSilent = false) {
        const skeleton = document.getElementById('ml-skeleton');
        const list = document.getElementById('ml-list');

        const cacheKey = `${MatchesController._currentTab}_${MatchesController._playFilterType}_${MatchesController._playFilterGender}`;
        const hasCache = MatchesController._cache[cacheKey];

        if (!isSilent && !hasCache && skeleton) skeleton.style.display = 'block';
        if (!isSilent && !hasCache && list) list.style.display = 'none';

        // If we have cache, render it immediately while fetching
        if (!isSilent && hasCache && MatchesController._offset === 0) {
            MatchesController.renderList(hasCache);
            if (skeleton) skeleton.style.display = 'none';
            if (list) list.style.display = 'block';
        }

        const currentLength = MatchesController._cache[cacheKey] ? MatchesController._cache[cacheKey].length : 0;
        let endpoint = '/match/list';
        let payload = {
            mode: MatchesController._currentTab,
            match_type: MatchesController._playFilterType,
            gender_type: MatchesController._playFilterGender,
            limit: isSilent ? Math.max(10, currentLength) : MatchesController._limit,
            offset: isSilent ? 0 : MatchesController._offset
        };

        // ONLY use /matches/user for 'Completed' tabs (mine_completed and play_past) to get scores
        if (MatchesController._currentTab === 'play_past') {
            endpoint = '/matches/recent';
            payload = { limit: isSilent ? 10 : MatchesController._limit, offset: isSilent ? 0 : MatchesController._offset };
        } else if (MatchesController._currentTab === 'mine_completed') {
            endpoint = '/matches/user';
            payload = {
                limit: isSilent ? 10 : MatchesController._limit,
                offset: isSilent ? 0 : MatchesController._offset,
                status: 'completed'
            };
        }

        // Store expected state to prevent race conditions if user changes tabs/filters during fetch
        const expectedTab = MatchesController._currentTab;
        const expectedFilterType = MatchesController._playFilterType;
        const expectedFilterGender = MatchesController._playFilterGender;
        const reqId = ++MatchesController._lastRequestId;

        if (!isSilent) MatchesController._isLoading = true;
        let res = await API.post(endpoint, payload);

        // Discard response if user changed tabs/filters OR if a newer request for the SAME state started
        if (
            MatchesController._currentTab !== expectedTab ||
            MatchesController._playFilterType !== expectedFilterType ||
            MatchesController._playFilterGender !== expectedFilterGender ||
            reqId !== MatchesController._lastRequestId
        ) {
            return;
        }

        // Phase 6: Silent retry on first failure
        if ((!res || !res.success) && !isSilent) {
            console.warn("Matches list failed, retrying once...");
            await new Promise(r => setTimeout(r, 1000));
            res = await API.post(endpoint, payload);
        }

        if (!isSilent) MatchesController._isLoading = false;
        if (!isSilent && skeleton) skeleton.style.display = 'none';
        if (!isSilent && list) list.style.display = 'block';

        if (!res || !res.success) {
            if (!isSilent && !hasCache && MatchesController._offset === 0) {
                list.innerHTML = safeHTML(`<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load matches</h3><p>${res ? res.message : 'Network error'}</p></div>`);
            }
            return;
        }

        const newMatches = res.data.matches || [];

        // Polling (isSilent) logic: refresh the entire loaded list safely
        if (isSilent) {
            const existing = MatchesController._cache[cacheKey] || [];
            if (JSON.stringify(existing) !== JSON.stringify(newMatches)) {
                MatchesController._cache[cacheKey] = newMatches;
                MatchesController._offset = newMatches.length;
                MatchesController.renderList(MatchesController._cache[cacheKey]);
            }
            return;
        }

        // Normal load (not polling): Merge uniquely by ID
        if (MatchesController._offset === 0) {
            MatchesController._cache[cacheKey] = newMatches;
        } else {
            const current = MatchesController._cache[cacheKey] || [];
            const seenIds = new Set(current.map(m => m.id));
            const uniqueNew = newMatches.filter(m => !seenIds.has(m.id));
            MatchesController._cache[cacheKey] = current.concat(uniqueNew);
        }

        MatchesController._hasMore = res.data.has_more;
        MatchesController._offset += newMatches.length;

        MatchesController.renderList(MatchesController._cache[cacheKey]);
    },

    loadMore: function () {
        if (MatchesController._isLoading || !MatchesController._hasMore) return;
        MatchesController.loadList();
    },

    handleScroll: function () {
        // Only paginate on match list pages
        if (!document.getElementById('ml-list')) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        if (scrollTop + clientHeight >= scrollHeight - 300) {
            MatchesController.loadMore();
        }
    },

    renderList: function (matches) {
        const list = document.getElementById('ml-list');
        if (!list) return;

        const isScoreTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';

        // Filter for completed only if we are in a score/history tab
        if (isScoreTab) {
            matches = matches.filter(m => m.status === 'completed');
        }

        // Empty state handling
        if (matches.length === 0) {
            let msg = 'Nothing found';
            let sub = 'Check back later for new matches.';
            let icon = '🔍';

            if (MatchesController._currentTab === 'play_upcoming') {
                msg = 'The Court Is Quiet';
                sub = 'The next move is yours ⚔️';
                icon = '🎾';
            } else if (MatchesController._currentTab === 'mine_upcoming') {
                msg = 'Your schedule is clear';
                sub = 'Enter the next round.';
                icon = '📅';
            } else if (MatchesController._currentTab.includes('past') || MatchesController._currentTab.includes('completed')) {
                msg = 'No history yet';
                sub = 'Finished matches will appear here.';
                icon = '🌘';
            }

            const emptyHtml = `
                <div class="empty-state" style="padding:40px 20px; text-align:center; background:rgba(255,255,255,0.02); border-radius:var(--r-lg); border:1px dashed var(--c-border);">
                    <div style="font-size:42px; margin-bottom:12px; opacity:0.4;">${icon}</div>
                    <h3 style="font-size:16px; font-weight:700; margin-bottom:4px; color:var(--c-text);">${msg}</h3>
                    <p style="color:var(--c-text-muted); font-size:13px; max-width:220px; margin:0 auto; line-height:1.4;">${sub}</p>
                    ${MatchesController._currentTab === 'play_upcoming' ? `
                        <button onclick="Router.navigate('/matches/create')" class="btn btn-primary" style="margin-top:16px; width:auto; padding:10px 20px; font-size:13px; height:auto;">🎾 Create Match</button>
                    ` : ''}
                </div>`;
            if (list._lastHtml === emptyHtml) return;
            list.innerHTML = safeHTML(emptyHtml);
            list._lastHtml = emptyHtml;
            return;
        }

        MatchesController._currentFilter = 'all';

        let html = '';
        matches.forEach(m => {
            const isCompletedTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';
            if (m.status === 'completed' && m.scores && m.scores.length > 0 && isCompletedTab) {
                m.scores.forEach(s => { html += MatchesController.renderMatchCard(m, s); });
            } else {
                html += MatchesController.renderMatchCard(m);
            }
        });
        const finalHtml = html + (MatchesController._hasMore ? `<div class="pagination-loader"><div class="pagination-spinner"></div></div>` : '');
        if (list._lastHtml !== finalHtml) {
            list.innerHTML = safeHTML(finalHtml);
            list._lastHtml = finalHtml;
        }
    },

    setFilter: function (filter) {
        MatchesController._currentFilter = filter;
        MatchesController.loadList(true); // Silent refresh
    },

    renderMiniSlot: function (m, team, slot) {
        const s = (m.slots || []).find(x => parseInt(x.team_no) === team && parseInt(x.slot_no) === slot);
        if (s) {
            const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase() || '?';
            const profileUrl = `/p/${s.player_code}`;
            const rawName = s.nickname || s.first_name;
            return `
            <div class="player-mini-slot" style="display:flex; align-items:center; gap:6px; min-width:0; width:100%;">
              <div class="player-avatar-mini" style="width:24px; height:24px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                ${UI.getAvatarHtml(s.profile_image_thumb || s.profile_image, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;', initials)}
              </div>
              <span class="player-name-mini" title="${rawName}" style="flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12.5px; font-weight:600; color:#fff; text-align:left;">
                   ${rawName}
              </span>
              ${s.playing_side ? `<span class="side-indicator-mini ${s.playing_side}" style="flex-shrink:0; margin-left:2px;">${s.playing_side[0].toUpperCase()}</span>` : ''}
            </div>`;
        }
        return `
        <div class="player-mini-slot">
          <div class="empty-avatar-mini">+</div>
          <div class="empty-name-mini">Open</div>
        </div>`;
    },

    renderMatchCard: function (m, specificScore = null) {
        // Use specificScore if provided, otherwise fallback to finding one
        const approvedScore = specificScore || (m.scores || []).find(s => s.status === 'approved') || (m.scores && m.scores.length > 0 ? m.scores[0] : null);

        const dateVal = m.match_datetime || m.scheduled_at;
        const dt = new Date(dateVal ? dateVal.replace(' ', 'T') : null);
        const dateStr = UI.formatMatchDateOnly(dateVal);
        const timeStr = dt.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });

        const isPast = dt < new Date();
        const statusColor = {
            open: isPast ? 'var(--c-text-muted)' : 'var(--c-green)',
            on_hold: 'var(--c-gold)',
            full: 'var(--c-orange)',
            completed: 'var(--c-green)',
            cancelled: 'var(--c-red)',
        };

        let label = m.status.charAt(0).toUpperCase() + m.status.slice(1);
        if (m.status === 'on_hold') label = 'Pending Partner';
        if (m.status === 'open' && isPast) label = 'Incomplete';
        if (m.status === 'completed') label = '🎖 Completed';
        const statusLabel = label;

        let myBadge = '';
        if (m.user_in_match) {
            myBadge = `<span class="badge-user-in">You're in</span>`;
        } else if (m.user_is_requester) {
            myBadge = `<span class="badge-pending">Pending</span>`;
        } else if (m.user_is_invited) {
            myBadge = `<span class="badge-waiting">Invited</span>`;
        } else if (m.user_is_waiting) {
            myBadge = `<span class="badge-in-queue">In Queue</span>`;
        }

        const matchCode = m.match_code || `M-${m.id.toString().padStart(4, '0')}`;
        const venueVal = m.venue_name || m.venue || 'Venue TBD';
        let mainTitle = venueVal;
        let subTitle = '';

        if (venueVal.includes(' | ')) {
            const parts = venueVal.split(' | ');
            mainTitle = parts[0].trim();
            subTitle = parts.slice(1).join(' | ').trim();
        } else if (venueVal.includes(' - ')) {
            const parts = venueVal.split(' - ');
            mainTitle = parts[0].trim();
            subTitle = parts.slice(1).join(' - ').trim();
        } else if (venueVal.includes('-')) {
            const parts = venueVal.split('-');
            mainTitle = parts[0].trim();
            subTitle = parts.slice(1).join('-').trim();
        }

        let typeBadges = '';
        if (m.match_type === 'competition') {
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(255,165,0,0.1); color:var(--c-orange); padding:2px 6px; border-radius:4px; margin-right:4px;">🏆 Competition</span>`;
        } else if (m.match_type === 'friendly') {
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(27, 82, 206, 0.15); color:#5A91FF; padding:2px 6px; border-radius:4px; margin-right:4px;">🤝 Friendly</span>`;
        }

        if (m.gender_type === 'same_gender') {
            const isFemale = (m.creator_gender || 'male') === 'female';
            const genderStr = isFemale ? 'Women' : 'Men';
            const genderIcon = isFemale ? '👩' : '👨';
            const genderColor = isFemale ? 'var(--c-pink)' : '#5B8BFF';
            const genderBg = isFemale ? 'rgba(216, 27, 96, 0.1)' : 'rgba(27,82,206,0.1)';
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:${genderBg}; color:${genderColor}; padding:2px 6px; border-radius:4px; margin-right:4px;">${genderIcon} ${genderStr}</span>`;
        } else if (m.gender_type === 'mixed' || m.gender_type === 'open') {
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(147,112,219,0.1); color:#9370DB; padding:2px 6px; border-radius:4px; margin-right:4px;">👫 Mixed</span>`;
        }

        const isCompletedTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';

        // If completed and has ANY score, use the EXACT Dashboard template (ONLY for Completed tabs)
        if (m.status === 'completed' && approvedScore && isCompletedTab) {
            const allPlayers = [...(m.team_a || []), ...(m.team_b || [])];
            const scoreHtml = ScoreUI.renderMatchScore(m, approvedScore, allPlayers, false);

            const dayStr = UI.formatMatchDateOnly(dateVal);

            let matchTypeBadge = '';
            if (m.match_type === 'competition') {
                matchTypeBadge = `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(255,165,0,0.1); color:var(--c-orange); padding:2px 6px; border-radius:4px; margin-right:4px;">🏆 Competition</span>`;
            } else if (m.match_type === 'friendly') {
                matchTypeBadge = `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(27, 82, 206, 0.15); color:#5A91FF; padding:2px 6px; border-radius:4px; margin-right:4px;">🤝 Friendly</span>`;
            }

            const dashHeader = `
                <div style="font-size:10px; font-weight:800; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding:0 20px; display:flex; justify-content:space-between;">
                    <span>${dayStr}</span>
                    <div style="text-transform:none;">${matchTypeBadge}</div>
                </div>
            `;

            return `
                <div onclick="Router.navigate('/matches/${m.match_code}')" class="dash-match-card" style="cursor:pointer; background:var(--c-bg-card); border-radius:var(--r-lg); padding:14px 0; margin-bottom:28px; transition:var(--t-fast);">
                    ${dashHeader}
                    ${scoreHtml}
                    <div style="padding: 0 20px; margin-top: 10px;">${myBadge}</div>
                </div>
            `;
        }

        const isNotEligible = m.player_eligible === false && MatchesController._currentTab === 'play_upcoming';
        const cardStyle = isNotEligible ? 'opacity: 0.45; filter: grayscale(0.8);' : '';

        if (isNotEligible) {
            typeBadges = `<span style="display:inline-block; font-size:10px; font-weight:800; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px; margin-right:4px; text-transform:uppercase; letter-spacing:0.5px;">🚫 Ineligible to Join</span>` + typeBadges;
        }

        // Default template for upcoming/incomplete/etc.
        return `
        <div class="match-card-modern" onclick="Router.navigate('/matches/${matchCode}')" id="mc-${m.id}" style="${cardStyle}">
          <div class="match-title-row">
            <div style="min-width:0; flex:1;">
               <div>
                  <h3 class="match-venue-name" style="padding-right: 80px; color: #fff; font-family: inherit; display: block;">
                    <span style="font-weight: 800;">${mainTitle}</span>${subTitle ? `<span style="display: inline-block; white-space: nowrap; font-weight: 600; opacity: 0.9;"><span style="margin: 0 8px; opacity: 0.3; font-weight: 300;">|</span>${subTitle}</span>` : ''}
                  </h3>
                  <div class="badge-user-in-wrapper">${myBadge}</div>
               </div>
               <div class="match-meta-row">
                  <span>🗓 <span style="color:#fff; font-weight:600;">${dateStr}</span></span>
                  <span>⏰ ${timeStr}</span>
                  ${m.court_name ? `<span class="court-label-white"><span style="opacity:0.6;">🎾</span> Court: ${m.court_name}</span>` : ''}
               </div>
               ${typeBadges ? `<div style="margin-top:8px;">${typeBadges}</div>` : ''}
            </div>
            <div class="mc-right-col" style="text-align:right; flex-shrink:0;">
               <div class="status-badge-pill status-${(m.status === 'open' && isPast) ? 'incomplete' : m.status}">${statusLabel}</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.02); border-radius:12px; padding:12px 14px; display:grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items:center; gap:8px; margin-top:14px; border:1px solid rgba(255,255,255,0.03);">
             <div>
                <div style="font-size:10px; font-weight:800; color:var(--c-orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; opacity:0.8;">Team 1</div>
                ${MatchesController.renderMiniSlot(m, 1, 1)}
                ${MatchesController.renderMiniSlot(m, 1, 2)}
             </div>
             <div style="width:1px; height:32px; background:rgba(255,255,255,0.05);"></div>
             <div>
                <div style="font-size:10px; font-weight:800; color:#fff; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; opacity:0.8;">Team 2</div>
                ${MatchesController.renderMiniSlot(m, 2, 1)}
                ${MatchesController.renderMiniSlot(m, 2, 2)}
             </div>
          </div>
        </div>`;
    },

    // ── View (detail) ──────────────────────────────────
    initView: async function (params, autoOpenChat = false) {
        UI.syncNav();
        let match_id = parseInt(params?.id || 0);
        const match_code = params?.matchCode || '';

        if (!match_id && !match_code) { Router.navigate('/matches'); return; }

        const result = await MatchesController.loadDetails({ match_id, match_code });
        if (result && result.id) match_id = result.id;

        // Fallback: use the match_id that loadDetails stored in state
        if (!match_id && MatchesController._currentMatchId) {
            match_id = parseInt(MatchesController._currentMatchId);
        }

        if (autoOpenChat && match_id) {
            console.log('[Chat Permalink] Scheduling auto-open for match_id:', match_id);
            setTimeout(() => {
                console.log('[Chat Permalink] Opening chat now for match_id:', match_id);
                if (typeof ChatController !== 'undefined') {
                    ChatController.open(match_id);
                }
            }, 300);
        } else if (autoOpenChat) {
            console.warn('[Chat Permalink] autoOpenChat=true but match_id is still 0, cannot open chat');
        }



        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_details', () => MatchesController.loadDetails({ match_id, match_code }, true), 5000);
        }
    },

    loadDetails: async function (query, isSilent = false) {


        const skeleton = document.getElementById('mv-skeleton');
        const content = document.getElementById('mv-content');

        const cacheKey = query.match_id ? `id_${query.match_id}` : `code_${query.match_code}`;
        const hasCache = MatchesController._viewCache[cacheKey];

        let res;

        if (!isSilent && hasCache && !query._isSWR) {
            // Render instantly from cache
            res = { success: true, data: hasCache };
            if (skeleton) skeleton.style.display = 'none';

            // Trigger silent background fetch for SWR
            setTimeout(() => {
                query._isSWR = true;
                MatchesController.loadDetails(query, true);
            }, 10);
        } else {
            // Full network load
            if (!isSilent && skeleton) skeleton.style.display = 'block';
            if (!isSilent && content) content.style.display = 'none';

            res = await API.post('/match/details', query);
            if (!isSilent && skeleton) skeleton.style.display = 'none';

            if (res && res.success && res.data) {
                MatchesController._viewCache[cacheKey] = res.data;
            }
        }

        if (!res || !res.success || !res.data) {
            Toast.show(res ? res.message : 'Could not load match', 'error');
            if (!isSilent) Router.navigate('/matches');
            return;
        }

        const { match, slots, waiting_list, user_in_match, pending_for_me, my_pending_request, my_waitlist_entry, is_creator, scores, disputes, viewer_id, player_eligible, eligibility_reason } = res.data;
        const myUserId = viewer_id || (user_in_match ? parseInt(user_in_match.user_id) : 0);
        const approvedCount = (scores || []).filter(s => s.status === 'approved').length;

        if (!match || !slots) {
            Toast.show('Incomplete match data', 'error');
            if (!isSilent) Router.navigate('/matches');
            return;
        }

        // State comparison to prevent blinking/flicker during polling
        const currentStateKey = JSON.stringify({
            match: res.data.match,
            slots: res.data.slots,
            waiting_list: res.data.waiting_list,
            user_in_match: res.data.user_in_match,
            pending_for_me: res.data.pending_for_me,
            my_pending_request: res.data.my_pending_request,
            my_waitlist_entry: res.data.my_waitlist_entry,
            late_withdrawal: res.data.late_withdrawal,
            unread_count: res.data.unread_count,
            scores: res.data.scores,
            disputes: res.data.disputes
        });

        const isSameMatch = MatchesController._lastMatchId === parseInt(match.id);
        const isSameState = MatchesController._lastMatchState === currentStateKey;

        if (isSilent && isSameMatch && isSameState) {
            return; // No changes in DB, skip re-render
        }

        MatchesController._lastMatchId = parseInt(match.id);
        MatchesController._lastMatchState = currentStateKey;



        MatchesController._currentMatchId = match.id;
        MatchesController._currentMatchGenderType = match.gender_type;
        MatchesController._currentMatchSlotsCount = slots.length;
        MatchesController._currentMatchSlots = slots;
        MatchesController._currentMatchWaitlist = waiting_list;
        MatchesController._currentUserSide = res.data.user_playing_side;


        // Collect all IDs currently in the match or waiting list
        const playerIds = new Set();
        slots.forEach(s => playerIds.add(parseInt(s.user_id)));
        (waiting_list || []).forEach(w => {
            if (['pending', 'approved'].includes(w.request_status)) {
                playerIds.add(parseInt(w.requester_id));
                if (w.partner_id) playerIds.add(parseInt(w.partner_id));
            }
        });
        MatchesController._currentMatchPlayerIds = playerIds;
        MatchesController._currentMatchViewerGender = res.data.viewer_gender || 'male';

        let isPast = false;
        let isAuthorized = false;

        const dt = new Date(match.match_datetime.replace(' ', 'T'));
        const dateStr = UI.formatMatchDateOnly(match.match_datetime);
        const timeStr = dt.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });



        // Hide withdrawal warning for past matches
        const withdrawalWarning = document.querySelector('.mv-withdrawal-warning');
        if (withdrawalWarning) {
            const isMatchPast = dt < new Date() || match.status === 'completed' || match.status === 'cancelled';
            const isNotEligible = player_eligible === false;
            withdrawalWarning.style.display = (isMatchPast || isNotEligible) ? 'none' : 'flex';

            // Click warning to show details toast
            withdrawalWarning.style.cursor = 'pointer';
            withdrawalWarning.onclick = () => {
                const toastMsg = `
                    <div style="display: flex; flex-direction: column; gap: 6px; font-family: var(--font); text-align: left; width: 100%;">
                        <div style="font-weight: 800; font-size: 13px; line-height: 1.4; color: #fff; letter-spacing: 0.1px;">No withdrawals from a full match within 5 hours</div>
                        <div dir="rtl" style="font-weight: 700; font-size: 13px; line-height: 1.4; color: #ffb07c; font-family: 'Estedad', sans-serif; text-align: left; margin-top: 2px;">ممنوع الإنسحاب من ماتش كامل العدد خلال ٥ ساعات</div>
                    </div>
                `;
                Toast.show(toastMsg, 'warning', 7000);

                // Align the icon and close button to the top-start for a beautiful multi-line layout
                const newlyCreatedToast = document.querySelector('#toast-container .toast:last-child');
                if (newlyCreatedToast) {
                    newlyCreatedToast.style.alignItems = 'flex-start';
                    newlyCreatedToast.style.padding = '16px 18px';
                    const iconEl = newlyCreatedToast.querySelector('.toast-icon');
                    if (iconEl) {
                        iconEl.style.marginTop = '1px';
                        iconEl.style.fontSize = '16px';
                    }
                    const closeEl = newlyCreatedToast.querySelector('.toast-close');
                    if (closeEl) {
                        closeEl.style.marginTop = '2px';
                    }
                }
            };
        }

        const statusBadgeContainer = document.getElementById('mv-status-badge');

        const titleEl = document.getElementById('mv-title');
        if (titleEl) {
            const isPast = dt < new Date();
            let label = match.status.charAt(0).toUpperCase() + match.status.slice(1);
            if (match.status === 'on_hold') label = 'Pending Partner';
            if (match.status === 'open' && isPast) label = 'Incomplete';
            const statusLabel = label;
            const statusClass = (match.status === 'open' && isPast) ? 'incomplete' : match.status;

            const matchCode = match.match_code || `M-${match.id.toString().padStart(4, '0')}`;

            const venueParts = match.venue_name.split('-');
            const mainTitle = venueParts[0].trim();
            const subTitle = venueParts.length > 1 ? venueParts.slice(1).join('-').trim() : '';

            let typeBadges = '';
            if (match.match_type === 'competition' || match.match_type === 'friendly' || match.gender_type === 'same_gender' || match.gender_type === 'mixed') {
                typeBadges = `<div style="display:flex; align-items:center; gap:8px;">`;
                if (match.match_type === 'competition') {
                    typeBadges += `<span class="status-badge-pill" style="background:rgba(255,139,0,0.08); color:var(--c-orange); border:1px solid rgba(255,139,0,0.2) !important;">🏆 Competition</span>`;
                } else if (match.match_type === 'friendly') {
                    typeBadges += `<span class="status-badge-pill" style="background:rgba(27,82,206,0.08); color:#5B8BFF; border:1px solid rgba(27,82,206,0.2) !important;">🤝 Friendly</span>`;
                }

                if (match.gender_type === 'same_gender') {
                    const isFemale = (match.creator_gender || 'male') === 'female';
                    const genderStr = isFemale ? 'Women' : 'Men';
                    const genderIcon = isFemale ? '👩' : '👨';
                    const genderColor = isFemale ? 'var(--c-pink)' : '#5B8BFF';
                    const genderBorder = isFemale ? 'rgba(216,27,96,0.2)' : 'rgba(27,82,206,0.2)';
                    const genderBg = isFemale ? 'rgba(216,27,96,0.08)' : 'rgba(27,82,206,0.08)';
                    typeBadges += `<span class="status-badge-pill" style="background:${genderBg}; color:${genderColor}; border:1px solid ${genderBorder} !important;">${genderIcon} ${genderStr}</span>`;
                } else if (match.gender_type === 'mixed' || match.gender_type === 'open') {
                    typeBadges += `<span class="status-badge-pill" style="background:rgba(147,112,219,0.08); color:#B39DDB; border:1px solid rgba(147,112,219,0.2) !important;">👫 Mixed</span>`;
                }
                typeBadges += `</div>`;
            }

            titleEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap;">
                    <span id="mv-match-code-copy" class="status-badge-pill" style="background:rgba(255,255,255,0.03); color:var(--c-text-muted); border:1px solid rgba(255,255,255,0.08) !important; justify-content:center; min-width:0; font-family:inherit; cursor:pointer;" title="Click to copy match code">${matchCode}</span>
                    <span class="status-badge-pill status-${statusClass}">${statusLabel}</span>
                    ${typeBadges}
                </div>
                <div id="mv-venue-name" style="font-size: 28px; font-weight: 800; line-height: 1.2; color: #fff;">
                    ${mainTitle} ${subTitle ? `<span style="white-space: nowrap; display: inline-block;"><span style="margin: 0 8px; opacity: 0.2; font-weight: 300;">|</span><span style="font-size: 18px; font-weight: 600; color: #fff; opacity: 0.9;">${subTitle}</span></span>` : ''}
                </div>
            `;

            // Programmatic click binding to bypass DOMPurify event stripping
            const copyCodePill = document.getElementById('mv-match-code-copy');
            if (copyCodePill) {
                copyCodePill.onclick = () => {
                    navigator.clipboard.writeText(matchCode).then(() => {
                        Toast.show('Match code copied to clipboard!', 'success');
                    }).catch(e => {
                        console.error('Copy failed', e);
                        Toast.show('Failed to copy match code');
                    });
                };
            }
        }

        const metaEl = document.getElementById('mv-meta');
        if (metaEl) {
            metaEl.className = 'match-meta-row';
            metaEl.style.flexDirection = 'column';
            metaEl.style.alignItems = 'flex-start';
            metaEl.style.gap = '8px';

            metaEl.innerHTML = `
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
                        <span>🗓</span> ${dateStr} <span style="opacity:0.3; margin:0 2px;">•</span> ${timeStr}
                    </div>
                    ${match.duration_minutes ? `<div style="display:flex; align-items:center; gap:6px;"><span>⏱</span> ${match.duration_minutes} min</div>` : ''}
                    ${match.court_name ? `<div style="display:flex; align-items:center; gap:6px; font-weight:600;"><span style="opacity:0.6;">🎾</span> Court: ${match.court_name}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12px; margin-top:4px; width:100%;">
                    <div style="display:flex; align-items:center; gap:6px; opacity:0.8;">
                        <span>👤</span> by <span style="color:var(--c-text-blue); font-weight:700; margin-left:2px;">${match.creator_nickname || match.creator_name}</span>
                        ${match.creator_code ? `<span style="font-size:10px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:var(--c-text-muted); text-transform:uppercase; font-family:monospace; margin-left:4px;">${match.creator_code}</span>` : ''}
                    </div>
                    <button onclick="ScoringController.reportIssue(${match.id})" style="height:32px; padding:0 18px; background:rgba(255,255,255,0.05); color:var(--c-text-muted); border-radius:10px; font-size:11px; cursor:pointer; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;">
                        <span>🚩</span> Report a problem
                    </button>
                </div>
            `;
        }

        if (statusBadgeContainer) statusBadgeContainer.innerHTML = ''; // Moved into title area

        // Calculate team sums (as per user request)
        const getTeamSum = (teamNo) => {
            const teamSlots = slots.filter(s => parseInt(s.team_no) === teamNo && s.status === 'confirmed');
            if (teamSlots.length === 0) return null;
            return teamSlots.reduce((acc, s) => acc + (parseInt(s.points) || 0) + (parseInt(s.current_buffer) || 0), 0);
        };

        const team1Sum = getTeamSum(1);
        const team2Sum = getTeamSum(2);

        const t1p = document.getElementById('mv-team1-points');
        if (t1p) t1p.innerHTML = safeHTML((team1Sum !== null) ? `${team1Sum} pts` : 'EMPTY');
        const t2p = document.getElementById('mv-team2-points');
        if (t2p) t2p.innerHTML = safeHTML((team2Sum !== null) ? `${team2Sum} pts` : 'EMPTY');

        // Eligibility Range
        const rangeEl = document.getElementById('mv-eligibility-range');
        const rangeValEl = document.getElementById('mv-range-val');
        if (rangeEl) {
            const isMatchPast = dt < new Date() || match.status === 'completed' || match.status === 'cancelled';
            if (isMatchPast) {
                rangeEl.style.display = 'none';
            } else if (rangeValEl && match.eligible_min !== undefined) {
                rangeEl.style.display = 'flex';
                rangeValEl.textContent = `${match.eligible_min} — ${match.eligible_max} pts`;
            }
        }

        // Render slot elements
        [[1, 1], [1, 2], [2, 1], [2, 2]].forEach(([team, slot]) => {
            const s = slots.find(x => parseInt(x.team_no) === team && parseInt(x.slot_no) === slot);
            const el = document.getElementById(`mv-team${team}-slot${slot}`);
            if (!el) return;
            if (s) {
                const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase() || (s.nickname?.[0] || '?').toUpperCase();
                const isMe = parseInt(s.user_id) === myUserId && myUserId > 0;
                const profileUrl = `/p/${s.player_code}`;
                el.className = 'mv-slot' + (isMe ? ' slot-mine' : '');
                if (!isMe) {
                    el.style.cursor = 'pointer';
                    el.onclick = () => Router.navigate(profileUrl);
                } else {
                    el.style.cursor = 'default';
                    el.onclick = null;
                }
                const rawName = s.nickname || s.first_name;
                const isMob = window.innerWidth < 600;
                const limit = isMob ? 10 : 13;
                const displayName = (rawName.length > limit) ? rawName.substring(0, limit - 2) + '..' : rawName;

                el.innerHTML = safeHTML(`
                    <div class="slot-avatar" style="width:48px; height:48px; border-radius:50%; overflow:hidden;">
                        ${UI.getAvatarHtml(s.profile_image_thumb || s.profile_image, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;', initials)}
                    </div>
                    <div class="slot-info">
                        <div class="slot-row-top">
                            <div class="slot-name" title="${rawName}">${displayName}</div>
                            <div class="slot-side-wrapper" style="display:flex; align-items:center; gap:6px;">
                                ${s.playing_side ? `<span class="side-indicator-mini ${s.playing_side}">${s.playing_side[0].toUpperCase()}</span>` : ''}
                            </div>
                        </div>
                        <div class="slot-row-bottom">
                            ${s.player_code ? `<span class="slot-code">${s.player_code}</span>` : '<span></span>'}
                            <span class="slot-points">${(parseInt(s.points) || 0) + (parseInt(s.current_buffer) || 0)} pts</span>
                        </div>
                    </div>`);
            } else {
                el.className = 'mv-slot slot-empty';
                el.style.cursor = 'default';
                el.innerHTML = 'Open';
                el.onclick = null;
            }
        });

        // --- Match Header Toggle for Completed Matches ---
        const headerSection = document.getElementById('mv-header-section');
        const headerToggleWrap = document.getElementById('mv-header-toggle-wrap');
        const isCompleted = match.status === 'completed';
        const hasApprovedScore = (scores || []).some(s => s.status === 'approved');

        if (headerSection && headerToggleWrap) {
            if (isCompleted && hasApprovedScore) {
                // Ensure transitions and overflow styles are initialized
                headerSection.style.transition = 'max-height 0.25s ease-out, opacity 0.25s ease-out';
                headerSection.style.overflow = 'hidden';

                // Hide by default; restore previous preference if user toggled during this session
                const wasExpanded = headerSection.dataset.expanded === 'true';
                if (wasExpanded) {
                    headerSection.style.display = 'block';
                    headerSection.style.maxHeight = 'none';
                    headerSection.style.opacity = '1';
                } else {
                    headerSection.style.display = 'block';
                    headerSection.style.maxHeight = '0px';
                    headerSection.style.opacity = '0';
                }

                headerToggleWrap.innerHTML = '';
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'mv-header-toggle-btn';
                toggleBtn.style.cssText = 'width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 16px; color:var(--c-text-muted); font-size:12px; font-weight:700; cursor:pointer; text-align:center; margin-bottom:16px; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;';
                toggleBtn.innerHTML = wasExpanded ? '▲ Hide details' : '▼ Show details';

                toggleBtn.onclick = () => {
                    const isHidden = headerSection.style.maxHeight === '0px';
                    if (isHidden) {
                        headerSection.style.maxHeight = headerSection.scrollHeight + 'px';
                        headerSection.style.opacity = '1';
                        headerSection.dataset.expanded = 'true';
                        toggleBtn.innerHTML = '▲ Hide details';
                        // Reset to none after transition so resizing works properly
                        const handler = function () {
                            if (headerSection.style.maxHeight !== '0px') {
                                headerSection.style.maxHeight = 'none';
                            }
                            headerSection.removeEventListener('transitionend', handler);
                        };
                        headerSection.addEventListener('transitionend', handler);
                    } else {
                        headerSection.style.maxHeight = headerSection.scrollHeight + 'px';
                        headerSection.offsetHeight; // force reflow
                        headerSection.style.maxHeight = '0px';
                        headerSection.style.opacity = '0';
                        headerSection.dataset.expanded = 'false';
                        toggleBtn.innerHTML = '▼ Show details';
                    }
                };
                headerToggleWrap.appendChild(toggleBtn);
            } else {
                // Not a completed match with approved score — show normally, no toggle
                headerSection.style.display = 'block';
                headerSection.style.maxHeight = 'none';
                headerSection.style.opacity = '1';
                headerSection.style.overflow = '';
                headerSection.style.transition = '';
                headerSection.dataset.expanded = '';
                headerToggleWrap.innerHTML = '';
            }
        }

        // --- Countdown Timer ---
        // Clear any existing countdown interval (from previous match view)
        if (MatchesController._countdownInterval) {
            clearInterval(MatchesController._countdownInterval);
            MatchesController._countdownInterval = null;
        }

        const countdownWrap = document.getElementById('mv-countdown-wrap');
        const countdownValue = document.getElementById('mv-countdown-value');

        if (countdownWrap && countdownValue) {
            const confirmedSlots = slots.filter(s => s.status === 'confirmed').length;
            const allFilled = confirmedSlots >= 4;
            const matchDt = match.match_datetime
                ? new Date(match.match_datetime.replace(' ', 'T'))
                : null;
            const nowMs = Date.now();
            const diffMs = matchDt ? (matchDt.getTime() - nowMs) : -1;
            const tenHoursMs = 10 * 60 * 60 * 1000;

            if (allFilled && matchDt && diffMs > 0 && diffMs <= tenHoursMs) {
                countdownWrap.style.display = 'block';

                const tick = () => {
                    const remaining = matchDt.getTime() - Date.now();
                    if (remaining <= 0) {
                        countdownValue.textContent = '0:00:00';
                        clearInterval(MatchesController._countdownInterval);
                        MatchesController._countdownInterval = null;
                        return;
                    }
                    const totalSec = Math.floor(remaining / 1000);
                    const h = Math.floor(totalSec / 3600);
                    const m = Math.floor((totalSec % 3600) / 60);
                    const s = totalSec % 60;
                    countdownValue.textContent =
                        `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                };

                tick(); // render immediately
                MatchesController._countdownInterval = setInterval(tick, 1000);
            } else {
                countdownWrap.style.display = 'none';
            }
        }

        // Action area
        const actionArea = document.getElementById('mv-action-area');
        const chatArea = document.getElementById('mv-chat-area');
        if (chatArea) chatArea.innerHTML = '';
        if (actionArea) {
            // Unified Policy Violation Area
            const lateWithdrawal = res.data.late_withdrawal;
            const policyArea = document.getElementById('mv-policy-area');
            if (policyArea) {
                let combinedHtml = '';

                // Case 1: Late Withdrawal
                if (lateWithdrawal) {
                    const lwUser = lateWithdrawal.nickname || `${lateWithdrawal.first_name} ${lateWithdrawal.last_name}`;
                    const lwCode = lateWithdrawal.player_code || '';
                    const lwReason = lateWithdrawal.event_data?.reason || '';
                    const profileUrl = `/p/${lwCode}`;
                    const codeTag = lwCode ? `<a href="${profileUrl}" onclick="Router.navigate('${profileUrl}'); return false;" style="display:inline-block; margin-left:4px; padding:2px 8px; background:rgba(247,148,29,0.08); border:1px solid rgba(247,148,29,0.15); border-radius:6px; font-size:10px; font-weight:900; font-family:monospace; color:var(--c-orange); text-transform:uppercase; letter-spacing:0.5px; vertical-align:middle; cursor:pointer; text-decoration:none;">${lwCode}</a>` : '';
                    const clickableUser = lwCode ? `<a href="${profileUrl}" onclick="Router.navigate('${profileUrl}'); return false;" style="color:inherit; text-decoration:none; font-weight:700;">${lwUser}</a>` : `<strong>${lwUser}</strong>`;

                    combinedHtml += `
                            <div style="background:rgba(255,59,48,0.04); border-radius:18px; padding:16px; margin-bottom:16px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                                    <div style="font-size:16px;">⚠️</div>
                                    <div style="font-size:11px; font-weight:800; color:var(--c-red); text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Policy Violation (Late Withdrawal)</div>
                                </div>
                                <div style="font-size:14px; line-height:1.4; color:var(--c-text);">
                                    ${clickableUser}${codeTag} left the match within the 6-hour policy.
                                    ${lwReason ? `<div style="margin-top:8px; padding-left:12px; border-left:2px solid rgba(255,59,48,0.2); font-style:italic; color:var(--c-text-muted); font-size:13px;">"${lwReason}"</div>` : ''}
                                </div>
                                <div style="margin-top:12px; padding-top:10px; font-size:13px; color:var(--c-red); opacity:0.8; font-weight:600;">Admins will investigate, player may face a ban.</div>
                            </div>`;
                }

                // Case 2: Late Cancellation
                if (match.status === 'cancelled' && match.is_policy_violation) {
                    combinedHtml += `
                            <div style="background:rgba(255,59,48,0.04); border-radius:18px; padding:16px; margin-bottom:16px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                                    <div style="font-size:16px;">🚫</div>
                                    <div style="font-size:11px; font-weight:800; color:var(--c-red); text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Policy Violation (Late Cancellation)</div>
                                </div>
                                <div style="font-size:14px; line-height:1.4; color:var(--c-text);">
                                    This match was cancelled within the 6-hour policy by the creator.
                                </div>
                                <div style="margin-top:12px; padding-top:10px; font-size:13px; color:var(--c-red); opacity:0.8; font-weight:600;">Admins will investigate, player may face a ban.</div>
                            </div>`;
                }

                if (policyArea.innerHTML !== combinedHtml) {
                    policyArea.innerHTML = safeHTML(combinedHtml);
                }
            }


            if (match.status === 'cancelled') {
                actionArea.innerHTML = safeHTML(`
                        <div style="background:rgba(255,59,48,0.05); border-left:4px solid var(--c-red); border-radius:16px; padding:16px 20px; display:flex; gap:16px; align-items:flex-start;">
                            <div style="font-size:24px; margin-top:2px;">🚫</div>
                            <div style="flex:1; text-align:left;">
                                <h3 style="font-size:15px; font-weight:800; color:var(--c-red); margin:0 0 4px 0;">Match Cancelled</h3>
                                <p style="font-size:13px; color:var(--c-text); margin:0; line-height:1.4; opacity:0.9;">
                                    ${match.cancellation_reason ? `Reason: <strong>${match.cancellation_reason}</strong>` : 'No specific reason was provided for this cancellation.'}
                                </p>
                        </div>`);
                if (content) content.style.display = 'block';
                if (skeleton) skeleton.style.display = 'none';
                return;
            } else {
                const confirmedCount = slots.filter(s => s.status === 'confirmed').length;
                const isFull = match.status === 'full' || confirmedCount >= 4;

                // Time tracking
                const matchTimeDate = new Date(match.match_datetime.replace(' ', 'T'));
                const now = new Date();
                const diffHrs = (matchTimeDate - now) / (1000 * 60 * 60);
                const isPastMatch = diffHrs <= 0;
                const isLiveMatch = !isPastMatch && match.status !== 'completed';

                // Reset action area visibility and clear form during poll
                MatchesController.hideInvitePartner();

                // ── Phase 7: Post-Match Scoring UI ────────────────────────
                // Only allow scoring if the match reached 'full' or 'completed' status.
                // 'Incomplete' matches (past and still open) cannot be scored.
                const canScore = match.status === 'full' || match.status === 'completed';
                if (isPastMatch && match.status !== 'cancelled' && canScore) {
                    let scoringHtml = '';

                    const getOrdinal = (n) => {
                        const s = ["th", "st", "nd", "rd"];
                        const v = n % 100;
                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                    };

                    if ((scores || []).length > 0) {
                        (scores || []).forEach((s, idx) => {
                            const isSubmitter = parseInt(s.submitted_by_user_id) === myUserId;
                            if (idx > 0) {
                                scoringHtml += `<div style="height:1px; background:rgba(255,255,255,0.08); margin:40px 16px;"></div>`;
                            }

                            // Date formatting helper
                            const formatDate = (dateStr) => {
                                if (!dateStr) return '';
                                const d = new Date(dateStr.replace(' ', 'T'));
                                return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
                            };

                            if (s.status === 'approved') {
                                scoringHtml += `
                                    <div class="approved-score-wrapper" style="margin-bottom:${idx === 1 ? '60px' : '24px'};">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 20px;">
                                            <div style="font-size:15px; color:var(--c-text); font-weight:800; display:flex; align-items:center; gap:6px;">
                                                🏆 ${(scores || []).length > 1 ? `${getOrdinal(idx + 1)} Match Score` : 'Match Score'}
                                            </div>
                                        </div>
                                        ${ScoreUI.renderMatchScore(match, s, slots, false)}
                                    </div>
                                `;
                            } else if (s.status === 'pending') {
                                const submitterName = s.nickname || s.first_name;

                                // Calculate relative times
                                const subDate = new Date(s.created_at.replace(' ', 'T'));
                                const now = new Date();

                                // Submitted Xh ago
                                const subDiffMs = now - subDate;
                                const subDiffHrs = Math.floor(subDiffMs / (1000 * 60 * 60));
                                let subTimeStr = subDiffHrs === 0 ? 'just now' : `${subDiffHrs}h ago`;

                                // Auto-approval countdown
                                const autoDate = new Date(subDate.getTime() + (24 * 60 * 60 * 1000));
                                const autoDiffMs = autoDate - now;
                                const autoDiffHrs = Math.ceil(autoDiffMs / (1000 * 60 * 60));

                                let autoTimeStr = '';
                                if (autoDiffHrs <= 0) autoTimeStr = 'Processing...';
                                else if (autoDiffHrs === 1) autoTimeStr = 'in 1 hour';
                                else autoTimeStr = `in ${autoDiffHrs} hours`;

                                // Determine teams based on composition switch if available
                                let currentTeamNo = user_in_match ? parseInt(user_in_match.team_no) : null;
                                let subTeamNo = null;

                                if (s.composition_json) {
                                    try {
                                        const comp = JSON.parse(s.composition_json);
                                        const myEntry = comp.find(cx => parseInt(cx.user_id) === myUserId);
                                        const subEntry = comp.find(cx => parseInt(cx.user_id) === parseInt(s.submitted_by_user_id));
                                        if (myEntry) currentTeamNo = parseInt(myEntry.team_no);
                                        if (subEntry) subTeamNo = parseInt(subEntry.team_no);
                                    } catch (e) { }
                                }

                                if (!subTeamNo) {
                                    const submitterSlot = slots.find(sx => parseInt(sx.user_id) === parseInt(s.submitted_by_user_id));
                                    if (submitterSlot) subTeamNo = parseInt(submitterSlot.team_no);
                                }

                                const amOpponent = user_in_match && currentTeamNo && subTeamNo && currentTeamNo !== subTeamNo;

                                scoringHtml += `
                                    <div class="pending-score-container" style="position:relative; margin-bottom:32px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 20px;">
                                            <div style="font-size:15px; color:var(--c-text); font-weight:800; display:flex; align-items:center; gap:6px;">
                                                🏆 ${(scores || []).length > 1 ? `${getOrdinal(idx + 1)} Match Score` : 'Match Score'}
                                            </div>
                                            <div class="status-tag pending" style="background:rgba(247,148,29,0.1); color:var(--c-orange); padding:4px 12px; border-radius:20px; font-size:10px; font-weight:800; text-transform:uppercase;">Pending</div>
                                        </div>
                                        
                                        <div style="padding:0 20px; margin-bottom:16px; font-size:11px; color:var(--c-text-muted); display:flex; align-items:center; gap:8px;">
                                            <span style="opacity:0.8;">Submitted by <strong>${isSubmitter ? 'you' : submitterName}</strong></span>
                                            <span style="width:3px; height:3px; background:currentColor; border-radius:50%; opacity:0.2;"></span>
                                            <span style="opacity:0.8;">Auto-approval <strong style="color:var(--c-orange);">${autoTimeStr}</strong></span>
                                        </div>

                                        ${ScoreUI.renderMatchScore(match, s, slots, false)}
                                        
                                        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; margin-top:20px; width:100%;">
                                            ${!isSubmitter ? `
                                                <p style="font-size:11px; color:var(--c-orange); margin:0; font-weight:700;">
                                                    ${amOpponent ? 'Please verify the result' : 'Waiting for opponents to verify...'}
                                                </p>
                                            ` : `
                                                <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%;">
                                                    <p style="font-size:11px; color:var(--c-orange); margin:0; font-weight:700;">Waiting for opponents to verify...</p>
                                                    <button class="btn btn-secondary btn-sm" onclick="ScoringController.deleteScore(${s.id})" style="height:36px; padding:0 16px; font-weight:700; font-size:12px; background:rgba(255,255,255,0.05); color:var(--c-text); border:1px solid rgba(255,255,255,0.1);">Cancel Submission</button>
                                                </div>
                                            `}
                                        </div>
                                        
                                        ${amOpponent ? `
                                            <div class="approval-actions" style="margin-top:24px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                                <button class="btn btn-success" onclick="ScoringController.approveScore(${s.id})" style="height:44px; font-weight:700;">Approve Result</button>
                                                <button class="btn btn-secondary" onclick="ScoringController.disputeScore(${s.id})" style="height:44px; font-weight:700;">Dispute Result</button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            } else if (s.status === 'disputed') {
                                scoringHtml += `
                                    <div class="disputed-score-container" style="margin-bottom:32px; border:1px solid rgba(255,59,48,0.2); border-radius:var(--r-lg); padding:4px; background:rgba(255,59,48,0.02);">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:12px 16px 0;">
                                            <div style="font-size:15px; color:var(--c-text); font-weight:800; display:flex; align-items:center; gap:6px;">
                                                🏆 ${(scores || []).length > 1 ? `${getOrdinal(idx + 1)} Match Score` : 'Match Score'}
                                            </div>
                                            <div class="status-tag disputed" style="background:rgba(255,59,48,0.1); color:var(--c-red); padding:4px 12px; border-radius:20px; font-size:10px; font-weight:800; text-transform:uppercase;">Disputed</div>
                                        </div>
                                        
                                        <div style="opacity:0.6; filter:grayscale(0.5);">
                                            ${ScoreUI.renderMatchScore(match, s, slots, false)}
                                        </div>

                                        <div style="padding:16px; text-align:center;">
                                            <p style="font-size:12px; color:var(--c-text-muted); margin-bottom:12px;">This result is under review by admins.</p>
                                            ${isSubmitter ? `
                                                <button class="btn btn-danger btn-sm" onclick="ScoringController.deleteScore(${s.id})" style="width:100%; height:44px; margin-bottom:12px; font-weight:700;">Delete Submission</button>
                                            ` : ''}
                                            ${(user_in_match && approvedCount < 2) ? `<button class="btn btn-secondary btn-sm" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)" style="width:100%; height:44px;">Submit Correct Score</button>` : ''}
                                        </div>
                                    </div>
                                `;
                            }
                        });
                    } else if (user_in_match) {
                        // No scores yet
                        scoringHtml = `
                            <div class="results-banner">
                                <div class="results-title" style="margin-bottom:12px;">Match Ended</div>
                                <button class="btn btn-primary" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)">Submit Match Result</button>
                                <p style="font-size:11px; color:var(--c-text-dim); text-align:center; margin-top:12px;">Record the score to update your rankings.</p>
                            </div>
                        `;
                    }

                    // Secondary match submission (Multi-score support)
                    if (user_in_match && (scores || []).length === 1) {
                        scoringHtml += `
                            <div style="margin-top:32px; padding-top:24px; text-align:center; border-top:1px dashed rgba(255,255,255,0.08);">
                                <div style="font-size:11px; font-weight:900; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; opacity:0.6;">Played another match?</div>
                                <a href="javascript:void(0)" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)" style="display:inline-flex; align-items:center; gap:6px; color:var(--c-text-blue); font-size:13px; font-weight:800; text-decoration:none; cursor:pointer;">
                                    Submit Score #2
                                    <svg style="width:12px; height:12px; color:var(--c-text-blue);" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                        `;
                    }



                    actionArea.innerHTML = safeHTML(`<div style="margin-top:40px;">${scoringHtml}</div>`);
                    MatchesController._currentMatchData = match; // Store for controller use

                } else if (pending_for_me) {
                    const reqName = pending_for_me.req_nickname || pending_for_me.req_first;
                    const reqFullName = `${pending_for_me.req_first} ${pending_for_me.req_last}`.trim();
                    const reqInitial = (pending_for_me.req_first?.[0] || '?').toUpperCase();
                    const reqAvatar = (pending_for_me.req_profile_thumb || pending_for_me.req_profile)
                        ? `<img src="${CONFIG.ASSET_BASE}/${pending_for_me.req_profile_thumb || pending_for_me.req_profile}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--c-bg-secondary);border-radius:50%;font-weight:700;font-size:16px;">${reqInitial}</div>`;

                    actionArea.innerHTML = safeHTML(`
                        <div style="background:var(--c-bg-card); border-radius:var(--r-lg); padding:20px; box-shadow:0 8px 24px rgba(0,0,0,0.15);">
                            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                                <div style="width:52px; height:52px; border:2px solid var(--c-orange); border-radius:50%; padding:2px; flex-shrink:0;">
                                    ${reqAvatar}
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:11px; font-weight:800; color:var(--c-orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Team Join Request</div>
                                    <div style="font-size:16px; font-weight:700; color:var(--c-text);">
                                        ${reqName} <span style="font-size:13px; font-weight:400; color:var(--c-text-muted); margin-left:4px;">(${reqFullName})</span>
                                    </div>
                                </div>
                            </div>
                            <p style="font-size:13px; color:var(--c-text-muted); margin-bottom:20px; line-height:1.5;">
                                wants you to join this match as their partner. Do you want to play together?
                            </p>
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center; margin-bottom:12px;"></div>
                            <div style="display:flex; gap:12px;">
                                <button onclick="MatchesController.approve(${pending_for_me.id}, ${match.id}, this)" class="btn btn-success" style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px;">
                                    <span style="font-size:20px;">✅</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Approve</span>
                                </button>
                                <button onclick="MatchesController.deny(${pending_for_me.id}, ${match.id}, this)"    class="btn btn-danger"  style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px; color:var(--c-orange); border-color:rgba(247, 148, 29, 0.3); background:rgba(247, 148, 29, 0.1);">
                                    <span style="font-size:20px;">✗</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Deny</span>
                                </button>
                                <button onclick="MatchesController.block(${pending_for_me.id}, ${match.id}, this)"   class="btn btn-danger"  style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px;">
                                    <span style="font-size:20px;">🚫</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Block</span>
                                </button>
                            </div>
                        </div>`);
                } else if (my_pending_request) {
                    const partnerName = my_pending_request.par_nickname || my_pending_request.par_first;
                    actionArea.innerHTML = safeHTML(`
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>
                            <div style="flex-direction:column; background:rgba(247,148,29,0.06); border-radius:var(--r-md); padding:16px; gap:12px; display:flex;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;">
                                    <div style="font-size:14px; font-weight:700; color:var(--c-orange);"><span style="margin-right:8px;">⏳</span>Invitation sent to <strong>${partnerName}</strong></div>
                                    <button onclick="MatchesController.cancelRequest(${my_pending_request.id}, ${match.id}, this)" style="padding:7px 12px; background:var(--c-bg-secondary); border:none; border-radius:var(--r-sm); color:var(--c-text); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font); white-space:nowrap;">Cancel</button>
                                </div>
                                <div style="font-size:12px; color:var(--c-text-muted); line-height:1.4; pt:10px; margin-top:4px;">
                                    <strong>Private Draft:</strong> This match is hidden from other players until your partner responds or you cancel this invitation.
                                </div>
                            </div>
                        </div>`);
                } else if (user_in_match) {
                    const isCreator = !!is_creator;
                    const isLate = diffHrs < 6;

                    const myTeam = parseInt(user_in_match.team_no);
                    const teamSlots = slots.filter(s => parseInt(s.team_no) === myTeam && s.status === 'confirmed');
                    const hasPartner = teamSlots.length > 1;

                    const isPast = (new Date(match.match_datetime.replace(' ', 'T')) - new Date()) <= 0;
                    const isFull = match.status === 'full' || match.status === 'completed';
                    const showBanner = !isPast || isFull;

                    let actionHtml = `<div style="display:flex; flex-direction:column; gap:10px;">`;
                    actionHtml += `<div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>`;

                    if (showBanner) {
                        actionHtml += `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(76,175,80,0.08); border-radius:var(--r-md); padding:12px 16px;">`;
                        actionHtml += `<div style="font-size:13px; font-weight:600; color:var(--c-green);"><span style="margin-right:6px;">✅</span>${isPast ? 'You were in this match' : 'You are in this match'}</div>`;
                    } else {
                        actionHtml += `<div style="display:none;">`;
                    }
                    actionHtml += `<div style="display:flex; gap:8px;">`;

                    if (isLiveMatch && !isCreator) {
                        actionHtml += `<button onclick="MatchesController.leaveMatch(${match.id}, this, ${isLate}, ${isFull})" style="padding:7px 12px; background:var(--c-bg-secondary); border:none; border-radius:var(--r-sm); color:var(--c-orange); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">🚪 Leave</button>`;
                    }
                    if (isCreator && isLiveMatch) {
                        actionHtml += `<button id="mv-cancel-btn" onclick="MatchesController.cancelMatch(${match.id}, this, ${isLate}, ${isFull})" style="padding:7px 12px; background:rgba(241,90,41,0.1); border:none; border-radius:var(--r-sm); color:var(--c-red); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">✕ Cancel</button>`;
                    }
                    actionHtml += `</div></div></div>`;
                    actionArea.innerHTML = safeHTML(actionHtml);
                } else if (my_waitlist_entry) {
                    const isSolo = !my_waitlist_entry.partner_id;
                    const otherPerson = (parseInt(my_waitlist_entry.requester_id) === myUserId)
                        ? (my_waitlist_entry.par_nickname || my_waitlist_entry.par_first)
                        : (my_waitlist_entry.req_nickname || my_waitlist_entry.req_first);
                    const wlNames = isSolo ? 'You are in the waitlist' : `You & ${otherPerson} are in line`;

                    const s11 = slots.find(s => s.team_no == 1 && s.slot_no == 1);
                    const s12 = slots.find(s => s.team_no == 1 && s.slot_no == 2);
                    const s21 = slots.find(s => s.team_no == 2 && s.slot_no == 1);
                    const s22 = slots.find(s => s.team_no == 2 && s.slot_no == 2);
                    const canJumpIn = isSolo ? (slots.length < 4) : ((!s11 && !s12) || (!s21 && !s22));

                    actionArea.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(27,82,206,0.06); border-radius:var(--r-md); padding:12px 16px;">
                                <div style="font-size:13px; font-weight:600; color:var(--c-text-muted);"><span style="margin-right:6px;">🕒</span>${wlNames}</div>
                                <div style="display:flex; gap:8px;">
                                    ${(isLiveMatch && canJumpIn) ? `<button onclick="MatchesController.jumpIn(${my_waitlist_entry.id}, ${match.id}, this)" style="padding:7px 12px; background:#1D8348; border:none; border-radius:var(--r-sm); color:#fff; font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font); box-shadow:0 2px 8px rgba(29,131,72,0.2);">⚡ Jump In</button>` : ''}
                                    ${isLiveMatch ? `<button onclick="MatchesController.withdraw(${my_waitlist_entry.id}, ${match.id}, this)" style="padding:7px 12px; background:var(--c-bg-secondary); border:none; border-radius:var(--r-sm); color:var(--c-text); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">Withdraw</button>` : '<span style="font-size:11px; color:var(--c-text-muted); letter-spacing:0.5px; opacity:0.8;">MATCH ENDED</span>'}
                                </div>
                            </div>
                        </div>`;
                } else {
                    const slotsCount = slots.length;

                    let joinHtml = `<div style="display:flex; flex-direction:column; gap:10px;">`;
                    joinHtml += `<div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>`;

                    if (isLiveMatch) {
                        if (player_eligible === false) {
                            joinHtml += `<div style="text-align:center; padding:16px; background:rgba(255,100,100,0.05); border-radius:var(--r-md);">
                                            <div style="font-size:13px; font-weight:700; color:var(--c-red); letter-spacing:0.5px;">🚫 You are not eligible to join this match</div>
                                            <div style="font-size:11px; color:var(--c-text-muted); margin-top:4px;">${eligibility_reason || 'Check the required gender or points range.'}</div>
                                            <button onclick="Router.navigate('/rules')" class="btn btn-secondary" style="width:auto; padding:12px 20px; font-size:14px; display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); margin: 12px auto 0;">View Eligibility Rules</button>
                                         </div>`;
                        } else {
                            joinHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
                            if (isFull) {
                                joinHtml += `<button id="mv-join-solo-btn" onclick="MatchesController.joinWaitlist(${match.id}, this)" class="btn btn-secondary" style="padding:14px; font-size:14px;">🕒 Join Waitlist</button>`;
                                joinHtml += `<button id="mv-join-team-btn" onclick="MatchesController.showInvitePartner(true)" class="btn btn-secondary" style="padding:14px; font-size:14px;">🕒 Join as Team</button>`;
                            } else {
                                joinHtml += `<button id="mv-join-solo-btn" onclick="MatchesController.joinSolo(${match.id}, this)" class="btn btn-primary" style="padding:14px; font-size:14px;">⚡ Join Solo</button>`;
                                joinHtml += `<button id="mv-join-team-btn" onclick="MatchesController.showInvitePartner(false)" class="btn btn-secondary" style="padding:14px; font-size:14px;">👥 Join Team</button>`;
                            }
                            joinHtml += `</div>`;
                        }
                    } else {
                        joinHtml += `<div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:var(--r-md);">
                                        <div style="font-size:13px; font-weight:700; color:var(--c-text-muted); letter-spacing:1px; text-transform:uppercase;">🏁 Match Ended</div>
                                     </div>`;
                    }

                    joinHtml += `</div>`;
                    actionArea.innerHTML = safeHTML(joinHtml);
                }

                // Phase 5: Chat access logic
                // Phase 5: Chat access logic
                isPast = (new Date(match.match_datetime.replace(' ', 'T')) - new Date()) <= 0;
                const isWaitlisted = !!(my_waitlist_entry || my_pending_request);
                isAuthorized = !!(user_in_match || isWaitlisted || is_creator);

                let chatBtnHtml = '';
                const unreadCount = res.data.unread_count || 0;
                const badgeHtml = unreadCount > 0 ? `
                    <span class="chat-unread-badge" style="background:var(--c-red); color:#fff; font-size:12px; font-weight:900; padding:3px 9px; border-radius:12px; min-width:24px; box-shadow:0 3px 12px rgba(241, 90, 41, 0.5); border:1px solid rgba(255,255,255,0.15);">
                        ${unreadCount > 99 ? '99+' : unreadCount}
                    </span>` : '';

                if (isAuthorized) {
                    chatBtnHtml += `
                        <!-- Premium Chat Button (Obvious Modern Glass Effect) -->
                        <button type="button" onclick="ChatController.open(${match.id}); return false;" class="btn" style="width:100%; padding:18px; display:flex; align-items:center; justify-content:center; gap:12px; font-weight:800; border-radius:18px; background:linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%); border:1px solid rgba(255, 255, 255, 0.12); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); color:#fff; box-shadow:0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 8px rgba(27, 82, 206, 0.15); text-transform:uppercase; letter-spacing:1.5px; position:relative; transition: all 0.25s ease;" onmouseover="this.style.background='linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'; this.style.boxShadow='0 12px 40px 0 rgba(27, 82, 206, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.3), inset 0 -1px 10px rgba(27, 82, 206, 0.25)';" onmouseout="this.style.background='linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)'; this.style.borderColor='rgba(255, 255, 255, 0.12)'; this.style.boxShadow='0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 8px rgba(27, 82, 206, 0.15)';" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                            <img src="assets/icons/chat_3d.png" style="width:24px; height:24px; object-fit:contain;" alt="Chat"> 
                            <span style="background: linear-gradient(to right, #ffffff, #a5c2ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Match Chat</span>
                            ${badgeHtml}
                        </button>
                    `;
                }

                // Sub-Actions Grid (Always visible)
                chatBtnHtml += `
                    <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 32px 0 24px;"></div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                        ${match.venue_location_link ? `
                        <a href="${match.venue_location_link}" target="_blank" rel="noopener noreferrer" class="btn" style="padding:14px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(27,82,206,0.08); color:#7da7ff; border-radius:14px; backdrop-filter: blur(8px); transition: all 0.2s;" onmouseover="this.style.background='rgba(27,82,206,0.15)'" onmouseout="this.style.background='rgba(27,82,206,0.08)'">
                            <img src="assets/icons/location_3d.png" style="width:18px; height:18px; object-fit:contain;" alt="Location"> Location
                        </a>` : ''}
                        <button onclick="MatchesController.share(${match.id}, '${match.match_code}')" class="btn" style="padding:14px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(247,148,29,0.08); color:var(--c-orange); border-radius:14px; backdrop-filter: blur(8px); transition: all 0.2s;" onmouseover="this.style.background='rgba(247,148,29,0.15)'" onmouseout="this.style.background='rgba(247,148,29,0.08)'">
                            <img src="assets/icons/share_3d.png" style="width:18px; height:18px; object-fit:contain;" alt="Share"> Share
                        </button>
                    </div>
                `;

                if (chatArea) {
                    chatArea.innerHTML = safeHTML(`<div style="margin-bottom:24px; padding: 0 4px;">${chatBtnHtml}</div>`);
                }
            }
        }

        const wlSection = document.getElementById('mv-waiting-section');
        const wlList = document.getElementById('mv-waiting-list');
        const activeWl = (waiting_list || []).filter(w => w.request_status === 'approved');

        const isWaitlisted = my_waitlist_entry || my_pending_request;
        const isMatchPast = (new Date(match.match_datetime.replace(' ', 'T')) - new Date()) <= 0;
        if (!isMatchPast && match.status !== 'cancelled' && (is_creator || user_in_match || isWaitlisted) && activeWl.length > 0 && wlSection && wlList) {
            wlSection.style.display = 'block';
            wlList.innerHTML = safeHTML(activeWl.map(w => {
                const isSolo = !w.partner_id;
                const reqName = w.req_nickname || w.req_first;
                const parName = w.par_nickname || w.par_first;
                const names = isSolo ? reqName : `${reqName} & ${parName}`;
                let status = 'In Queue';
                let sClass = 'badge-primary';

                if (w.request_status === 'pending') {
                    status = 'Waiting for partner approval';
                    sClass = 'badge-orange';
                } else if (w.request_status === 'denied') {
                    status = 'Denied';
                    sClass = 'badge-red';
                } else if (w.request_status === 'cancelled') {
                    status = 'Cancelled';
                    sClass = 'badge-muted';
                }

                return `
                <div class="wl-row" style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <div style="font-size:14px; font-weight:700; color:var(--c-text); display:flex; align-items:center; gap:8px;">
                            ${names}
                            ${isSolo ? (w.req_side ? `<span class="side-indicator-mini ${w.req_side}" style="position:static; width:18px; height:18px; font-size:10px;">${w.req_side[0].toUpperCase()}</span>` : '') : ''}
                        </div>
                        <div style="font-size:12px; color:var(--c-text-muted); margin-top:2px;">${isSolo ? 'Solo Request' : 'Team Request'}</div>
                    </div>
                    <div class="badge ${sClass}" style="font-size:10px; padding:4px 8px;">${status}</div>
                </div>`;
            }).join(''));
        } else if (wlSection) {
            wlSection.style.display = 'none';
        }

        if (content) content.style.display = 'block';
        if (skeleton) skeleton.style.display = 'none';

        if (!isAuthorized) {
            ChatController.stop();
        }

        MatchesController.initJoinForm();

        if (typeof ChatController !== 'undefined' && ChatController._isShowing) {
            ChatController.renderPlayerBar();
        }

        return { id: parseInt(match.id), isAuthorized, isChatAllowed: isAuthorized };
    },

    share: function (id, code) {
        const url = (CONFIG.LIVE_URL || window.location.origin) + '/matches/' + code;
        const isNativeApp = document.body.classList.contains('is-mobile-app');

        if (isNativeApp && navigator.share) {
            // Native mobile app: use share menu, no toast
            navigator.share({
                title: 'Join me for a Padel match!',
                text: 'Check out this match on Padeladd: ' + code,
                url: url
            }).catch(err => {
                if (err.name !== 'AbortError') console.error(err);
            });
        } else {
            // Regular browser (Desktop or Mobile): copy link + toast
            navigator.clipboard.writeText(url).then(() => {
                Toast.show('Match link copied', 'success');
            });
        }
    },





    initJoinForm: function () {
        const form = document.getElementById('mv-join-team-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                MatchesController.submitTeamRequest();
            };
        }

        const input = document.getElementById('mv-partner-code-input');
        const help = document.getElementById('mv-partner-help');
        // Badge references removed.

        if (!input || !help) return;

        let lookupTimeout = null;

        // Badge removed. Form resets happen below.
        input.oninput = (e) => {
            clearTimeout(lookupTimeout);
            const q = e.target.value.trim();
            help.textContent = "Your partner will receive a request to approve.";
            help.style.color = 'var(--c-text-muted)';
            input.classList.remove('error');

            if (q.length >= 3 && q.length <= 7) {
                help.textContent = "Looking up player...";
                lookupTimeout = setTimeout(async () => {
                    const res = await API.post('/profile/check_code', { code: q });
                    if (res && res.success) {
                        const foundId = parseInt(res.data.user_id);
                        if (MatchesController._currentMatchPlayerIds && MatchesController._currentMatchPlayerIds.has(foundId)) {
                            if (badge) badge.style.display = 'none';
                            help.textContent = "This player is already in the match";
                            help.style.color = "var(--c-danger)";
                            input.classList.add('error');
                            return;
                        }

                        input.value = q;
                        help.innerHTML = safeHTML(`✓ Found player: <strong style="color:var(--c-text); margin-left:4px;">${res.data.name}</strong>`);
                        help.style.color = "var(--c-primary)";
                    } else {
                        help.textContent = (res && res.message) ? res.message : "Player not found";
                        help.style.color = "var(--c-danger)";
                        input.classList.add('error');
                    }
                }, 400);
            } else if (q.length > 7) {
                e.target.value = q.substring(0, 7);
                e.target.dispatchEvent(new Event('input'));
            } else {
                if (badge) badge.style.display = 'none';
            }
        };
    },

    showInvitePartner: function (isFull = false) {
        // Cancel solo selection mode if active
        MatchesController.cancelSelectionMode();

        const form = document.getElementById('mv-join-team-form');
        if (!form) return;

        // Inject/update the waitlist notice at top of team form
        let noticeEl = document.getElementById('mv-team-waitlist-notice');
        if (isFull) {
            if (!noticeEl) {
                noticeEl = document.createElement('div');
                noticeEl.id = 'mv-team-waitlist-notice';
                noticeEl.style.cssText = 'background:rgba(247,148,29,0.07); border:1px solid rgba(247,148,29,0.2); border-radius:10px; padding:10px 14px; font-size:12px; color:var(--c-orange); font-weight:600; margin-bottom:14px; line-height:1.4;';
                noticeEl.innerHTML = '🕒 <strong>Match is full.</strong> Your request will be added to the waitlist. You and your partner will be notified when a team slot opens up.';
                form.insertBefore(noticeEl, form.firstChild);
            } else {
                noticeEl.style.display = 'block';
            }
        } else if (noticeEl) {
            noticeEl.style.display = 'none';
        }

        form.style.display = 'block';

        const area = document.getElementById('mv-action-area');
        if (area) area.style.display = 'none';

        const input = document.getElementById('mv-partner-code-input');
        if (input) {
            input.focus();
            // Scroll to form on mobile
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    },

    resetInviteForm: function () {
        const input = document.getElementById('mv-partner-code-input');
        const help = document.getElementById('mv-partner-help');
        const btn = document.querySelector('#mv-join-team-form button[type="submit"]');

        if (input) {
            input.value = '';
            input.classList.remove('error');
        }
        if (help) {
            help.textContent = "Your partner will receive a request to approve.";
            help.style.color = 'var(--c-text-muted)';
        }
        if (btn) {
            btn.innerHTML = 'Send Request';
            btn.disabled = false;
        }
    },

    hideInvitePartner: function () {
        const form = document.getElementById('mv-join-team-form');
        if (form) form.style.display = 'none';

        const area = document.getElementById('mv-action-area');
        if (area) area.style.display = 'block';

        MatchesController.resetInviteForm();
    },


    cancelSelectionMode: function () {
        if (this._soloSelectionTimeout) {
            clearTimeout(this._soloSelectionTimeout);
            this._soloSelectionTimeout = null;
        }

        const soloBtn = document.getElementById('mv-join-solo-btn');
        if (soloBtn) {
            soloBtn.style.display = 'block';
            soloBtn.disabled = false;
            // Restore icon/text based on context
            if (soloBtn.innerText.includes('Waitlist')) {
                soloBtn.innerText = '🕒 Join Waitlist';
            } else {
                soloBtn.innerText = '⚡ Join Solo';
            }
        }

        const teamBtn = document.getElementById('mv-join-team-btn');
        if (teamBtn) {
            teamBtn.style.display = 'block';
        }

        const emptySlots = document.querySelectorAll('.mv-slot.slot-empty');
        emptySlots.forEach(el => {
            el.innerText = 'Open';
            el.style.cursor = 'default';
            el.classList.remove('pulse-selection');
            el.onclick = null;
        });
    },

    // ── Actions ──────────────────────────────────────────
    joinSolo: async function (match_id, btn) {
        // Hide team form if open
        const teamForm = document.getElementById('mv-join-team-form');
        if (teamForm) teamForm.style.display = 'none';

        // Hide team button to focus on solo selection
        const teamBtn = document.getElementById('mv-join-team-btn');
        if (teamBtn) teamBtn.style.display = 'none';

        // If match is full, join waitlist immediately
        const slotsCount = MatchesController._currentMatchSlotsCount || 0;
        if (slotsCount >= 4) {
            return MatchesController.performJoinSolo(match_id, btn);
        }

        // Otherwise, enter selection mode
        btn.disabled = true;
        btn.innerText = 'Select a spot ↑';

        // Find all empty slots and make them interactive
        const emptySlots = document.querySelectorAll('.mv-slot.slot-empty');
        emptySlots.forEach(el => {
            el.innerText = 'Join here';
            el.style.cursor = 'pointer';
            el.classList.add('pulse-selection');

            // Extract team/slot from ID e.g. mv-team1-slot2
            const parts = el.id.split('-');
            const team = parseInt(parts[1].replace('team', ''));
            const slot = parseInt(parts[2].replace('slot', ''));

            el.onclick = () => {
                if (MatchesController._soloSelectionTimeout) {
                    clearTimeout(MatchesController._soloSelectionTimeout);
                    MatchesController._soloSelectionTimeout = null;
                }
                MatchesController.performJoinSolo(match_id, el, team, slot);
            };
        });

        // --- NEW: 3s Auto-dismiss ---
        if (this._soloSelectionTimeout) clearTimeout(this._soloSelectionTimeout);
        this._soloSelectionTimeout = setTimeout(() => {
            this.cancelSelectionMode();
        }, 3000);
    },

    performJoinSolo: async function (match_id, btn, team_no = null, slot_no = null, force_waitlist = false) {
        let oldText = btn ? btn.innerText : '🎾 Join Solo';

        let sideOverride = null;
        if (team_no && slot_no && !force_waitlist) {
            const partner = (MatchesController._currentMatchSlots || []).find(s => parseInt(s.team_no) === team_no);
            const mySide = MatchesController._currentUserSide;
            if (partner && partner.playing_side && mySide && partner.playing_side !== 'flexible' && mySide !== 'flexible') {
                if (partner.playing_side === mySide) {
                    const result = await ConfirmModal.show({
                        title: 'Side Conflict',
                        message: `You are both ${mySide} players. How would you like to proceed?`,
                        confirmText: 'Join as Flexible',
                        thirdText: 'Join Waiting List',
                        cancelText: 'Cancel'
                    });

                    if (result === 'third') {
                        MatchesController.cancelSelectionMode();
                        return MatchesController.joinWaitlist(match_id, btn);
                    }
                    if (!result) {
                        MatchesController.cancelSelectionMode();
                        return;
                    }
                    sideOverride = 'flexible';
                }
            }
        }

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/join-solo', {
            match_id,
            team_no,
            slot_no,
            playing_side: sideOverride,
            force_waitlist: force_waitlist
        });


        console.log('[API MatchJoinSolo]', res);

        if (res && res.success) {
            Toast.show('You joined the match!', 'success');
            SoundManager.play('success');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Join failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Join failed', 'error');
        }
    },

    joinWaitlist: async function (match_id, btn) {
        return MatchesController.performJoinSolo(match_id, btn, null, null, true);
    },

    submitTeamRequest: async function () {

        const form = document.getElementById('mv-join-team-form');
        const btn = form ? form.querySelector('button[type="submit"]') : null;
        const oldText = btn ? btn.innerText : 'Send Request';

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const match_id = MatchesController._currentMatchId;
        const code = document.getElementById('mv-partner-code-input')?.value.trim();

        if (!code) {
            MatchesController.showActionError('Enter partner player XCode!');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show('Enter partner player XCode', 'warning');
            return;
        }

        const res = await API.post('/match/join-team', { match_id, partner_player_code: code });
        console.log('[API MatchJoinTeam]', res);

        if (res && res.success) {
            Toast.show('Request sent! Waiting for partner approval.', 'success');
            if (form) form.style.display = 'none';
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Request failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Request failed', 'error');
        }
    },

    showActionError: function (msg) {
        const container = document.getElementById('mv-action-msg');
        if (!container) return;
        container.textContent = msg;
        container.style.display = 'block';
        container.style.background = 'rgba(244, 67, 54, 0.1)';
        container.style.color = 'var(--c-danger)';
        container.style.border = '1px solid rgba(244, 67, 54, 0.2)';

        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    },

    approve: async function (wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '✅ Approve';

        const req = (MatchesController._currentMatchWaitlist || []).find(w => parseInt(w.id) === wl_id);
        let sideOverride = null;
        if (req && req.req_side && req.par_side && req.req_side !== 'flexible' && req.par_side !== 'flexible') {
            if (req.req_side === req.par_side) {
                const confirmed = await ConfirmModal.show({
                    title: 'Side Conflict',
                    message: `You are both ${req.par_side} players. Do you want to join as flexible for this match?`,
                    confirmText: 'Join as Flexible',
                    cancelText: 'Cancel'
                });
                if (!confirmed) return;
                sideOverride = 'flexible';
            }
        }

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/approve', {
            waiting_list_id: wl_id,
            playing_side: sideOverride
        });

        console.log('[API MatchApprove]', res);

        if (res && res.success) {
            Toast.show('Approved! Both players are now in the match.', 'success');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Approve failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Approve failed', 'error');
        }
    },

    deny: async function (wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '✗ Deny';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/deny', { waiting_list_id: wl_id });
        console.log('[API MatchDeny]', res);

        if (res && res.success) {
            Toast.show('Request denied.', 'info');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Deny failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Deny failed', 'error');
        }
    },

    block: async function (wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '🚫 Block';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/block', { waiting_list_id: wl_id });
        console.log('[API MatchBlock]', res);

        if (res && res.success) {
            Toast.show(res.message, 'info');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Block failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Block failed', 'error');
        }
    },

    cancelRequest: async function (wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : 'Cancel Request';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/cancel', { waiting_list_id: wl_id });
        console.log('[API MatchCancelRequest]', res);

        if (res && res.success) {
            Toast.show('Invitation cancelled.', 'info');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Cancel failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Cancel failed', 'error');
        }
    },

    withdraw: async function (wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : 'Withdraw';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/withdraw', { waiting_list_id: wl_id });
        console.log('[API MatchWithdraw]', res);

        if (res && res.success) {
            Toast.show('Withdrawn from waiting list', 'success');
            await MatchesController.loadDetails({ match_id }, true);
        } else {
            MatchesController.showActionError(res ? res.message : 'Error withdrawing');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show(res ? res.message : 'Error withdrawing', 'error');
        }
    },

    leaveMatch: async function (match_id, btn, isLate, isFull) {
        let modalOpts = {
            title: 'Leave Match?',
            message: 'Are you sure you want to leave this match?',
            confirmText: 'Yes, Leave Match',
            cancelText: 'No, Stay',
            type: 'info'
        };

        if (isLate && isFull) {
            modalOpts = {
                title: 'Reason for leaving',
                message: '<div style="color:var(--c-red); font-weight:600; font-size:13px; margin-bottom:12px; background:rgba(239,68,68,0.1); padding:10px; border-radius:8px;">⚠️ Warning: You are leaving within 5 hours of the match.</div>',
                confirmText: 'Confirm Withdrawal',
                cancelText: 'Don\'t Leave',
                type: 'warning',
                showInput: true,
                inputPlaceholder: 'Please provide a reason...',
                inputMaxLength: 200,
                tipText: 'Providing a reason helps avoid potential bans.'
            };
        }

        const reasonOrConfirmed = await ConfirmModal.show(modalOpts);
        if (reasonOrConfirmed === false) return;

        let oldText = btn ? btn.innerText : '🚪 Leave Match';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const reason = (typeof reasonOrConfirmed === 'string') ? reasonOrConfirmed : '';

        const res = await API.post('/match/withdraw', {
            match_id,
            reason: reason
        });

        console.log('[API LeaveMatch]', res);

        if (res && res.success) {
            const msg = res.data?.is_late
                ? 'You have left the match (late withdrawal — within 5 hours).'
                : 'You have left the match.';
            Toast.show(msg, 'success');
            await MatchesController.loadDetails({ match_id }, true);

        } else {
            MatchesController.showActionError(res ? res.message : 'Could not leave match');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show(res ? res.message : 'Could not leave match', 'error');
        }
    },

    cancelMatch: async function (match_id, btn, isLate, isFull) {
        let modalOpts = {
            title: 'Cancel Match?',
            message: 'This action cannot be undone and other players will be notified.',
            confirmText: 'Yes, Cancel Match',
            cancelText: 'No, Keep it',
            type: 'info'
        };

        // Late cancellation warning for full matches
        if (isLate && isFull) {
            modalOpts = {
                title: 'Reason for leaving',
                message: '<div style="color:var(--c-red); font-weight:600; font-size:13px; margin-bottom:12px; background:rgba(239,68,68,0.1); padding:10px; border-radius:8px;">⚠️ Warning: You are cancelling within 5 hours of the match.</div>',
                confirmText: 'Confirm Cancellation',
                cancelText: 'Don\'t Cancel',
                type: 'warning',
                showInput: true,
                inputPlaceholder: 'Please provide a reason...',
                inputMaxLength: 200,
                tipText: 'Providing a reason helps avoid potential bans.'
            };
        }

        const reasonOrConfirmed = await ConfirmModal.show(modalOpts);
        if (reasonOrConfirmed === false) return;

        let oldText = btn ? btn.innerText : '✕ Cancel Match';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        // If it was a simple confirmation, reasonOrConfirmed is 'true'. 
        // If it was an input modal, it's the string value.
        const reason = (typeof reasonOrConfirmed === 'string') ? reasonOrConfirmed : '';

        const res = await API.post('/match/cancel', {
            match_id,
            reason: reason
        });
        console.log('[API CancelMatch]', res);

        if (res && res.success) {
            Router.navigate('/matches/my');
        } else {
            MatchesController.showActionError(res ? res.message : 'Could not cancel match');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
        }
    },

    jumpIn: async function (waitlist_id, match_id, btn) {
        let oldText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '…';

        const res = await API.post('/match/jump-in', { waitlist_id, match_id });
        if (res && res.success) {
            Toast.show('You joined the match! ⚡', 'success');
            // Refresh view
            await MatchesController.loadDetails({ match_id: match_id }, true);
        } else {
            Toast.show(res ? res.message : 'Could not jump in', 'error');
            btn.disabled = false;
            btn.innerText = oldText;
        }
    }
};


// ── Phase 5: Chat Controller ──────────────────────────────────────────────────
const ChatController = {

    _matchId: 0,
    _lastId: 0,
    _sending: false,
    _isLoading: false,
    _pollTimer: null,
    _isShowing: false,
    _lastSenderId: 0,
    _lastMsgEl: null,
    _viewerId: 0,
    _shownActionIds: new Set(),





    open: function (match_id) {
        this._matchId = match_id;
        this._isShowing = true;
        this._lastSenderId = 0;
        this._lastMsgEl = null;
        this._savedScrollTop = window.scrollY || document.documentElement.scrollTop;

        const overlay = document.getElementById('mv-chat-overlay');
        if (overlay) {
            overlay.style.display = 'flex';

            // Fixed position scroll lock to prevent layout scroll jump
            document.body.style.position = 'fixed';
            document.body.style.top = `-${this._savedScrollTop}px`;
            document.body.style.width = '100%';

            // Immediate UX cleanup: hide badge since we are now "reading"
            const badge = document.querySelector('.chat-unread-badge');
            if (badge) badge.style.display = 'none';
        }

        // Push state so back button closes the chat
        const currentPath = window.location.pathname;
        const chatPath = currentPath.endsWith('/chat') ? currentPath : (currentPath + '/chat');

        // Only push if we are NOT already on the chat path (avoid double history entries)
        if (currentPath !== chatPath) {
            history.pushState({
                chatOpen: true,
                ignoreRoute: true,
                depth: (typeof Router !== 'undefined' ? Router.navDepth : 0)
            }, '', chatPath);
        } else {
            // If already on /chat, just replace state to ensure our chatOpen flag is present
            history.replaceState({
                chatOpen: true,
                ignoreRoute: true,
                depth: (typeof Router !== 'undefined' ? Router.navDepth : 0)
            }, '', chatPath);
        }

        this.init(match_id);
    },





    renderPlayerBar: function () {

        const bar = document.getElementById('chat-player-bar');
        if (!bar) return;

        // Use slot data from MatchesController
        const slots = MatchesController._currentMatchSlots || [];
        const waitlist = MatchesController._currentMatchWaitlist || [];

        // Build a unique list of players
        const players = [];
        const seen = new Set();

        const add = (p) => {
            if (!p || !p.user_id || seen.has(p.user_id)) return;
            seen.add(p.user_id);
            players.push(p);
        };

        slots.forEach(s => add({ ...s, gender: s.gender || 'male' }));
        waitlist.forEach(w => {
            // Only show people currently in the queue or pending approval
            if (!['pending', 'approved'].includes(w.request_status)) return;

            if (w.requester_id) add({ user_id: w.requester_id, nickname: w.req_nickname, first_name: w.req_first, last_name: w.req_last, profile_image: w.req_profile, profile_image_thumb: w.req_profile_thumb, player_code: w.req_code, gender: w.req_gender, mobile: w.req_mobile });
            if (w.partner_id) add({ user_id: w.partner_id, nickname: w.par_nickname, first_name: w.par_first, last_name: w.par_last, profile_image: w.par_profile, profile_image_thumb: w.par_profile_thumb, player_code: w.par_code, gender: w.par_gender, mobile: w.par_mobile });
        });

        const currentUserId = this._viewerId || 0;

        let meUser = null;
        const otherUsers = [];

        players.forEach(p => {
            if (parseInt(p.user_id) === currentUserId) {
                meUser = p;
            } else {
                otherUsers.push(p);
            }
        });

        let html = '';

        const buildAvatar = (p, isMe) => {
            const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || (p.nickname?.[0] || '?').toUpperCase();
            const displayName = p.nickname || p.first_name || 'Player';
            const thumb = p.profile_image_thumb || p.profile_image;
            const imgPath = thumb ? `src="${CONFIG.ASSET_BASE}/${thumb}"` : '';

            const onlineDot = `<div id="avatar-online-dot-${p.user_id}" style="display:none; position:absolute; bottom:-1px; right:-1px; width:13px; height:13px; background-color:#10B981; border:2px solid var(--c-bg); border-radius:50%; z-index:10; box-shadow:0 0 4px rgba(16,185,129,0.4);"></div>`;

            // Restriction: In Mixed matches, Males cannot click on Females
            const isMixed = MatchesController._currentMatchGenderType === 'open';
            const isViewerMale = MatchesController._currentMatchViewerGender === 'male';
            const isTargetFemale = p.gender === 'female';
            const isRestricted = isMixed && isViewerMale && isTargetFemale;

            if (isMe || isRestricted) {
                // Non-clickable representation
                return `
                    <div class="chat-player-avatar" 
                         style="position:relative; z-index:5; flex-shrink:0; width:42px; height:42px; border-radius:50%; ${isMe ? 'border-color:var(--c-primary);' : ''} ${isRestricted ? 'cursor:default;' : ''}"
                         title="${displayName}${isMe ? ' (You)' : ''}">
                        ${UI.getAvatarHtml(thumb, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;', initials)}
                        ${onlineDot}
                    </div>
                `;
            } else {
                // Clickable representation of others
                return `
                    <div class="chat-player-avatar" 
                         onclick="ChatController.openPlayerMenu(event)"
                         data-user-id="${p.user_id}"
                         data-nickname="${displayName}"
                         data-fullname="${((p.first_name || '') + ' ' + (p.last_name || '')).trim()}"
                         data-code="${p.player_code || ''}"
                         data-gender="${p.gender || 'male'}"
                         data-mobile="${p.mobile || ''}"
                         style="position:relative; z-index:5; cursor:pointer; flex-shrink:0; width:42px; height:42px; border-radius:50%;"
                         title="${displayName}">
                        ${UI.getAvatarHtml(thumb, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', 'width:100%;height:100%;border-radius:50%;', initials)}
                        ${onlineDot}
                    </div>
                `;
            }
        };

        if (meUser) {
            html += buildAvatar(meUser, true);
        }

        if (otherUsers.length > 0) {
            if (meUser) {
                html += `<div style="width:1px; height:24px; background:rgba(255,255,255,0.1); margin:auto 4px; flex-shrink:0;"></div>`;
                // Add the explicit Tip Badge with Arrow (Premium Modern Layout)
                html += `
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; padding:6px 12px; margin:auto 4px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.09); border-radius:12px; height:32px; box-sizing:border-box; flex-shrink:0; pointer-events:none; user-select:none;">
                        <span style="font-size:12px; font-weight:800; color:#fff; font-family:var(--font);">Call</span>
                        <svg style="width:11px; height:11px; color:var(--c-orange);" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                `;
            }
            html += otherUsers.map(p => buildAvatar(p, false)).join('');
        }

        bar.innerHTML = safeHTML(html);
    },


    openPlayerMenu: function (event) {
        if (event) event.stopPropagation();
        const el = (event && event.target) ? event.target.closest('.chat-player-avatar') : null;
        if (!el) return;

        const userId = el.dataset.userId;
        const nickname = el.dataset.nickname || '';
        const fullName = el.dataset.fullname || '';
        const pCode = el.dataset.code || '';
        if (!userId || Number(userId) === this._viewerId) return;

        const actionBar = document.getElementById('chat-player-actions-bar');

        const nameEl = document.getElementById('chat-selected-player-name');
        const listEl = document.getElementById('chat-inline-actions');

        if (!actionBar || !nameEl || !listEl) return;

        const cached = PhoneController._requests[userId];
        const isApproved = cached && cached.status === 'approved';
        const isPending = cached && cached.status === 'pending';
        const mobile = el.dataset.mobile || (isApproved ? cached.phone : '');

        let btnContent = '';
        if (mobile) {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="event.stopPropagation(); window.location.href='tel:${mobile.replace(/\s+/g, '')}'"
                     style="cursor:pointer; padding:8px 16px; background:rgba(247,148,29,0.1); border:1px solid var(--c-orange); color:#cbd5e1; border-radius:8px; font-size:14px; font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                     🤙🏼 ${mobile}
                </div>`;
        } else if (isPending) {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="ChatController.cancelPhone(${userId}, this)" 
                     style="cursor:pointer; padding:6px 14px; background:var(--c-primary); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">
                     Cancel request
                </div>`;
        } else {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="ChatController.requestPhone(${userId}, this)" 
                     style="cursor:pointer; padding:6px 14px; background:rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">
                     📞 Request Phone
                </div>`;
        }

        const codeHtml = pCode ? `<span style="font-family:monospace; font-size:11px; background:rgba(247,148,29,0.15); color:var(--c-orange); padding:2px 6px; border-radius:6px; letter-spacing:0.5px; font-weight:800;">${pCode}</span>` : '';
        const nameDisplay = `<span style="text-transform:uppercase; font-weight:900;">${nickname}</span>`;
        nameEl.innerHTML = safeHTML(`${nameDisplay} ${codeHtml}`);
        listEl.innerHTML = btnContent;


        actionBar.style.setProperty('display', 'flex', 'important');
    },




    closePlayerMenu: function () {
        const actionBar = document.getElementById('chat-player-actions-bar');
        if (actionBar) actionBar.style.setProperty('display', 'none', 'important');
    },

    mentionPlayer: function (nickname) {
        if (!nickname) return;
        const input = document.getElementById('chat-input');
        if (input) {
            const val = input.value;
            const space = (val.length > 0 && !val.endsWith(' ')) ? ' ' : '';
            input.value = val + space + '@' + nickname + ' ';
            input.focus();
            this.autoResize(input);
        }
    },

    requestPhone: async function (userId, btn) {
        if (btn) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.7';
            btn.innerText = '… Sending';
        }
        const success = await PhoneController.request(userId, this._matchId);
        if (success) {
            if (btn) {
                btn.innerText = 'Cancel request';
                btn.style.background = 'var(--c-primary)';
                btn.style.opacity = '1';
                btn.onclick = () => this.cancelPhone(userId, btn);
            }
            // Trigger chat refresh to show the request status (if needed) or just UI update
            await this.loadMessages(false, true);
        } else if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.innerText = '📞 Request Phone';
        }
        setTimeout(() => this.closePlayerMenu(), 1000);
    },

    cancelPhone: async function (userId, btn) {
        if (btn) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.7';
            btn.innerText = '… Cancelling';
        }
        const success = await PhoneController.cancel(userId, this._matchId);
        if (success && btn) {
            btn.innerText = '📞 Request Phone';
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.onclick = () => this.requestPhone(userId, btn);
        } else if (!success && btn) {
            // Revert state if failed
            btn.innerText = 'Cancel request';
            btn.style.background = 'var(--c-primary)';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
        setTimeout(() => this.closePlayerMenu(), 600);
    },







    suspendAndNavigate: function (path) {
        this._isShowing = false;
        const overlay = document.getElementById('mv-chat-overlay');
        if (overlay) overlay.style.display = 'none';
        this.stop();
        Router.navigate(path);
    },


    close: function (fromHistory = false) {

        if (!this._isShowing) return;
        this._isShowing = false;

        this.closePlayerMenu();

        const overlay = document.getElementById('mv-chat-overlay');

        const menu = document.getElementById('chat-action-menu');
        if (menu) menu.style.display = 'none';

        if (overlay) {
            overlay.style.display = 'none';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            if (typeof this._savedScrollTop !== 'undefined') {
                window.scrollTo(0, this._savedScrollTop);
            }
        }
        this.stop();


        // If closed via ✕ button, we need to pop the state we pushed
        if (!fromHistory) {
            if (history.state && history.state.chatOpen) {
                history.back();
            }
        }
    },

    init: function (match_id) {
        this._matchId = match_id;

        this._lastId = 0;

        const indicator = document.getElementById('chat-online-indicator');
        if (indicator) indicator.style.display = 'flex';

        this._shownActionIds.clear();
        this.loadMessages(true);

        this.startPoll();
    },


    stop: function () {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;

            // Phase 6: Explicitly clear presence so notifications re-enable immediately
            const mid = parseInt(this._matchId);
            if (mid) {
                if (navigator.sendBeacon) {
                    const fd = new FormData();
                    fd.append('match_id', mid);
                    const token = Auth.getToken();
                    if (token) fd.append('auth_token', token);
                    navigator.sendBeacon(CONFIG.API_BASE_URL + '/chat/presence-clear', fd);
                } else {
                    API.post('/chat/presence-clear', { match_id: mid });
                }
            }
        }
    },

    startPoll: function () {
        this.stop();
        this._pollTimer = setInterval(() => { ChatController.loadMessages(false); }, 5000);
    },


    loadMessages: async function (initial = false, forceScroll = false) {
        if (this._isLoading) return;
        // Phase 6: Don't poll if the tab is in the background (prevents "ghost online" status)
        if (document.hidden && !initial) return;

        const container = document.getElementById('chat-messages-container');
        const inner = document.getElementById('chat-messages-inner');
        if (!container || !inner) return;

        const mid = parseInt(this._matchId);
        if (!mid) return;
        this._isLoading = true;
        const res = await API.post('/chat/list', { match_id: mid, since_id: initial ? 0 : (this._lastId || 0) });

        if (!res || !res.success) {
            this._isLoading = false;
            return;
        }

        if (initial) {
            this._lastMsgEl = null;
            this._lastSenderId = 0;
            // Only clear the container if we are going to add messages or notifications
            // We do this below after checking what data we received.
        }

        const messages = res.data.messages || [];

        const viewerId = parseInt(res.data.viewer_id);
        this._viewerId = viewerId;

        if (initial) {
            this.renderPlayerBar();
        }

        const outgoing = res.data.outgoing_phone_requests || [];
        const pendingForMe = res.data.pending_phone_requests || [];
        const online_users = res.data.online_users || [];

        // Real-Time dynamically toggle the online indicator dots across the player bar
        const onlineSet = new Set(online_users.map(id => String(id)));
        document.querySelectorAll('div[id^="avatar-online-dot-"]').forEach(el => {
            const uid = el.id.replace('avatar-online-dot-', '');
            if (onlineSet.has(uid) || uid === String(viewerId)) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });

        // Manage empty state and clearing on initial load
        const hasContent = messages.length > 0 || pendingForMe.length > 0 || outgoing.filter(pr => pr.status === 'approved').length > 0;

        if (initial) {
            if (hasContent) {
                // We have things to show, prep the stage by clearing exactly once
                inner.innerHTML = '';
            } else {
                // Nothing to show, make sure empty state is visible
                let emptyState = document.getElementById('chat-empty-state');
                if (!emptyState) {
                    inner.innerHTML = `
                      <div id="chat-empty-state" style="display:flex; align-items:center; justify-content:center; color:var(--c-text-muted); font-size:13px; text-align:center; padding:40px 0; flex:1;">
                        No messages yet.<br>Be the first to say something! 🎾
                      </div>`;
                }
            }
        }

        // Globally ensure placeholder is removed if we are injecting anything
        if (hasContent) {
            const emptyState = document.getElementById('chat-empty-state');
            if (emptyState) emptyState.remove();
        }


        // Sync outgoing status
        outgoing.forEach(pr => {
            const tid = parseInt(pr.target_user_id);
            if (!PhoneController._requests[tid] || PhoneController._requests[tid].status === 'pending') {
                PhoneController._requests[tid] = { status: pr.status, request_id: parseInt(pr.id) };
                if (pr.phone) PhoneController._requests[tid].phone = pr.phone;
                PhoneController.updateBtn(tid, pr.status, pr.phone);
            }
        });

        // --- NEW: Unified Chronological Timeline ---
        const timelineEvents = [
            ...messages.map(m => ({ type: 'message', time: new Date(m.created_at), data: m })),
            ...outgoing
                .filter(pr => pr.status === 'approved')
                .map(pr => ({ type: 'phone_approved', time: new Date(pr.updated_at || pr.created_at), data: pr }))
        ];

        // Sort chronologically
        timelineEvents.sort((a, b) => a.time - b.time);



        const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

        try {
            timelineEvents.forEach(event => {
                if (event.type === 'message') {
                    const msg = event.data;
                    const msgId = parseInt(msg.id);
                    if (!msgId) return;
                    const senderId = parseInt(msg.user_id);
                    const isMe = senderId === viewerId;
                    const bubble = this.buildBubbleEl(msg, isMe);

                    if (senderId === this._lastSenderId && this._lastMsgEl) {
                        const col = this._lastMsgEl.querySelector('.chat-msg-column');
                        if (col) {
                            col.appendChild(bubble);
                            this._lastMsgEl.style.marginBottom = '16px';
                        }
                    } else {
                        const group = document.createElement('div');
                        group.className = 'chat-msg-group';
                        group.style.cssText = `display:flex; gap:10px; align-items:flex-end; margin-bottom:16px; width:100%;` + (isMe ? 'flex-direction:row-reverse;' : '');

                        const name = msg.nickname || msg.first_name || 'Guest';
                        const code = msg.player_code || '';
                        const thumb = msg.profile_image_thumb || msg.profile_image;

                        // Avatar
                        const avatarEl = document.createElement('div');
                        avatarEl.className = 'chat-group-avatar';
                        avatarEl.style.cssText = 'width:38px; height:38px; border-radius:50%; background:var(--g-primary); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; flex-shrink:0; overflow:hidden;';
                        if (thumb) {
                            const img = document.createElement('img');
                            img.src = `${CONFIG.ASSET_BASE}/${thumb}`;
                            img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
                            img.onerror = function () { this.parentElement.innerText = (name[0] || '?').toUpperCase(); };
                            avatarEl.appendChild(img);
                        } else {
                            avatarEl.innerText = (name[0] || '?').toUpperCase();
                        }

                        // Column
                        const col = document.createElement('div');
                        col.className = 'chat-msg-column';
                        col.style.cssText = `max-width:72%; display:flex; flex-direction:column; gap:2px; ${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}`;

                        if (!isMe) {
                            const nameHeader = document.createElement('div');
                            nameHeader.style.cssText = 'font-size:11px; font-weight:700; color:var(--c-text-muted); margin-bottom:2px; display:flex; align-items:center;';
                            if (code === 'ADMIN') {
                                const adminBadge = document.createElement('span');
                                adminBadge.style.cssText = 'background:var(--c-primary); color:#fff; font-size:8px; font-weight:900; padding:2px 6px; border-radius:100px; text-transform:uppercase; letter-spacing:0.5px;';
                                adminBadge.innerText = 'Padeladd Admin';
                                nameHeader.appendChild(adminBadge);
                            } else {
                                nameHeader.innerText = name + ' ';
                                if (code) {
                                    const codeSpan = document.createElement('span');
                                    codeSpan.style.cssText = 'font-family:monospace; font-size:10px; color:var(--c-orange); opacity:0.9; margin-left:4px;';
                                    codeSpan.innerText = code;
                                    nameHeader.appendChild(codeSpan);
                                }
                            }
                            col.appendChild(nameHeader);
                        }

                        col.appendChild(bubble);
                        group.appendChild(avatarEl);
                        group.appendChild(col);

                        inner.appendChild(group);
                        this._lastMsgEl = group;
                    }

                    this._lastId = Math.max(this._lastId, msgId);
                    this._lastSenderId = senderId;
                }
                else if (event.type === 'phone_approved') {
                    const pr = event.data;
                    const actionKey = 'approved-' + pr.id;
                    if (this._shownActionIds.has(actionKey)) return;
                    this._shownActionIds.add(actionKey);

                    const targetName = pr.nickname || pr.first_name;
                    const phone = pr.phone || 'Unavailable';
                    const el = document.createElement('div');
                    el.className = 'chat-system-msg';
                    el.style.cssText = 'background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02)); border:1px solid rgba(16,185,129,0.2); border-radius:16px; padding:14px; margin-bottom:12px; width:100%; display:flex; flex-direction:column; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);';

                    const initials = ((pr.first_name?.[0] || '') + (pr.last_name?.[0] || '')).toUpperCase() || (pr.nickname?.[0] || '?').toUpperCase();
                    const thumb = pr.profile_image_thumb || pr.profile_image;
                    const avatarHtml = thumb
                        ? `<img src="${CONFIG.ASSET_BASE}/${thumb}" style="width:32px; height:32px; object-fit:cover; border-radius:50%; flex-shrink:0; border:2px solid var(--c-bg-card);">`
                        : `<div style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; background:var(--g-primary); color:#fff; font-size:12px; font-weight:800; flex-shrink:0; border:2px solid var(--c-bg-card);">${initials}</div>`;
                    const codeHtml = pr.player_code ? `<span style="font-family:monospace; font-size:10px; color:var(--c-orange); opacity:0.9; background:rgba(247,148,29,0.1); padding:2px 4px; border-radius:4px;">${pr.player_code}</span>` : '';

                    el.innerHTML = safeHTML(`
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="position:relative;">
                                ${avatarHtml}
                                <div style="position:absolute; bottom:-4px; right:-4px; width:16px; height:16px; background:#10B981; border-radius:50%; border:2px solid var(--c-bg); display:flex; align-items:center; justify-content:center; font-size:8px; color:#fff;">✓</div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                                    <strong style="font-size:14px; color:var(--c-text);">${targetName}</strong>
                                    ${codeHtml}
                                </div>
                                <div style="font-size:11px; color:var(--c-text-muted);">Shared phone number</div>
                            </div>
                        </div>
                        <a href="tel:${phone}" style="display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); padding:10px 16px; border-radius:12px; text-decoration:none; color:var(--c-text); transition:background 0.2s;">
                            <span style="font-size:16px; opacity:0.8;">📞</span>
                            <span style="font-size:16px; font-weight:800; font-family:monospace; color:#10B981; letter-spacing:0.5px;">${phone}</span>
                        </a>
                    `);
                    if (inner) inner.appendChild(el);

                    // Break the group
                    this._lastSenderId = 0;
                    this._lastMsgEl = null;
                }
            });
        } catch (e) {
            console.error("Chat rendering error:", e);
        }

        // --- NEW: System Actions Rendered at the Bottom ---

        // 1. Incoming prompts (Pending for me)
        pendingForMe.forEach(pr => {
            const notifId = 'phone-notif-pending-' + pr.id;
            if (document.getElementById(notifId)) return;
            const requesterName = pr.nickname || pr.first_name;
            const el = document.createElement('div');
            el.id = notifId;
            el.className = 'chat-system-msg';
            el.style.cssText = 'background:rgba(var(--c-primary-rgb,59,130,246),0.1); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; width:100%;';
            el.innerHTML =
                '<div style="font-size:13px; color:var(--c-text); flex:1;">📞 <strong>' + requesterName + '</strong> wants your phone number</div>' +
                '<div style="display:flex; gap:8px; flex-shrink:0;">' +
                '<button onclick="PhoneController.respond(' + pr.id + ',\'approve\')" style="background:var(--g-primary); border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; color:#fff; cursor:pointer;">Allow</button>' +
                '<button onclick="PhoneController.respond(' + pr.id + ',\'deny\')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; color:var(--c-text-muted); cursor:pointer;">Deny</button>' +
                '</div>';
            if (inner) inner.appendChild(el);
        });

        // 2. Cleanup: remove pending boxes locally if they were cancelled on the server
        const validPendingIds = new Set(pendingForMe.map(pr => 'phone-notif-pending-' + pr.id));
        if (inner) {
            inner.querySelectorAll('div[id^="phone-notif-pending-"]').forEach(el => {
                // Phase 6: Only remove if not valid and not already approved/handled in this session
                if (!validPendingIds.has(el.id) && !el.classList.contains('notif-handled')) {
                    el.remove();
                }
            });
        }


        if (initial || wasAtBottom || forceScroll) {
            if (initial) {
                container.scrollTop = container.scrollHeight;
            } else {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        this._isLoading = false;
    },

    buildBubbleEl: function (msg, isMe) {
        const timeStr = new Date(msg.created_at).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.dataset.msgId = msg.id;
        bubble.style.cssText = 'position:relative; background:' + (isMe ? 'var(--g-primary)' : 'var(--g-card)') + '; border:1px solid ' + (isMe ? 'transparent' : 'var(--c-border)') + '; border-radius:' + (isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + '; padding:7px 12px; font-size:14px; line-height:1.4; color:var(--c-text); word-break:break-word; max-width:100%;';

        const escapedText = this.escapeHtml(msg.message_text);
        const linkifiedText = this.linkify(escapedText, isMe);

        bubble.innerHTML = safeHTML(linkifiedText + `<span style="float:right; font-size:9px; color:var(--c-text-muted); opacity:0.6; margin:6px -4px -2px 8px; vertical-align:bottom;">${timeStr}</span>`);
        return bubble;
    },



    sendMessage: async function () {
        if (this._sending) return;
        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        // Instant clear to prevent double-sends and provide fast feedback
        input.value = '';
        this.autoResize(input);

        this._sending = true;
        const btn = document.getElementById('chat-send-btn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

        const res = await API.post('/chat/send', { match_id: this._matchId, message_text: text });

        this._sending = false;
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

        if (res && res.success) {
            await this.loadMessages(false, true);
        } else {
            // Restore text so the user doesn't lose their message on failure
            input.value = text;
            this.autoResize(input);
            Toast.show(res ? res.message : 'Message failed to send', 'error');
        }
    },

    handleKey: function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    },

    autoResize: function (el) {
        el.style.height = 'auto';
        const newHeight = Math.min(el.scrollHeight, 100);
        el.style.height = newHeight + 'px';
        el.style.overflowY = el.scrollHeight > 100 ? 'auto' : 'hidden';
    },


    linkify: function (text, isMe) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const linkColor = isMe ? '#fff' : 'var(--c-primary)';
        return text.replace(urlRegex, function (url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${linkColor}; text-decoration:underline; font-weight:600;">${url}</a>`;
        });
    },

    escapeHtml: function (str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

};
window.ChatController = ChatController;


// Handle Browser Back Button for Chat Overlay
window.addEventListener('popstate', function (event) {
    if (ChatController && ChatController._isShowing) {
        // If we popped away from the chatOpen state, close the overlay
        if (!event.state || !event.state.chatOpen) {
            ChatController.close(true);
        }
    }
});

// Fix dropped chat notifications: Clear chat presence instantly when app goes to background
document.addEventListener('visibilitychange', () => {
    if (document.hidden && typeof ChatController !== 'undefined' && ChatController._isShowing && ChatController._matchId) {
        ChatController.stop();
    } else if (!document.hidden && typeof ChatController !== 'undefined' && ChatController._isShowing && ChatController._matchId) {
        // Resume polling and instantly update online status
        ChatController.startPoll();
        ChatController.loadMessages(false);
    }
});

// ── Phase 5: Phone Controller ─────────────────────────────────────────────────

const PhoneController = {
    _requests: {},

    request: async function (target_user_id, match_id) {
        const cached = this._requests[target_user_id];
        // Only block duplicate API calls if the request is already actively pending or approved.
        if (cached && (cached.status === 'pending' || cached.status === 'approved')) {
            this.updateBtn(target_user_id, cached.status, cached.phone || null);
            return true;
        }

        const btn = document.getElementById('phone-btn-' + target_user_id);
        if (btn) { btn.disabled = true; btn.textContent = '…'; }
        const res = await API.post('/phone/request', { match_id, target_user_id });
        if (!res || !res.success) {
            if (btn) { btn.disabled = false; btn.textContent = '📞 Request Phone'; }
            if (res && res.message) {
                const isBlocked = (res.status === 429);
                ConfirmModal.show({
                    title: isBlocked ? 'Maximum Attempts Reached' : 'Request Failed',
                    message: res.message,
                    confirmText: 'OK',
                    showCancel: !isBlocked,
                    type: 'warning'
                });
            }
            return false;
        }
        this._requests[target_user_id] = { status: res.data.status, request_id: res.data.request_id };
        this.updateBtn(target_user_id, res.data.status, null);
        return true;
    },

    cancel: async function (target_user_id, match_id) {
        const res = await API.post('/phone/cancel', { match_id, target_user_id });
        if (res && res.success) {
            delete this._requests[target_user_id];
            return true;
        }
        if (res && res.message) {
            ConfirmModal.show({ title: 'Cancel Failed', message: res.message, confirmText: 'OK', type: 'warning' });
        }
        return false;
    },



    respond: async function (request_id, action) {
        const res = await API.post('/phone/respond', { request_id, action });
        if (!res || !res.success) return;
        const notif = document.getElementById('phone-notif-pending-' + request_id);
        if (action === 'approve' && res.data.phone) {
            if (notif) {
                notif.innerHTML = safeHTML('<span style="color:var(--c-orange);font-weight:700;">✅ Approved — <a href="tel:' + res.data.phone + '" style="color:inherit; text-decoration:underline;">' + res.data.phone + '</a></span>');
                notif.classList.add('notif-handled');
            }
        } else {
            if (notif) notif.remove();
        }
    },

    updateBtn: function (target_user_id, status, phone) {
        const btn = document.getElementById('phone-btn-' + target_user_id);
        if (!btn) return;

        btn.disabled = false;
        btn.style.pointerEvents = 'auto';

        if (status === 'pending') {
            btn.innerHTML = 'Cancel request';
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:var(--c-primary); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = () => ChatController.cancelPhone(target_user_id, btn);
        }
        else if (status === 'approved' && phone) {
            btn.innerHTML = safeHTML('📞 ' + phone);
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:rgba(247,148,29,0.1); border:1px solid var(--c-orange); color:var(--c-orange); border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'tel:' + phone.replace(/\s+/g, '');
            };
        }
        else { // Denied, Cancelled, or otherwise invalid
            btn.innerHTML = '📞 Request Phone';
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = () => ChatController.requestPhone(target_user_id, btn);
        }
    }
};

// =============================================================================
// Phase 6 — NotificationsController
// =============================================================================
const NotificationsController = {
    _pollTimer: null,
    _isOpen: false,
    _inProgress: false,
    _notifications: [],
    _visuallyUnreadIds: new Set(),
    _offset: 0,
    _hasMore: true,
    _isLoading: false,

    // Called once on app init / nav sync
    init: function () {
        this.injectPanel();
        this.pollBadge();
        this._pollTimer = setInterval(() => NotificationsController.pollBadge(), 15000);
    },

    stop: function () {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    pollBadge: async function () {
        if (!Auth.isAuthenticated() || this._inProgress || this._isOpen) return;
        // Phase 6: Skip background notification polling if tab is hidden
        if (document.hidden) return;

        this._inProgress = true;
        try {
            const res = await API.post('/notifications/list', {});
            if (!res || !res.success) throw new Error('API failed');

            // Use global unread count from backend for the badge
            const unreadCount = parseInt(res.data.unread_count || 0);
            const badge = document.getElementById('nav-notif-badge');

            if (badge) {
                const currentCount = parseInt(badge.textContent) || 0;
                if (unreadCount > currentCount) {
                    SoundManager.play('notify');
                }
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }

            // Only overwrite list if panel is closed, or if user hasn't scrolled past first page
            if (!this._isOpen) {
                this._notifications = res.data.notifications || [];
            } else if (this._offset <= 20) {
                this._notifications = res.data.notifications || [];
                this.renderList();
            }
        } catch (e) {
            console.warn('Notification poll failed:', e.message);
        } finally {
            this._inProgress = false;
        }
    },

    open: async function () {
        if (this._isOpen) return;
        this._isOpen = true;
        const panel = document.getElementById('notif-panel');
        if (!panel) return;

        // Render preloaded data immediately if we have it
        if (this._notifications.length > 0) {
            this.renderList();
        } else {
            // If nothing preloaded, reset and show skeletons
            this._offset = 0;
            this._hasMore = true;
            this.loadMore();
        }

        // Hide badge immediately
        const badge = document.getElementById('nav-notif-badge');
        if (badge) badge.style.display = 'none';

        panel.classList.add('open');

        // Trigger a fresh reload in background to ensure data is current
        if (this._notifications.length > 0) {
            this._offset = 0;
            this._hasMore = true;
            this.loadMore(true); // silent load
        }
    },

    close: function () {
        if (!this._isOpen) return;
        this._isOpen = false;

        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.remove('open');

        // Phase 6: Next time it opens, they appear as read
        this._visuallyUnreadIds.clear();
    },

    toggle: function () {
        this._isOpen ? this.close() : this.open();
    },

    loadMore: async function (isSilent = false) {
        if (this._isLoading || !this._hasMore) return;

        this._isLoading = true;
        if (!isSilent) {
            this.renderList(); // Show loading indicator at bottom
        }

        try {
            const res = await API.post('/notifications/list', { limit: 20, offset: this._offset });
            if (!res || !res.success) throw new Error('API failed');

            const newNotifs = res.data.notifications || [];

            // Phase 6: Aggregate IDs for immediate "mark as read" logic
            const unreadIds = newNotifs.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length > 0) {
                unreadIds.forEach(id => this._visuallyUnreadIds.add(id));
            }

            if (this._offset === 0) {
                // Silently mark all notifications as read globally on the first page load
                API.post('/notifications/read', { all: true });
                newNotifs.forEach(n => n.is_read = true);
                this._notifications = newNotifs; // Overwrite preloaded list on fresh load
            } else {
                if (unreadIds.length > 0) {
                    this.markRead(unreadIds, true); // Silent update for subsequent pages
                }
                this._notifications = this._notifications.concat(newNotifs);
            }

            this._offset = this._notifications.length;
            this._hasMore = res.data.has_more;
        } catch (e) {
            console.error('Failed to load more notifications:', e);
            this._hasMore = false;
        } finally {
            this._isLoading = false;
            this.renderList();
        }
    },

    renderList: function () {
        const listEl = document.getElementById('notif-list');
        if (!listEl) return;

        try {
            const notifications = this._notifications;
            if (notifications.length === 0) {
                listEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:16px; color:var(--c-text-muted);">
                        <div style="font-size:40px;">🔔</div>
                        <div style="font-size:14px; font-weight:600;">No notifications yet</div>
                        <div style="font-size:12px; opacity:0.6; text-align:center;">Actions in your matches will appear here</div>
                    </div>`;
                return;
            }

            const typeIcon = {
                match_joined: '🎾', team_invite: '👥', partner_confirmed: '✅',
                partner_denied: '✗', partner_blocked: '🚫', match_cancelled: '❌',
                player_withdrawn: '🚪', phone_requested: '📞', phone_approved: '📱', phone_denied: '🚫',
                new_message: '💬', score_submitted: '📊', score_confirmed: '🏆', score_disputed: '⚠️',
                score_approved: '🏆', score_reminder: '⏰'
            };

            // Phase 6: Grouping (Aggregation) for new_message by match
            const grouped = [];
            const chatGroups = {}; // match_id -> index in grouped array

            notifications.forEach(n => {
                if (n.type === 'new_message' && n.reference_id) {
                    const mid = n.reference_id;
                    if (chatGroups[mid] !== undefined) {
                        const existing = grouped[chatGroups[mid]];
                        existing.is_group = true;
                        if (!existing.all_ids) existing.all_ids = [existing.id];
                        existing.all_ids.push(n.id);
                        existing.count = (existing.count || 1) + (n.count || 1);
                        return;
                    } else {
                        chatGroups[mid] = grouped.length;
                        // If backend already grouped it, set is_group
                        if (n.count > 1) n.is_group = true;
                    }
                }
                grouped.push({ ...n });
            });

            // Update text for groups
            grouped.forEach(n => {
                if (n.is_group) {
                    const others = n.count - 1;
                    n.group_suffix = ` and ${others} other message${others > 1 ? 's' : ''}`;
                }
            });

            const todayItems = grouped.filter(n => isToday(n.created_at));
            const earlierItems = grouped.filter(n => !isToday(n.created_at));

            // To strictly prevent flickering during smart scrolling (infinite scroll/silent loads),
            // we reconcile the existing DOM items with the incoming items by tracking data-notif-id.
            // If the element already exists, we preserve it (avoiding avatar reload).

            // Build key-value map of new items
            const newItemsMap = new Map();
            grouped.forEach(n => newItemsMap.set(String(n.id), n));

            // 1. Remove DOM elements that are no longer in the list
            const existingItems = listEl.querySelectorAll('.notif-item');
            existingItems.forEach(el => {
                const id = el.getAttribute('data-notif-id');
                if (id && !newItemsMap.has(id)) {
                    el.remove();
                }
            });

            // Clean up old headers before rebuilding structure
            listEl.querySelectorAll('.notif-header-label').forEach(el => el.remove());
            const loadMoreTrigger = document.getElementById('load-more-trigger');
            if (loadMoreTrigger) loadMoreTrigger.remove();
            const notifLoading = document.getElementById('notif-loading');
            if (notifLoading) notifLoading.remove();

            // 2. Build or update items in order
            const renderSingleItemHtml = (n) => {
                const isReadVisually = n.is_read && !this._visuallyUnreadIds.has(n.id);
                const emoji = typeIcon[n.type] || '🔔';
                const thumb = n.sender_avatar_thumb || n.sender_avatar;

                let initials = '';
                if (n.sender_first_name || n.sender_last_name || n.sender_nickname) {
                    if (n.sender_first_name || n.sender_last_name) {
                        initials = ((n.sender_first_name?.[0] || '') + (n.sender_last_name?.[0] || '')).toUpperCase();
                    } else if (n.sender_nickname) {
                        initials = n.sender_nickname[0].toUpperCase();
                    }
                } else {
                    initials = n.type === 'score_approved' ? '⏳' : emoji;
                }
                if (!initials) initials = 'P';

                const avatarHtml = `
                    <div style="position:relative; flex-shrink:0;">
                        <div style="width:40px; height:40px; border-radius:50%; border:1.5px solid rgba(255,255,255,0.08); overflow:hidden;">
                            ${UI.getAvatarHtml(thumb, 'width:100%; height:100%; border-radius:50%; object-fit:cover;', 'width:100%; height:100%; border-radius:50%;', initials)}
                        </div>
                        <div style="position:absolute; bottom:-4px; right:-4px; width:22px; height:22px; background:var(--c-bg-card); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid var(--c-bg-card); box-shadow:0 2px 5px rgba(0,0,0,0.4); z-index:2;">
                            ${emoji}
                        </div>
                    </div>
                `;

                return `
                    ${avatarHtml}
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; color:var(--c-text); line-height:1.4; font-weight:${isReadVisually ? '400' : '500'}; word-break:break-word;">
                            ${n.message_text.replace(/: (.*)/, ': <span style="font-weight:700;">$1</span>')}${n.group_suffix || ''}
                        </div>
                        <div style="font-size:11px; color:var(--c-text-muted); margin-top:4px; opacity:0.7;">${relTime(n.created_at)}</div>
                    </div>
                    ${!isReadVisually ? '<div class="unread-dot" style="width:8px; height:8px; background:var(--c-primary); border-radius:50%; flex-shrink:0; margin-top:6px;"></div>' : ''}
                `;
            };

            const processGroup = (label, items) => {
                if (items.length === 0) return;

                // Add group header label
                const header = document.createElement('div');
                header.className = 'notif-header-label';
                header.style.cssText = 'font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:var(--c-text-muted); padding:16px 20px 8px; opacity:0.7;';
                header.textContent = label;
                listEl.appendChild(header);

                items.forEach(n => {
                    const stringId = String(n.id);
                    let existingEl = listEl.querySelector(`.notif-item[data-notif-id="${stringId}"]`);
                    const isReadVisually = n.is_read && !this._visuallyUnreadIds.has(n.id);

                    if (existingEl) {
                        // Element exists: ONLY update text or read status classes to completely preserve loaded avatars
                        if (isReadVisually) {
                            existingEl.classList.remove('notif-unread');
                            const dot = existingEl.querySelector('.unread-dot');
                            if (dot) dot.remove();
                        } else {
                            existingEl.classList.add('notif-unread');
                        }

                        // Move it to the bottom to maintain ordering without destroying DOM node
                        listEl.appendChild(existingEl);
                    } else {
                        // Create brand new element
                        const itemEl = document.createElement('div');
                        itemEl.className = `notif-item ${isReadVisually ? '' : 'notif-unread'}`;
                        itemEl.setAttribute('data-notif-id', stringId);
                        itemEl.style.cssText = 'display:flex; align-items:flex-start; gap:12px; padding:14px 20px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid rgba(255,255,255,0.04); position:relative;';
                        itemEl.onclick = () => NotificationsController.handleNotifClick(n);
                        itemEl.innerHTML = safeHTML(renderSingleItemHtml(n));
                        listEl.appendChild(itemEl);
                    }
                });
            };

            // If it's a completely empty render, wipe it once
            const currentNotifItems = listEl.querySelectorAll('.notif-item');
            if (currentNotifItems.length === 0) {
                listEl.innerHTML = '';
            }

            processGroup('Today', todayItems);
            processGroup('Earlier', earlierItems);

            // Phase 6: Add loading indicator and scroll listener
            if (this._isLoading) {
                listEl.insertAdjacentHTML('beforeend', `
                    <div id="notif-loading" style="padding:20px; text-align:center; opacity:0.6; font-size:12px;">
                        <span class="chat-loader" style="width:16px; height:16px; display:inline-block; margin-right:8px;"></span> Loading more...
                    </div>
                `);
            } else if (this._hasMore) {
                listEl.insertAdjacentHTML('beforeend', `
                    <div id="load-more-trigger" style="height:20px;"></div>
                `);
            }

            // Simple intersection detection via scroll listener
            listEl.onscroll = () => {
                if (!this._hasMore || this._isLoading) return;
                const scrollPos = listEl.scrollTop + listEl.clientHeight;
                if (scrollPos >= listEl.scrollHeight - 50) {
                    this.loadMore();
                }
            };

        } catch (e) {
            console.error('Notification render failed:', e);
            listEl.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5;">Load error.</div>';
        }
    },

    handleNotifClick: async function (n) {
        // 1. Mark as read immediately if unread (handles groups too)
        if (!n.is_read) {
            const ids = n.all_ids || [n.id];
            await this.markRead(ids);
        }

        // 2. Clear badge and close panel
        this._visuallyUnreadIds.clear();
        this.close();

        // 3. Navigate based on type
        let navPath = n.match_code ? `/matches/${n.match_code}` : `/matches/view/${n.reference_id}`;

        switch (n.type) {
            case 'match_joined':
            case 'team_invite':
            case 'partner_confirmed':
            case 'player_withdrawn':
            case 'partner_denied':
            case 'score_submitted':
            case 'score_confirmed':
            case 'score_disputed':
            case 'match_cancelled':
            case 'availability_alert':
            case 'partner_blocked':
            case 'score_submitted':
            case 'score_approved':
            case 'score_disputed':
            case 'score_reminder':
            case 'match_reminder':
                Router.navigate(navPath);
                break;

            case 'new_message':
            case 'phone_requested':
            case 'phone_approved':
            case 'phone_denied':
                // Phase 6: Stack navigation so Back takes you to the match, not dashboard
                // First navigate to the match detail page
                Router.navigate(navPath);

                // Then open the chat overlay which will push its own /chat state
                setTimeout(() => {
                    if (typeof ChatController !== 'undefined') ChatController.open(n.reference_id);
                }, 100);
                break;

            case 'partner_blocked':
                Router.navigate('/dashboard');
                break;

            default:
                // Default to dashboard if type is unknown but clicked
                Router.navigate('/dashboard');
        }
    },

    markRead: async function (ids, isSilent = false) {
        const res = await API.post('/notifications/read', { ids });
        if (res && res.success) {
            ids.forEach(id => {
                const n = this._notifications.find(n => n.id === id);
                if (n) n.is_read = true;
            });

            if (!isSilent) {
                const count = res.data.unread_count;
                const badge = document.getElementById('nav-notif-badge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'flex' : 'none';
                }
                this.renderList();
            }
        }
    },

    markAllRead: async function () {
        const res = await API.post('/notifications/read', { all: true });
        if (res && res.success) {
            this._notifications.forEach(n => n.is_read = true);
            this._visuallyUnreadIds.clear(); // Clear visual persistent state on manual "Mark all read"
            const badge = document.getElementById('nav-notif-badge');
            if (badge) badge.style.display = 'none';
            this.renderList();
        }
    },

    injectPanel: function () {
        if (document.getElementById('notif-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.innerHTML = `
            <div id="notif-panel-overlay" onclick="NotificationsController.close()" style="position:fixed; inset:0; z-index:8998; background:rgba(0,0,0,0.5); display:none;"></div>
            <div id="notif-panel-inner" style="
                position:fixed; top:0; right:0; height:100dvh; width:min(380px, 100vw);
                background:var(--c-bg-card); border-left:1px solid var(--c-border);
                z-index:8999; display:flex; flex-direction:column;
                transform:translateX(100%); transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
                box-shadow:-8px 0 32px rgba(0,0,0,0.4);
            ">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:20px; border-bottom:1px solid var(--c-border); flex-shrink:0;">
                    <div class="section-title" style="font-size:14px;">Notifications</div>
                    <div style="display:flex; gap:8px; align-items:center;">

                        <button onclick="NotificationsController.close()" style="background:transparent; border:none; color:var(--c-text); cursor:pointer; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div id="notif-list" style="flex:1; overflow-y:auto; overscroll-behavior:contain;"></div>
            </div>
        `;
        document.getElementById('app').appendChild(panel);

        // CSS for panel open state
        const style = document.createElement('style');
        style.textContent = `
            #notif-panel.open #notif-panel-overlay { display:block !important; }
            #notif-panel.open #notif-panel-inner { transform:translateX(0) !important; }
            .notif-item:hover { background:rgba(255,255,255,0.03); }
            .notif-unread { background:rgba(var(--c-primary-rgb, 59,130,246),0.05); }
            .notif-unread:hover { background:rgba(var(--c-primary-rgb, 59,130,246),0.08) !important; }
        `;
        document.head.appendChild(style);
    }
};

// -------------------------------------------------------
//  PHASE 7: SCORING CONTROLLER
// -------------------------------------------------------
const ScoringController = {
    _match: null,
    _composition: null,
    _scoreData: {
        s1_t1: 0, s1_t2: 0,
        s2_t1: 0, s2_t2: 0,
        s3_t1: 0, s3_t2: 0
    },

    initScoreSubmission: function (match) {
        this._match = match;
        this._scoreData = { s1_t1: 0, s1_t2: 0, s2_t1: 0, s2_t2: 0, s3_t1: 0, s3_t2: 0 };
        this._composition = null; // Default: match original teams

        const modal = document.createElement('div');
        modal.id = 'scoring-modal-overlay';
        modal.className = 'loading-overlay';
        modal.style.zIndex = '10000';
        modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
        modal.innerHTML = `
            <div class="scoring-modal">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <h2 style="font-size:20px; font-weight:800; margin:0;">Submit Match Score</h2>
                    <button onclick="ScoringController.closeModal()" class="modal-close-btn">&times;</button>
                </div>
                
                <div class="score-grid-container" style="width: 100%; margin-bottom: 24px;">
                    <!-- Headers Row -->
                    <div style="display: grid; grid-template-columns: 1fr 60px 1fr; gap: 12px; margin-bottom: 20px; align-items: flex-end;">
                        <div style="text-align: left; min-width: 0;">
                            <div class="score-team-name" style="text-align: left;">Team A</div>
                            <div id="team-a-nicknames" style="font-size:11px; color:#fff; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; word-break:break-word; margin-top:4px; min-height:30px; display:flex; align-items:center; justify-content:flex-start; text-align:left;"></div>
                        </div>
                        <div></div> <!-- spacer for center set column -->
                        <div style="text-align: right; min-width: 0;">
                            <div class="score-team-name" style="text-align: right;">Team B</div>
                            <div id="team-b-nicknames" style="font-size:11px; color:#fff; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; word-break:break-word; margin-top:4px; min-height:30px; display:flex; align-items:center; justify-content:flex-end; text-align:right;"></div>
                        </div>
                    </div>

                    <!-- Set 1 Row -->
                    <div class="score-row-grid" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; margin-bottom: 4px;">
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(1, 1, -1)">-</div>
                                    <span class="set-val" id="val-s1-t1">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(1, 1, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s1-t1"></div>
                        </div>
                        <span class="set-label" style="min-width: 50px; text-align: center; margin-bottom: 14px;">SET 1</span>
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(1, 2, -1)">-</div>
                                    <span class="set-val" id="val-s1-t2">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(1, 2, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s1-t2"></div>
                        </div>
                    </div>

                    <!-- Set 2 Row -->
                    <div class="score-row-grid" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; margin-bottom: 4px;">
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(2, 1, -1)">-</div>
                                    <span class="set-val" id="val-s2-t1">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(2, 1, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s2-t1"></div>
                        </div>
                        <span class="set-label" style="min-width: 50px; text-align: center; margin-bottom: 14px;">SET 2</span>
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(2, 2, -1)">-</div>
                                    <span class="set-val" id="val-s2-t2">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(2, 2, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s2-t2"></div>
                        </div>
                    </div>

                    <!-- Set 3 Row -->
                    <div class="score-row-grid" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; margin-bottom: 4px;">
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(3, 1, -1)">-</div>
                                    <span class="set-val" id="val-s3-t1">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(3, 1, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s3-t1"></div>
                        </div>
                        <span class="set-label" style="min-width: 50px; text-align: center; margin-bottom: 14px;">SET 3</span>
                        <div class="set-control-wrapper" style="display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
                            <div class="set-input-group" style="width: 100%; display: flex; justify-content: center; padding: 8px 12px;">
                                <div class="set-control">
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(3, 2, -1)">-</div>
                                    <span class="set-val" id="val-s3-t2">0</span>
                                    <div class="btn-score-adj" onclick="ScoringController.adjustScore(3, 2, 1)">+</div>
                                </div>
                            </div>
                            <div class="field-error" id="err-s3-t2"></div>
                        </div>
                    </div>
                </div>

                <div class="composition-switch">
                    <div class="comp-header">
                        <span class="comp-title">Teams/Partners changed?</span>
                        <button class="btn btn-sm btn-secondary" onclick="ScoringController.toggleComposition()">Switch Teams</button>
                    </div>
                    <div id="comp-editor" style="display:none;">
                        <p style="font-size:11px; color:var(--c-text-muted); margin-bottom:12px;">Click a player to toggle their team (must have 2 per team).</p>
                        <div class="comp-players" id="comp-players-list"></div>
                        <div class="field-error" id="err-composition" style="margin-top:12px; text-align:center;"></div>
                    </div>
                </div>

                <button class="btn btn-primary" onclick="ScoringController.submitScore()">Submit Results →</button>
                <p style="text-align:center; font-size:11px; color:var(--c-text-dim); margin-top:16px;">Opponents must approve the score for points to count.</p>
            </div>
        `;
        document.body.appendChild(modal);
        this._updateNicknames();
    },

    _updateNicknames: function () {
        const teamA = document.getElementById('team-a-nicknames');
        const teamB = document.getElementById('team-b-nicknames');
        if (!teamA || !teamB) return;

        const players = this._composition || MatchesController._currentMatchSlots.map(s => ({
            user_id: parseInt(s.user_id),
            team_no: parseInt(s.team_no),
            name: s.nickname || s.first_name
        }));

        const listA = players.filter(p => p.team_no == 1);
        const listB = players.filter(p => p.team_no == 2);

        if (listA.length === 2 && listB.length === 2) {
            teamA.textContent = listA.map(p => p.name).join(' / ');
            teamB.textContent = listB.map(p => p.name).join(' / ');
        } else {
            teamA.textContent = '';
            teamB.textContent = '';
        }
    },

    _renderSetInputs: function (set, team) {
        return `
            <div class="set-input-group-wrapper">
                <div class="set-input-group">
                    <span class="set-label">SET ${set}</span>
                    <div class="set-control">
                        <div class="btn-score-adj" onclick="ScoringController.adjustScore(${set}, ${team}, -1)">-</div>
                        <span class="set-val" id="val-s${set}-t${team}">0</span>
                        <div class="btn-score-adj" onclick="ScoringController.adjustScore(${set}, ${team}, 1)">+</div>
                    </div>
                </div>
                <div class="field-error" id="err-s${set}-t${team}"></div>
            </div>
        `;
    },

    adjustScore: function (set, team, delta) {
        const key = `s${set}_t${team}`;
        let newVal = this._scoreData[key] + delta;
        if (newVal < 0) newVal = 0;
        if (newVal > 7) newVal = 7;

        this._scoreData[key] = newVal;
        const el = document.getElementById(`val-s${set}-t${team}`);
        if (el) el.textContent = newVal;
    },

    toggleComposition: function () {
        const editor = document.getElementById('comp-editor');
        if (editor.style.display === 'none') {
            editor.style.display = 'block';
            this._renderComposition();
        } else {
            editor.style.display = 'none';
            this._composition = null;
            this._updateNicknames();
        }
    },

    _renderComposition: function () {
        if (!this._composition) {
            // Initial state from match slots
            this._composition = MatchesController._currentMatchSlots.map(s => ({
                user_id: parseInt(s.user_id),
                team_no: parseInt(s.team_no),
                slot_no: parseInt(s.slot_no),
                name: s.nickname || s.first_name
            }));
        }

        const list = document.getElementById('comp-players-list');
        if (!list) return;

        list.innerHTML = safeHTML(this._composition.map((p, idx) => `
            <div class="comp-player-card ${p.team_no == 1 ? 'active-t1' : 'active-t2'}" onclick="ScoringController.switchPlayerTeam(${idx})">
                <div style="font-size:10px; font-weight:800; color:${p.team_no == 1 ? 'var(--c-primary)' : 'var(--c-orange)'}">${p.team_no == 1 ? 'A' : 'B'}</div>
                <div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
            </div>
        `).join(''));
    },

    switchPlayerTeam: function (idx) {
        const p = this._composition[idx];
        p.team_no = p.team_no == 1 ? 2 : 1;
        this._renderComposition();
        this._updateNicknames();
    },

    closeModal: function () {
        const modal = document.getElementById('scoring-modal-overlay');
        if (modal) modal.remove();
    },

    submitScore: async function () {
        const btn = document.querySelector('.scoring-modal .btn-primary');
        if (btn && btn.disabled) return;

        let hasErrors = false;

        // Clear previous errors
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.set-input-group').forEach(el => el.classList.remove('error'));

        const s1_t1 = this._scoreData.s1_t1, s1_t2 = this._scoreData.s1_t2;
        const s2_t1 = this._scoreData.s2_t1, s2_t2 = this._scoreData.s2_t2;
        const s3_t1 = this._scoreData.s3_t1, s3_t2 = this._scoreData.s3_t2;

        const checkSet = (t1, t2, setNum) => {
            if (t1 === 0 && t2 === 0) return null; // Set not played

            // Padel set rules: 6-0 to 6-4, 7-5, 7-6
            const isT1Winner = (t1 === 6 && t2 <= 4) || (t1 === 7 && (t2 === 5 || t2 === 6));
            const isT2Winner = (t2 === 6 && t1 <= 4) || (t2 === 7 && (t1 === 5 || t1 === 6));

            if (!isT1Winner && !isT2Winner) {
                this._showFieldError(`s${setNum}-t1`, 'Invalid set score');
                this._showFieldError(`s${setNum}-t2`, 'Invalid set score');
                return 'error';
            }
            return isT1Winner ? 1 : 2;
        };

        const w1 = checkSet(s1_t1, s1_t2, 1);
        const w2 = checkSet(s2_t1, s2_t2, 2);
        const w3 = checkSet(s3_t1, s3_t2, 3);

        if (w1 === 'error' || w2 === 'error' || w3 === 'error') hasErrors = true;

        if (!hasErrors) {
            // Match-level validation
            if (!w1) {
                this._showFieldError('s1-t1', 'Set 1 is required');
                hasErrors = true;
            } else if (w1 && w2) {
                const team1Sets = (w1 === 1 ? 1 : 0) + (w2 === 1 ? 1 : 0) + (w3 === 1 ? 1 : 0);
                const team2Sets = (w1 === 2 ? 1 : 0) + (w2 === 2 ? 1 : 0) + (w3 === 2 ? 1 : 0);

                if (team1Sets < 2 && team2Sets < 2) {
                    this._showFieldError('s3-t1', 'Deciding set required (1-1)');
                    this._showFieldError('s3-t2', 'Deciding set required (1-1)');
                    hasErrors = true;
                }

                // If 3rd set is played, ensure 1st and 2nd sets were split
                if (w3 && w1 === w2) {
                    this._showFieldError('s3-t1', 'Not needed (2-0)');
                    this._showFieldError('s3-t2', 'Not needed (2-0)');
                    hasErrors = true;
                }
            } else if (w1 && !w2) {
                this._showFieldError('s2-t1', 'Set 2 is required');
                hasErrors = true;
            }
        }

        // Validate composition (2 per team)
        if (this._composition) {
            const t1 = this._composition.filter(x => x.team_no == 1).length;
            const t2 = this._composition.filter(x => x.team_no == 2).length;
            if (t1 !== 2 || t2 !== 2) {
                this._showFieldError('composition', 'Each team must have exactly 2 players.');
                hasErrors = true;
            }

            // Assign slot numbers within teams
            let t1_count = 0, t2_count = 0;
            this._composition.forEach(p => {
                if (p.team_no == 1) p.slot_no = ++t1_count;
                else p.slot_no = ++t2_count;
            });
        }

        if (hasErrors) return;

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Submitting...';
        }

        const payload = {
            match_id: this._match.id,
            s1_t1, s1_t2, s2_t1, s2_t2, s3_t1, s3_t2,
            composition: this._composition
        };

        const res = await API.post('/score/submit', payload);
        if (res && res.success) {
            Toast.show('Score submitted for review!', 'success');
            this.closeModal();
            MatchesController.loadDetails({ match_id: this._match.id }); // Refresh
        } else {
            Toast.show(res ? res.message : 'Submission failed', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Submit Results →';
            }
        }
    },

    _showFieldError: function (fieldId, msg) {
        const errEl = document.getElementById(`err-${fieldId}`);
        const groupEl = errEl?.previousElementSibling;
        if (errEl) errEl.textContent = msg;
        if (groupEl) groupEl.classList.add('error');
    },

    approveScore: async function (scoreId) {
        const confirmed = await ConfirmModal.show({
            title: 'Approve Result',
            message: 'Are you sure you want to approve this score? This will finalize the match and update everyone\'s points.',
            confirmText: 'Approve Result'
        });
        if (!confirmed) return;

        const res = await API.post('/score/approve', { score_id: scoreId });
        if (res && res.success) {
            Toast.show('Score approved! Points updated.', 'success');
            SoundManager.play('success');
            MatchesController.loadDetails({ match_id: MatchesController._currentMatchId }, true);
            UI.syncNav();
        } else {
            Toast.show(res ? res.message : 'Approval failed', 'error');
        }
    },

    disputeScore: async function (scoreId) {
        const reason = await ConfirmModal.show({
            title: 'What is wrong with the score?',
            message: '<b>Common reasons:</b>\n• Wrong score entered\n• I was in a different team',
            showInput: true,
            required: true,
            inputPlaceholder: 'Wrong score / I was in a different team...',
            inputMaxLength: 250,
            tipText: 'State the correct score clearly.',
            confirmText: 'Send Dispute',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/score/dispute', { score_id: scoreId, reason });
        if (res && res.success) {
            Toast.show('Dispute recorded. Our team will review it.', 'warning');
            MatchesController.loadDetails({ match_id: MatchesController._currentMatchId }, true);
        } else {
            Toast.show(res ? res.message : 'Dispute failed', 'error');
        }
    },

    deleteScore: async function (scoreId) {
        const confirmed = await ConfirmModal.show({
            title: 'Cancel Submission',
            message: 'Are you sure you want to cancel and delete this score submission? This cannot be undone.',
            confirmText: 'Yes, Delete',
            type: 'warning'
        });
        if (!confirmed) return;

        const res = await API.post('/score/delete', { score_id: scoreId });
        if (res && res.success) {
            Toast.show('Score submission cancelled/deleted.', 'success');
            MatchesController.loadDetails({ match_id: MatchesController._currentMatchId }, true);
            UI.syncNav();
        } else {
            Toast.show(res ? res.message : 'Deletion failed', 'error');
        }
    },

    reportIssue: async function (matchId, targetUserId = null) {
        const reason = await ConfirmModal.show({
            title: targetUserId ? 'Report player conduct' : 'Tell us what happened?',
            message: '<b>Common reasons:</b>\n• No show\n• Rude behavior\n• Wrong skill level' + (targetUserId ? '' : '\n• Technical issue'),
            showInput: true,
            inputPlaceholder: targetUserId ? 'Unfair behavior / Inappropriate conduct...' : 'Unfair behavior / App issue...',
            inputMaxLength: 300,
            tipText: targetUserId ? 'Tell us exactly what this player did.' : 'Provide details about the incident.',
            confirmText: 'Submit Report',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/match/report', { match_id: matchId, target_user_id: targetUserId, reason });
        if (res && res.success) {
            Toast.show('Report submitted successfully.', 'success');
        } else {
            Toast.show(res ? res.message : 'Report failed', 'error');
        }
    }
};

// -------------------------------------------------------
//  RANKING PAGE CONTROLLER
// -------------------------------------------------------
const RankingController = {
    _currentTab: 'male',
    _fullList: [],
    _cache: {}, // Stores ranking data per gender
    _limit: 50,
    _offset: 0,
    _hasMore: true,
    _isLoading: false,

    init: async function () {
        UI.syncNav();

        const savedGender = sessionStorage.getItem('ranking_gender');
        if (savedGender) {
            this._currentTab = savedGender;
        } else if (DashboardController._cache && DashboardController._cache.profile && DashboardController._cache.profile.profile) {
            this._currentTab = DashboardController._cache.profile.profile.gender || 'male';
        } else {
            const res = await API.post('/profile/get', {});
            if (res && res.success && res.data.profile) {
                this._currentTab = res.data.profile.gender || 'male';
            }
        }

        // Update UI buttons to reflect default tab
        const mBtn = document.getElementById('rank-tab-male');
        const fBtn = document.getElementById('rank-tab-female');
        if (mBtn && fBtn) {
            mBtn.classList.toggle('active', this._currentTab === 'male');
            fBtn.classList.toggle('active', this._currentTab === 'female');
        }

        // Reset pagination
        this._offset = 0;
        this._hasMore = true;
        this._isLoading = false;
        this._fullList = [];

        window.removeEventListener('scroll', RankingController.handleScroll);
        window.addEventListener('scroll', RankingController.handleScroll);

        this.loadData();
    },

    switchTab: function (gender) {
        this._currentTab = gender;
        sessionStorage.setItem('ranking_gender', gender);

        // Update UI buttons
        const mBtn = document.getElementById('rank-tab-male');
        const fBtn = document.getElementById('rank-tab-female');
        if (mBtn && fBtn) {
            mBtn.classList.toggle('active', gender === 'male');
            fBtn.classList.toggle('active', gender === 'female');
        }

        // Reset pagination
        this._offset = 0;
        this._hasMore = true;
        this._isLoading = false;
        this._fullList = [];

        this.loadData();
    },

    loadData: async function (isSilent = false) {
        if (this._isLoading) return;

        const listEl = document.getElementById('ranking-full-list');
        if (!listEl) return;

        const cacheKey = this._currentTab;
        const hasCache = this._cache[cacheKey];

        // Only show skeletons if we have no cache and loading first page
        if (!isSilent && !hasCache && this._offset === 0) {
            listEl.innerHTML = RankingUI.renderSkeleton(10);
        }

        // If we have cache, render it immediately
        if (!isSilent && hasCache && this._offset === 0) {
            this._fullList = hasCache;
            this.render(hasCache);
        }

        this._isLoading = true;

        const expectedTab = this._currentTab;
        const currentOffset = this._offset;

        // Fetch paginated ranking list
        const res = await API.post('/ranking/list', {
            gender: expectedTab,
            limit: this._limit,
            offset: currentOffset
        });

        // Prevent race condition if user switched tabs during the fetch
        if (this._currentTab !== expectedTab) {
            this._isLoading = false;
            return;
        }

        if (!res || !res.success) {
            this._isLoading = false;
            if (!isSilent && !hasCache && currentOffset === 0) {
                listEl.innerHTML = '<div style="padding:80px; text-align:center; color:var(--c-text-muted);">Failed to load ranking. Please try again.</div>';
            }
            return;
        }

        const newItems = res.data.ranking || [];

        if (currentOffset === 0) {
            this._fullList = newItems;
            this._cache[cacheKey] = newItems;
        } else {
            // Append and merge new entries to prevent duplicate items by player_code
            const existingCodes = new Set(this._fullList.map(r => r.player_code));
            newItems.forEach(item => {
                if (!existingCodes.has(item.player_code)) {
                    this._fullList.push(item);
                }
            });
        }

        this.render(this._fullList);

        this._offset += newItems.length;
        if (newItems.length < this._limit) {
            this._hasMore = false;
        }

        this._isLoading = false;
    },

    loadMore: function () {
        if (this._isLoading || !this._hasMore) return;
        this.loadData(true);
    },

    handleScroll: function () {
        if (!document.getElementById('ranking-full-list')) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        if (scrollTop + clientHeight >= scrollHeight - 300) {
            RankingController.loadMore();
        }
    },

    handleSearch: function (query) {
        const q = query.toLowerCase().trim();

        const clearBtn = document.getElementById('rank-search-clear');
        if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

        if (!q) {
            this.render(this._fullList);
            return;
        }

        const filtered = this._fullList.filter(r => {
            const fullName = ((r.first_name || '') + ' ' + (r.last_name || '')).toLowerCase();
            const nickCode = ((r.nickname || '') + ' ' + (r.player_code || '')).toLowerCase();
            // Every word in the query must appear somewhere across the combined fields
            const words = q.split(/\s+/).filter(Boolean);
            const haystack = [
                (r.nickname || '').toLowerCase(),
                (r.first_name || '').toLowerCase(),
                (r.last_name || '').toLowerCase(),
                (r.player_code || '').toLowerCase(),
                fullName,
                nickCode
            ].join(' ');
            return words.every(w => haystack.includes(w));
        });
        this.render(filtered);
    },

    clearSearch: function () {
        const input = document.getElementById('rank-search');
        if (input) {
            input.value = '';
            this.handleSearch('');
        }
    },

    render: function (list) {
        const listEl = document.getElementById('ranking-full-list');
        if (!listEl) return;

        if (list.length === 0) {
            listEl.innerHTML = '<div style="padding:100px 20px; text-align:center; color:var(--c-text-muted);"><div style="font-size:40px; margin-bottom:16px;">🔍</div>No players found.</div>';
            return;
        }

        // Pin the current user (if present) to the very top of the list
        const currentUserId = typeof Auth !== 'undefined' ? Auth.getUserId() : null;
        if (currentUserId) {
            const myIndex = list.findIndex(r => parseInt(r.user_id) === parseInt(currentUserId));
            if (myIndex > -1) {
                const me = list.splice(myIndex, 1)[0];
                list.unshift(me);
            }
        }

        // 1. Remove initial/default static skeletons or error messages from the listEl first
        // Skeletons do not have 'data-player-code', so we identify and remove them cleanly.
        const skeletons = listEl.querySelectorAll('.rank-grid-full:not([data-player-code])');
        skeletons.forEach(el => el.remove());

        // Build key-value map of new items
        const newPlayersMap = new Map();
        list.forEach(r => newPlayersMap.set(String(r.player_code), r));

        // 2. Remove rows that are no longer in the filtered list
        const existingRows = listEl.querySelectorAll('.rank-grid-full[data-player-code]');
        existingRows.forEach(el => {
            const code = el.getAttribute('data-player-code');
            if (code && !newPlayersMap.has(code)) {
                el.remove();
            }
        });

        // If it's a completely empty list layout (e.g. was error or empty search before), wipe it once
        const currentRows = listEl.querySelectorAll('.rank-grid-full[data-player-code]');
        if (currentRows.length === 0) {
            listEl.innerHTML = '';
        }

        list.forEach(r => {
            const pointsColor = '#fff';
            const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || (r.nickname?.[0] || '?').toUpperCase();
            const thumb = r.profile_image_thumb || r.profile_image;

            let row = listEl.querySelector(`.rank-grid-full[data-player-code="${r.player_code}"]`);

            const renderRankWrapHtml = (rankVal) => {
                if (rankVal === 1) {
                    return `<img src="assets/icons/rank/rank1.png" style="width:45px; height:45px; object-fit:contain;" alt="Gold Medal">`;
                } else if (rankVal === 2) {
                    return `<img src="assets/icons/rank/rank2.png" style="width:45px; height:45px; object-fit:contain;" alt="Silver Medal">`;
                } else if (rankVal === 3) {
                    return `<img src="assets/icons/rank/rank3.png" style="width:45px; height:45px; object-fit:contain;" alt="Bronze Medal">`;
                } else {
                    return `<span class="rank-text-val" style="text-align:left; font-size:20px; font-weight:700; color:#fff;">${rankVal}</span>`;
                }
            };

            const renderTotalWrapHtml = (pointsVal, diffValue) => {
                let badgeHtml = '';
                if (diffValue !== 0 && diffValue !== null && diffValue !== undefined) {
                    if (diffValue > 0) {
                        badgeHtml = `<span class="rank-pts-diff-badge" style="color:var(--c-green); background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); display:inline-block;">+${diffValue}</span>`;
                    } else {
                        badgeHtml = `<span class="rank-pts-diff-badge" style="color:#ef4444; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.25); display:inline-block;">${diffValue}</span>`;
                    }
                }
                return `
                    <span class="points-num-val" style="text-align:right; font-size:16px; font-weight:800; color:${pointsColor};">${pointsVal}</span>
                    ${badgeHtml}
                `;
            };

            if (row) {
                // ROW EXISTS: ONLY update contents that change (preserves loaded avatar in infoWrap)

                // 1. Update Rank
                const rankWrap = row.querySelector('.rank-wrap-el');
                if (rankWrap) rankWrap.innerHTML = safeHTML(renderRankWrapHtml(r.rank));

                // 2. Update Stats
                const age = row.querySelector('.stat-age');
                if (age) age.textContent = r.age || '—';

                const played = row.querySelector('.stat-played');
                if (played) played.textContent = r.matches_played;

                const rate = row.querySelector('.stat-rate');
                if (rate) rate.textContent = r.win_rate + '%';

                const diff = row.querySelector('.stat-diff');
                if (diff) {
                    diff.style.color = r.points_this_week > 0 ? 'var(--c-green)' : r.points_this_week < 0 ? '#ef4444' : 'var(--c-text-muted)';
                    diff.textContent = (r.points_this_week > 0 ? '+' : '') + (r.points_this_week !== 0 ? r.points_this_week : '—');
                }

                // 3. Update Points Column (and mobile stacked badge)
                const totalWrap = row.querySelector('.total-wrap-el');
                if (totalWrap) totalWrap.innerHTML = safeHTML(renderTotalWrapHtml(r.points, r.points_this_week));

                // Move DOM element to current position to respect new sorting order without rebuilding it
            } else {
                // ROW DOES NOT EXIST: Create it brand new
                row = document.createElement('div');
                row.className = 'rank-grid-full';
                row.setAttribute('data-player-code', r.player_code);
                row.style.cssText = 'padding:18px 15px 18px 10px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;';
                row.onclick = () => Router.navigate('/profile/view/' + r.player_code);
                row.onmouseover = function () { this.style.background = 'rgba(255,255,255,0.02)'; };
                row.onmouseout = function () { this.style.background = 'transparent'; };

                // Rank
                const rankWrap = document.createElement('div');
                rankWrap.className = 'rank-wrap-el';
                rankWrap.style.cssText = 'display:flex; justify-content:center; align-items:center;';
                rankWrap.innerHTML = safeHTML(renderRankWrapHtml(r.rank));

                // Player Info (Avatar & Name)
                const infoWrap = document.createElement('div');
                infoWrap.style.cssText = 'display:flex; align-items:center; gap:12px; min-width:0; position:relative;';

                const isPlayerMe = currentUserId && parseInt(r.user_id) === parseInt(currentUserId);
                const hasStory = !!r.has_active_story;
                const extraAttr = hasStory ? `onclick="event.stopPropagation(); StoriesController.playUserStories(${r.user_id})"` : '';
                const ringClass = isPlayerMe ? 'gold-ring' : (hasStory ? 'story-ring' : '');
                const avatarHtml = UI.getAvatarHtml(thumb, 'width:100%;height:100%;object-fit:cover;border-radius:50%;', `width:40px; height:40px; border-radius:50%; flex-shrink:0; border:2px solid var(--c-border);`, initials, ringClass, extraAttr);

                const avatarDiv = document.createElement('div');
                avatarDiv.innerHTML = safeHTML(avatarHtml);

                const nameWrap = document.createElement('div');
                nameWrap.style.cssText = 'min-width:0; overflow:hidden;';

                const nameLine = document.createElement('div');
                nameLine.style.cssText = 'display:flex; align-items:center; gap:8px;';

                const nick = document.createElement('div');
                nick.style.cssText = 'font-size:15px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                nick.textContent = r.nickname;

                const code = document.createElement('span');
                code.style.cssText = 'font-size:10px; background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:4px; color:var(--c-text-muted); font-family:monospace; font-weight:600; text-transform:uppercase; flex-shrink:0;';
                code.textContent = r.player_code;

                nameLine.appendChild(nick);
                nameLine.appendChild(code);

                const full = document.createElement('div');
                full.style.cssText = 'font-size:12px; color:var(--c-text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px;';
                full.textContent = (r.first_name || '') + ' ' + (r.last_name || '');

                nameWrap.appendChild(nameLine);
                nameWrap.appendChild(full);

                infoWrap.appendChild(avatarDiv);
                infoWrap.appendChild(nameWrap);

                // Stats
                const age = document.createElement('span');
                age.className = 'hide-mobile stat-age';
                age.style.cssText = 'text-align:center; font-size:14px; font-weight:600; color:var(--c-text-muted);';
                age.textContent = r.age || '—';

                const played = document.createElement('span');
                played.className = 'hide-mobile stat-played';
                played.style.cssText = 'text-align:center; font-size:14px; font-weight:600; color:var(--c-text);';
                played.textContent = r.matches_played;

                const rate = document.createElement('span');
                rate.className = 'hide-mobile stat-rate';
                rate.style.cssText = 'text-align:center; font-size:14px; font-weight:600; color:var(--c-green);';
                rate.textContent = r.win_rate + '%';

                const diff = document.createElement('span');
                diff.className = 'hide-mobile stat-diff';
                diff.style.cssText = `text-align:center; font-size:13px; font-weight:600; color:${r.points_this_week > 0 ? 'var(--c-green)' : r.points_this_week < 0 ? '#ef4444' : 'var(--c-text-muted)'};`;
                diff.textContent = (r.points_this_week > 0 ? '+' : '') + (r.points_this_week !== 0 ? r.points_this_week : '—');

                // Points column wrapper (mobile: stacked number + badge)
                const totalWrap = document.createElement('div');
                totalWrap.className = 'total-wrap-el';
                totalWrap.style.cssText = 'display:flex; flex-direction:column; align-items:flex-end; padding-right:5px;';
                totalWrap.innerHTML = safeHTML(renderTotalWrapHtml(r.points, r.points_this_week));

                row.appendChild(rankWrap);
                row.appendChild(infoWrap);
                row.appendChild(age);
                row.appendChild(played);
                row.appendChild(rate);
                row.appendChild(diff);
                row.appendChild(totalWrap);
            }

            // Apply Highlight for Current User
            const isMe = currentUserId && parseInt(r.user_id) === parseInt(currentUserId);
            if (isMe) {
                row.classList.add('gold-glass-shimmer');
                row.style.background = 'linear-gradient(135deg, rgba(255, 223, 128, 0.22) 0%, rgba(240, 208, 120, 0.06) 50%, rgba(218, 165, 32, 0.02) 100%)';
                row.style.border = '1px solid rgba(255, 223, 128, 0.22)';
                row.style.borderRadius = '16px';
                row.style.marginBottom = '6px';
                row.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 12px rgba(255, 223, 128, 0.05)';
                row.style.backdropFilter = 'blur(10px)';
                row.style.webkitBackdropFilter = 'blur(10px)';
                row.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                row.onmouseover = function () {
                    this.style.background = 'linear-gradient(135deg, rgba(255, 223, 128, 0.3) 0%, rgba(240, 208, 120, 0.1) 50%, rgba(218, 165, 32, 0.04) 100%)';
                    this.style.borderColor = 'rgba(255, 223, 128, 0.35)';
                    this.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 0 16px rgba(255, 223, 128, 0.08)';
                    this.style.transform = 'translateY(-1px)';
                };
                row.onmouseout = function () {
                    this.style.background = 'linear-gradient(135deg, rgba(255, 223, 128, 0.22) 0%, rgba(240, 208, 120, 0.06) 50%, rgba(218, 165, 32, 0.02) 100%)';
                    this.style.borderColor = 'rgba(255, 223, 128, 0.22)';
                    this.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 12px rgba(255, 223, 128, 0.05)';
                    this.style.transform = 'none';
                };
            } else {
                row.classList.remove('gold-glass-shimmer');
                row.style.background = 'transparent';
                row.style.border = 'none';
                row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
                row.style.borderRadius = '0';
                row.style.marginBottom = '0';
                row.style.boxShadow = 'none';
                row.style.backdropFilter = 'none';
                row.style.webkitBackdropFilter = 'none';
                row.style.transform = 'none';
                row.style.transition = 'all 0.2s';
                row.onmouseover = function () { this.style.background = 'rgba(255,255,255,0.02)'; };
                row.onmouseout = function () { this.style.background = 'transparent'; };
            }

            listEl.appendChild(row);
        });
    }

};

// ── Announcement Detail Controller ───────────────────────────────────────
const AnnouncementController = {
    init: async function (params) {
        const id = params?.id;
        const skeleton = document.getElementById('announcement-detail-skeleton');
        const content = document.getElementById('announcement-detail-content');

        if (!id) {
            Router.navigate('/dashboard');
            return;
        }

        if (skeleton) skeleton.style.display = 'block';
        if (content) content.style.display = 'none';

        try {
            const res = await API.post('/announcements/get', { id: id });
            if (res && res.success && res.data && res.data.announcement) {
                const a = res.data.announcement;

                document.getElementById('announcement-detail-img').src = `${CONFIG.ASSET_BASE}/${a.image_url}`;
                document.getElementById('announcement-detail-title').innerText = a.title;

                // Set body HTML content safely
                document.getElementById('announcement-detail-body').innerHTML = a.body;

                if (skeleton) skeleton.style.display = 'none';
                if (content) content.style.display = 'block';
            } else {
                API.toast(res.message || 'Announcement not found.', 'error');
                Router.navigate('/dashboard');
            }
        } catch (e) {
            console.error('Error loading announcement details:', e);
            Router.navigate('/dashboard');
        }
    }
};


