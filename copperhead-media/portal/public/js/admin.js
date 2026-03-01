/* ──────────────────────────────────────────────
   copperhead. admin panel — admin.js
   Full CRUD for posts, assets, analytics
   ────────────────────────────────────────────── */

(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const API = '/api';
    const PLATFORM_ICONS = {
        instagram: '<svg class="plat-svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
        tiktok: '<svg class="plat-svg" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>',
        facebook: '<svg class="plat-svg" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>'
    };
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const STATUS_LABELS = {
        draft: 'Draft', pending: 'Pending Review', approved: 'Approved',
        revision: 'Needs Revision', scheduled: 'Scheduled', published: 'Published'
    };

    let adminCalYear, adminCalMonth;

    /* ── Init ──────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        const now = new Date();
        adminCalYear = now.getFullYear();
        adminCalMonth = now.getMonth();
        bindNav();
        bindEditModal();
        $('#logoutBtn').addEventListener('click', logout);
        navigate('dashboard');
    });

    /* ── Navigation ────────────────────────────── */
    function bindNav() {
        $$('.sidebar-nav a[data-view]').forEach(a => {
            a.addEventListener('click', () => navigate(a.dataset.view));
        });
    }

    function navigate(view) {
        $$('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        const nav = $(`.sidebar-nav a[data-view="${view}"]`);
        if (nav) nav.classList.add('active');

        const main = $('#mainContent');
        main.classList.add('view-exit');
        setTimeout(() => {
            renderView(view, main);
            main.classList.remove('view-exit');
            main.classList.add('view-enter');
            setTimeout(() => main.classList.remove('view-enter'), 300);
        }, 150);
    }

    function renderView(view, el) {
        switch (view) {
            case 'dashboard': renderDashboard(el); break;
            case 'manage-posts': renderManagePosts(el); break;
            case 'content-calendar': renderContentCalendar(el); break;
            case 'create-post': renderCreatePost(el); break;
            case 'manage-assets': renderManageAssets(el); break;
            case 'analytics-input': renderAnalyticsInput(el); break;
        }
    }

    /* ── Helpers ────────────────────────────────── */
    async function api(path, opts = {}) {
        const headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
        const res = await fetch(API + path, { headers: { ...headers, ...opts.headers }, ...opts });
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (res.status === 403) { window.location.href = '/login'; return null; }
        if (!res.ok) return null;
        return res.json();
    }

    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function fmtNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function truncate(str, len) {
        return (!str || str.length <= len) ? (str || '') : str.slice(0, len) + '…';
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async function logout() {
        await fetch(API + '/logout', { method: 'POST' });
        window.location.href = '/login';
    }

    /* ────────────────────────────────────────────
       VIEW: Dashboard
       ──────────────────────────────────────────── */
    async function renderDashboard(el) {
        el.innerHTML = `
            <div class="view-header">
                <h2>Admin Dashboard</h2>
                <p class="view-subtitle">Manage content for <strong>journals.</strong></p>
            </div>
            <div class="admin-stats" id="adminStats">Loading…</div>
            <div class="quick-actions">
                <button class="quick-action-btn" data-action="create-post">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Post
                </button>
                <button class="quick-action-btn" data-action="manage-posts">
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Manage Posts
                </button>
                <button class="quick-action-btn" data-action="manage-assets">
                    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Upload Assets
                </button>
            </div>
            <div class="overview-grid">
                <div class="overview-section">
                    <h3>Posts by Status</h3>
                    <div class="status-columns" id="statusColumns">Loading…</div>
                </div>
                <div class="overview-section">
                    <h3>Recent Activity</h3>
                    <div class="activity-list" id="activityList">Loading…</div>
                </div>
            </div>`;

        // Quick action buttons
        $$('.quick-action-btn', el).forEach(btn => {
            btn.addEventListener('click', () => navigate(btn.dataset.action));
        });

        // Load all posts for stats + columns
        const posts = await api('/posts') || [];

        // Stats
        const counts = { draft: 0, pending: 0, approved: 0, scheduled: 0, published: 0 };
        posts.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });

        $('#adminStats').innerHTML = `
            <div class="admin-stat"><div class="stat-value">${posts.length}</div><div class="stat-label">Total Posts</div></div>
            <div class="admin-stat accent"><div class="stat-value">${counts.pending}</div><div class="stat-label">Pending Review</div></div>
            <div class="admin-stat"><div class="stat-value">${counts.approved + counts.scheduled}</div><div class="stat-label">Ready to Go</div></div>
            <div class="admin-stat"><div class="stat-value">${counts.published}</div><div class="stat-label">Published</div></div>
            <div class="admin-stat"><div class="stat-value">${counts.draft}</div><div class="stat-label">Drafts</div></div>`;

        // Status columns (kanban-ish)
        const groups = { draft: [], pending: [], approved: [], scheduled: [], published: [] };
        posts.forEach(p => { if (groups[p.status]) groups[p.status].push(p); });

        $('#statusColumns').innerHTML = Object.entries(groups).map(([status, items]) => `
            <div class="status-column">
                <div class="status-column-header">
                    <h4>${STATUS_LABELS[status] || status}</h4>
                    <span class="count">${items.length}</span>
                </div>
                <div class="column-posts">
                    ${items.length === 0 ? '<p class="empty-state" style="padding:1rem;font-size:0.75rem;">No posts</p>' :
                    items.slice(0, 5).map(p => `
                        <div class="column-post-card" data-id="${p.id}">
                            <div class="card-title">${esc(truncate(p.title, 30))}</div>
                            <div class="card-meta">
                                <span class="platform-icon-sm">${PLATFORM_ICONS[p.platform]}</span>
                                <span>${fmtDate(p.scheduled_date)}</span>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`).join('');

        $$('.column-post-card', el).forEach(card => {
            card.addEventListener('click', () => openEditModal(card.dataset.id));
        });

        // Recent activity (last 8 posts by update date)
        const recent = [...posts].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
        $('#activityList').innerHTML = recent.map(p => `
            <div class="activity-item" data-id="${p.id}" style="cursor:pointer">
                <span class="activity-dot ${p.status}"></span>
                <div class="activity-info">
                    <div class="activity-title">${esc(p.title)}</div>
                    <div class="activity-meta">${PLATFORM_ICONS[p.platform]} ${STATUS_LABELS[p.status]} · ${fmtDate(p.scheduled_date)}</div>
                </div>
            </div>`).join('');

        $$('.activity-item', el).forEach(item => {
            item.addEventListener('click', () => openEditModal(item.dataset.id));
        });
    }

    /* ────────────────────────────────────────────
       VIEW: Content Calendar
       ──────────────────────────────────────────── */
    async function renderContentCalendar(el) {
        el.innerHTML = `
            <div class="view-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
                <div>
                    <h2>Content Calendar</h2>
                    <p class="view-subtitle">Visual overview of scheduled content</p>
                </div>
                <div class="admin-cal-controls">
                    <button class="btn-icon" id="acalPrev">
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span class="admin-cal-month" id="acalLabel"></span>
                    <button class="btn-icon" id="acalNext">
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            </div>
            <div class="admin-cal-legend">
                <span><i class="dot draft"></i>Draft</span>
                <span><i class="dot pending"></i>Pending</span>
                <span><i class="dot approved"></i>Approved</span>
                <span><i class="dot scheduled"></i>Scheduled</span>
                <span><i class="dot published"></i>Published</span>
            </div>
            <div class="admin-cal-grid" id="acalGrid"></div>`;

        $('#acalPrev').addEventListener('click', () => { adminCalMonth--; if (adminCalMonth < 0) { adminCalMonth = 11; adminCalYear--; } loadAdminCalendar(); });
        $('#acalNext').addEventListener('click', () => { adminCalMonth++; if (adminCalMonth > 11) { adminCalMonth = 0; adminCalYear++; } loadAdminCalendar(); });

        await loadAdminCalendar();
    }

    async function loadAdminCalendar() {
        const label = $('#acalLabel');
        const grid = $('#acalGrid');
        if (!label || !grid) return;

        label.textContent = `${MONTHS[adminCalMonth]} ${adminCalYear}`;

        let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
            .map(d => `<div class="acal-header">${d}</div>`).join('');

        const first = new Date(adminCalYear, adminCalMonth, 1).getDay();
        const days = new Date(adminCalYear, adminCalMonth + 1, 0).getDate();
        const today = new Date();

        const posts = await api(`/posts?month=${adminCalMonth + 1}&year=${adminCalYear}`) || [];
        const byDay = {};
        posts.forEach(p => {
            if (!p.scheduled_date) return;
            const d = new Date(p.scheduled_date).getDate();
            (byDay[d] = byDay[d] || []).push(p);
        });

        for (let i = 0; i < first; i++) html += '<div class="acal-day empty"></div>';

        for (let d = 1; d <= days; d++) {
            const isToday = d === today.getDate() && adminCalMonth === today.getMonth() && adminCalYear === today.getFullYear();
            html += `<div class="acal-day${isToday ? ' today' : ''}">`;
            html += `<div class="acal-num">${d}</div>`;
            if (byDay[d]) {
                byDay[d].forEach(p => {
                    html += `<div class="acal-pill status-${p.status}" data-id="${p.id}" title="${esc(p.title)}">
                        <span class="acal-pill-icon">${PLATFORM_ICONS[p.platform]}</span>
                        ${esc(truncate(p.title, 16))}
                    </div>`;
                });
            }
            html += '</div>';
        }

        grid.innerHTML = html;

        $$('.acal-pill', grid).forEach(pill => {
            pill.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(pill.dataset.id); });
        });
    }

    /* ────────────────────────────────────────────
       VIEW: Manage Posts
       ──────────────────────────────────────────── */
    async function renderManagePosts(el) {
        el.innerHTML = `
            <div class="view-header">
                <h2>Manage Posts</h2>
                <div class="posts-filters">
                    <select id="mFilterStatus" class="filter-select">
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="revision">Revision</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                    </select>
                    <select id="mFilterPlatform" class="filter-select">
                        <option value="">All Platforms</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="facebook">Facebook</option>
                    </select>
                    <button class="btn-primary btn-sm" onclick="document.querySelector('[data-view=create-post]').click()">+ New Post</button>
                </div>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Platform</th>
                            <th>Status</th>
                            <th>Scheduled</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="managePostsBody">
                        <tr><td colspan="5" class="loading-row">Loading…</td></tr>
                    </tbody>
                </table>
            </div>`;

        const loadPosts = async () => {
            const status = $('#mFilterStatus').value;
            const platform = $('#mFilterPlatform').value;
            let url = '/posts?';
            if (status) url += `status=${status}&`;
            if (platform) url += `platform=${platform}&`;
            const posts = await api(url) || [];
            const tbody = $('#managePostsBody');

            if (posts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No posts found</td></tr>';
                return;
            }

            tbody.innerHTML = posts.map(p => `
                <tr>
                    <td class="post-title-cell">
                        <span class="platform-icon">${PLATFORM_ICONS[p.platform]}</span>
                        ${esc(truncate(p.title, 40))}
                    </td>
                    <td class="capitalize">${p.platform}</td>
                    <td><span class="status-badge status-${p.status}">${STATUS_LABELS[p.status]}</span></td>
                    <td>${fmtDate(p.scheduled_date)}</td>
                    <td class="actions-cell">
                        <button class="btn-table btn-edit" data-id="${p.id}">Edit</button>
                        <button class="btn-table btn-status" data-id="${p.id}" data-status="${p.status}">
                            ${p.status === 'draft' ? '→ Pending' : p.status === 'pending' ? '→ Approve' : p.status === 'revision' ? '→ Pending' : ''}
                        </button>
                        <button class="btn-table btn-table-danger btn-delete" data-id="${p.id}">Delete</button>
                    </td>
                </tr>`).join('');

            $$('.btn-edit', tbody).forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));

            $$('.btn-status', tbody).forEach(btn => {
                if (!btn.textContent.trim()) { btn.style.display = 'none'; return; }
                btn.addEventListener('click', async () => {
                    const s = btn.dataset.status;
                    const next = s === 'draft' ? 'pending' : s === 'pending' ? 'approved' : s === 'revision' ? 'pending' : null;
                    if (!next) return;
                    await api('/posts/' + btn.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: next }) });
                    await loadPosts();
                });
            });

            $$('.btn-delete', tbody).forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this post permanently?')) return;
                    await api('/posts/' + btn.dataset.id, { method: 'DELETE' });
                    await loadPosts();
                });
            });
        };

        $('#mFilterStatus').addEventListener('change', loadPosts);
        $('#mFilterPlatform').addEventListener('change', loadPosts);
        await loadPosts();
    }

    /* ────────────────────────────────────────────
       VIEW: Create Post
       ──────────────────────────────────────────── */
    function renderCreatePost(el) {
        el.innerHTML = `
            <div class="view-header">
                <h2>Create New Post</h2>
                <p class="view-subtitle">Draft a new post for the client content calendar</p>
            </div>
            <div class="form-success" id="createSuccess">Post created successfully!</div>
            <form class="admin-form" id="createPostForm">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" class="form-input" id="postTitle" placeholder="e.g. Spring Collection Launch" required>
                </div>
                <div class="form-group">
                    <label>Caption / Copy</label>
                    <textarea class="form-textarea" id="postCaption" placeholder="Write the post caption here… Include hashtags, CTAs, etc." rows="5"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Platform</label>
                        <select class="form-select" id="postPlatform" required>
                            <option value="">Select platform</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="facebook">Facebook</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Media Type</label>
                        <select class="form-select" id="postMediaType">
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Scheduled Date</label>
                        <input type="date" class="form-input" id="postDate">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-select" id="postStatus">
                            <option value="draft">Draft</option>
                            <option value="pending">Pending Review</option>
                            <option value="approved">Approved</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="published">Published</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-admin btn-admin-primary">Create Post</button>
                    <button type="button" class="btn-admin btn-admin-secondary" id="createAnother" style="display:none">Create Another</button>
                </div>
            </form>`;

        $('#createPostForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: $('#postTitle').value.trim(),
                caption: $('#postCaption').value.trim(),
                platform: $('#postPlatform').value,
                media_type: $('#postMediaType').value,
                scheduled_date: $('#postDate').value || null,
                status: $('#postStatus').value
            };
            const post = await api('/posts', { method: 'POST', body: JSON.stringify(data) });
            if (post) {
                const success = $('#createSuccess');
                success.classList.add('show');
                $('#createAnother').style.display = 'inline-block';
                setTimeout(() => success.classList.remove('show'), 4000);
            }
        });

        $('#createAnother').addEventListener('click', () => {
            $('#createPostForm').reset();
            $('#createAnother').style.display = 'none';
        });
    }

    /* ────────────────────────────────────────────
       VIEW: Manage Assets
       ──────────────────────────────────────────── */
    async function renderManageAssets(el) {
        el.innerHTML = `
            <div class="view-header">
                <h2>Manage Assets</h2>
                <button class="btn-primary" id="adminUploadBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Upload Files
                </button>
            </div>
            <div class="dropzone" id="adminDropzone">
                <svg viewBox="0 0 24 24" width="40" height="40"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                <p>Drop files here to upload</p>
                <span class="dropzone-hint">Images, videos, PDFs — up to 100MB each</span>
            </div>
            <div class="asset-grid" id="adminAssetGrid">Loading…</div>`;

        const fileInput = $('#fileInput');
        $('#adminUploadBtn').addEventListener('click', () => fileInput.click());
        fileInput.onchange = async () => {
            if (fileInput.files.length === 0) return;
            for (const file of fileInput.files) {
                const form = new FormData();
                form.append('file', file);
                await fetch(API + '/assets', { method: 'POST', body: form });
            }
            fileInput.value = '';
            await loadAdminAssets();
        };

        const dz = $('#adminDropzone');
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', async e => {
            e.preventDefault();
            dz.classList.remove('dragover');
            for (const file of e.dataTransfer.files) {
                const form = new FormData();
                form.append('file', file);
                await fetch(API + '/assets', { method: 'POST', body: form });
            }
            await loadAdminAssets();
        });

        await loadAdminAssets();
    }

    async function loadAdminAssets() {
        const assets = await api('/assets') || [];
        const grid = $('#adminAssetGrid');
        if (!grid) return;

        if (assets.length === 0) {
            grid.innerHTML = '<p class="empty-state">No assets uploaded yet</p>';
            return;
        }

        grid.innerHTML = assets.map(a => {
            const isImage = a.file_type && a.file_type.startsWith('image');
            const isVideo = a.file_type && a.file_type.startsWith('video');
            let preview = isImage ? `<img src="/uploads/${a.filename}" alt="${esc(a.original_name)}" loading="lazy">` :
                          isVideo ? `<video src="/uploads/${a.filename}" muted></video>` :
                          `<div class="file-icon"><svg class="plat-svg" viewBox="0 0 24 24" style="width:28px;height:28px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
            return `
                <div class="asset-card" data-id="${a.id}">
                    <div class="asset-preview">${preview}</div>
                    <div class="asset-info">
                        <span class="asset-name" title="${esc(a.original_name)}">${esc(truncate(a.original_name, 24))}</span>
                        <span class="asset-size">${formatBytes(a.file_size)}</span>
                    </div>
                    <button class="asset-delete" data-id="${a.id}" title="Delete">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>`;
        }).join('');

        $$('.asset-delete', grid).forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this asset?')) return;
                await fetch(API + '/assets/' + btn.dataset.id, { method: 'DELETE' });
                await loadAdminAssets();
            });
        });
    }

    /* ────────────────────────────────────────────
       VIEW: Analytics Input
       ──────────────────────────────────────────── */
    async function renderAnalyticsInput(el) {
        // Load Chart.js if not loaded
        if (!window.Chart) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        el.innerHTML = `
            <div class="view-header">
                <h2>Analytics Overview</h2>
                <p class="view-subtitle">Performance data for the journals. account</p>
            </div>
            <div class="stat-cards" id="aStats">
                <div class="stat-card skeleton"><div class="stat-value">—</div><div class="stat-label">Loading…</div></div>
                <div class="stat-card skeleton"><div class="stat-value">—</div><div class="stat-label">Loading…</div></div>
                <div class="stat-card skeleton"><div class="stat-value">—</div><div class="stat-label">Loading…</div></div>
                <div class="stat-card skeleton"><div class="stat-value">—</div><div class="stat-label">Loading…</div></div>
            </div>
            <div class="analytics-charts">
                <div class="chart-card">
                    <h3>30-Day Performance</h3>
                    <canvas id="adminChart" height="300"></canvas>
                </div>
            </div>
            <div style="margin-top:2rem">
                <div class="overview-section">
                    <h3>Platform Breakdown</h3>
                    <div id="adminBreakdown" class="breakdown-list" style="max-width:500px">Loading…</div>
                </div>
            </div>`;

        const [rawSummary, rawData] = await Promise.all([api('/analytics/summary'), api('/analytics')]);

        // Flatten summary
        if (rawSummary && rawSummary.current) {
            const totals = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            const prev = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            rawSummary.current.forEach(r => { if (totals[r.metric] !== undefined) totals[r.metric] += r.total; });
            (rawSummary.previous || []).forEach(r => { if (prev[r.metric] !== undefined) prev[r.metric] += r.total; });
            const pct = (c, p) => p ? (((c - p) / p) * 100) : 0;

            $('#aStats').innerHTML = `
                <div class="stat-card"><div class="stat-value">${fmtNum(totals.impressions)}</div><div class="stat-label">Impressions</div>
                <div class="stat-trend ${pct(totals.impressions, prev.impressions) >= 0 ? 'up' : 'down'}">${pct(totals.impressions, prev.impressions) >= 0 ? '↑' : '↓'} ${Math.abs(pct(totals.impressions, prev.impressions)).toFixed(1)}%</div></div>
                <div class="stat-card"><div class="stat-value">${fmtNum(totals.reach)}</div><div class="stat-label">Reach</div>
                <div class="stat-trend ${pct(totals.reach, prev.reach) >= 0 ? 'up' : 'down'}">${pct(totals.reach, prev.reach) >= 0 ? '↑' : '↓'} ${Math.abs(pct(totals.reach, prev.reach)).toFixed(1)}%</div></div>
                <div class="stat-card"><div class="stat-value">${fmtNum(totals.engagement)}</div><div class="stat-label">Engagements</div>
                <div class="stat-trend ${pct(totals.engagement, prev.engagement) >= 0 ? 'up' : 'down'}">${pct(totals.engagement, prev.engagement) >= 0 ? '↑' : '↓'} ${Math.abs(pct(totals.engagement, prev.engagement)).toFixed(1)}%</div></div>
                <div class="stat-card"><div class="stat-value">${fmtNum(totals.followers)}</div><div class="stat-label">Followers</div>
                <div class="stat-trend ${pct(totals.followers, prev.followers) >= 0 ? 'up' : 'down'}">${pct(totals.followers, prev.followers) >= 0 ? '↑' : '↓'} ${Math.abs(pct(totals.followers, prev.followers)).toFixed(1)}%</div></div>`;
        }

        // Chart
        if (rawData && rawData.length > 0) {
            const byDate = {};
            rawData.forEach(r => {
                if (!byDate[r.date]) byDate[r.date] = { impressions: 0, reach: 0, engagement: 0 };
                if (r.metric === 'impressions') byDate[r.date].impressions += r.value;
                if (r.metric === 'reach') byDate[r.date].reach += r.value;
                if (r.metric === 'engagement') byDate[r.date].engagement += r.value;
            });
            const dates = Object.keys(byDate).sort();
            const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

            new Chart($('#adminChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Impressions', data: dates.map(d => byDate[d].impressions), borderColor: '#B7491E', backgroundColor: 'rgba(183,73,30,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Reach', data: dates.map(d => byDate[d].reach), borderColor: '#A67B5B', backgroundColor: 'rgba(166,123,91,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Engagements', data: dates.map(d => byDate[d].engagement), borderColor: '#6B5B4E', backgroundColor: 'rgba(107,91,78,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { font: { family: "'DM Sans'" }, usePointStyle: true, padding: 20 } } },
                    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => fmtNum(v) } } }
                }
            });

            // Platform breakdown
            const platTotals = {};
            rawData.forEach(r => {
                if (r.metric !== 'impressions') return;
                platTotals[r.platform] = (platTotals[r.platform] || 0) + r.value;
            });
            const maxPlat = Math.max(...Object.values(platTotals), 1);
            $('#adminBreakdown').innerHTML = Object.entries(platTotals).map(([p, v]) => `
                <div class="breakdown-row">
                    <div class="breakdown-label">${PLATFORM_ICONS[p]} <span class="capitalize">${p}</span></div>
                    <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${(v / maxPlat * 100).toFixed(1)}%"></div></div>
                    <div class="breakdown-value">${fmtNum(v)}</div>
                </div>`).join('');
        }
    }

    /* ────────────────────────────────────────────
       Edit Post Modal
       ──────────────────────────────────────────── */
    function bindEditModal() {
        $('#editModalBackdrop').addEventListener('click', closeEditModal);
        $('#editModalClose').addEventListener('click', closeEditModal);
    }

    function closeEditModal() {
        $('#editModal').classList.remove('open');
    }

    async function openEditModal(id) {
        const post = await api('/posts/' + id);
        if (!post) return;

        const comments = await api(`/posts/${id}/comments`) || [];

        const header = $('#editModalHeader');
        header.innerHTML = `
            <div class="modal-post-header">
                <span class="platform-icon-lg">${PLATFORM_ICONS[post.platform]}</span>
                <div>
                    <h3>Edit Post</h3>
                    <span class="capitalize">${post.platform}</span> · <span class="status-badge status-${post.status}">${STATUS_LABELS[post.status]}</span>
                </div>
            </div>`;

        const body = $('#editModalBody');
        body.innerHTML = `
            <form class="admin-form" id="editPostForm">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" class="form-input" id="editTitle" value="${esc(post.title)}" required>
                </div>
                <div class="form-group">
                    <label>Caption</label>
                    <textarea class="form-textarea" id="editCaption" rows="4">${esc(post.caption || '')}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Platform</label>
                        <select class="form-select" id="editPlatform">
                            <option value="instagram" ${post.platform === 'instagram' ? 'selected' : ''}>Instagram</option>
                            <option value="tiktok" ${post.platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                            <option value="facebook" ${post.platform === 'facebook' ? 'selected' : ''}>Facebook</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-select" id="editStatus">
                            <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
                            <option value="pending" ${post.status === 'pending' ? 'selected' : ''}>Pending Review</option>
                            <option value="approved" ${post.status === 'approved' ? 'selected' : ''}>Approved</option>
                            <option value="revision" ${post.status === 'revision' ? 'selected' : ''}>Needs Revision</option>
                            <option value="scheduled" ${post.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                            <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Scheduled Date</label>
                        <input type="date" class="form-input" id="editDate" value="${post.scheduled_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>Media Type</label>
                        <select class="form-select" id="editMediaType">
                            <option value="image" ${post.media_type === 'image' ? 'selected' : ''}>Image</option>
                            <option value="video" ${post.media_type === 'video' ? 'selected' : ''}>Video</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-admin btn-admin-primary">Save Changes</button>
                    <button type="button" class="btn-admin btn-admin-danger" id="editDeleteBtn">Delete Post</button>
                </div>
            </form>

            <div class="modal-section" style="margin-top:1.5rem">
                <label style="display:block;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--earth);margin-bottom:0.75rem;font-weight:500">Comments (${comments.length})</label>
                <div class="comments-list" style="max-height:200px;overflow-y:auto">
                    ${comments.length === 0 ? '<p class="empty-state">No comments yet</p>' :
                    comments.map(c => `
                        <div class="comment ${c.is_internal ? 'internal' : ''}">
                            <div class="comment-header">
                                <strong>${esc(c.author)}</strong>
                                ${c.is_internal ? '<span class="comment-tag">Internal</span>' : ''}
                                <span class="comment-date">${fmtDate(c.created_at)}</span>
                            </div>
                            <p>${esc(c.content)}</p>
                        </div>`).join('')}
                </div>
                <form id="adminCommentForm" style="margin-top:0.75rem">
                    <textarea class="form-textarea" id="adminCommentInput" placeholder="Add an internal note or reply…" rows="2" style="min-height:60px"></textarea>
                    <div class="comment-form-actions" style="margin-top:0.5rem;display:flex;gap:0.5rem;align-items:center">
                        <label class="checkbox-label" style="font-size:0.75rem;color:var(--earth)">
                            <input type="checkbox" id="adminCommentInternal" checked> Internal note
                        </label>
                        <button type="submit" class="btn-admin btn-admin-primary" style="padding:0.45rem 1rem;font-size:0.75rem">Post</button>
                    </div>
                </form>
            </div>`;

        // Save
        $('#editPostForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await api('/posts/' + post.id, {
                method: 'PATCH',
                body: JSON.stringify({
                    title: $('#editTitle').value.trim(),
                    caption: $('#editCaption').value.trim(),
                    platform: $('#editPlatform').value,
                    status: $('#editStatus').value,
                    scheduled_date: $('#editDate').value || null,
                    media_type: $('#editMediaType').value
                })
            });
            closeEditModal();
            navigate($$('.sidebar-nav a.active')[0]?.dataset?.view || 'dashboard');
        });

        // Delete
        $('#editDeleteBtn').addEventListener('click', async () => {
            if (!confirm('Delete this post permanently?')) return;
            await api('/posts/' + post.id, { method: 'DELETE' });
            closeEditModal();
            navigate($$('.sidebar-nav a.active')[0]?.dataset?.view || 'dashboard');
        });

        // Comment
        $('#adminCommentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = $('#adminCommentInput').value.trim();
            if (!content) return;
            await api(`/posts/${post.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    author: 'Copperhead',
                    content,
                    is_internal: $('#adminCommentInternal').checked
                })
            });
            openEditModal(post.id); // refresh
        });

        $('#editModal').classList.add('open');
    }

})();
