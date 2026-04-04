/* ──────────────────────────────────────────────
   copperhead. admin panel — admin.js
   Campaign analytics + asset management
   ────────────────────────────────────────────── */

(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const API = '/api';
    const PLATFORM_ICONS = {
        instagram: '<svg class="plat-svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
        tiktok: '<svg class="plat-svg" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>'
    };

    let r2Available = false;

    /* ── Init ──────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', async () => {
        bindNav();
        $('#logoutBtn').addEventListener('click', logout);
        // Check if R2 is configured
        try {
            var status = await api('/uploads/status');
            r2Available = status && status.r2Configured;
        } catch (e) { /* ignore */ }
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
        var nav = $('.sidebar-nav a[data-view="' + view + '"]');
        if (nav) nav.classList.add('active');

        var main = $('#mainContent');
        main.classList.add('view-exit');
        setTimeout(function() {
            renderView(view, main);
            main.classList.remove('view-exit');
            main.classList.add('view-enter');
            setTimeout(function() { main.classList.remove('view-enter'); }, 300);
        }, 150);
    }

    function renderView(view, el) {
        switch (view) {
            case 'dashboard': renderDashboard(el); break;
            case 'manage-assets': renderManageAssets(el); break;
            case 'analytics-input': renderAnalyticsInput(el); break;
        }
    }

    /* ── Helpers ────────────────────────────────── */
    async function api(path, opts) {
        opts = opts || {};
        var headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
        var res = await fetch(API + path, { headers: Object.assign({}, headers, opts.headers || {}), method: opts.method || 'GET', body: opts.body });
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (res.status === 403) { window.location.href = '/login'; return null; }
        if (!res.ok) return null;
        return res.json();
    }

    function fmtNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    function esc(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function truncate(str, len) {
        return (!str || str.length <= len) ? (str || '') : str.slice(0, len) + '...';
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        var k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async function logout() {
        await fetch(API + '/logout', { method: 'POST' });
        window.location.href = '/login';
    }

    /* ────────────────────────────────────────────
       VIEW: Dashboard  (analytics-focused overview)
       ──────────────────────────────────────────── */
    async function renderDashboard(el) {
        el.innerHTML =
            '<div class="view-header">' +
                '<h2>Admin Dashboard</h2>' +
                '<p class="view-subtitle">Campaign analytics for <strong>journals.</strong></p>' +
            '</div>' +
            '<div class="admin-stats" id="adminStats">' +
                '<div class="admin-stat skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="admin-stat skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="admin-stat skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="admin-stat skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
            '</div>' +
            '<div class="quick-actions">' +
                '<button class="quick-action-btn" data-action="manage-assets">' +
                    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                    'Manage Assets' +
                '</button>' +
                '<button class="quick-action-btn" data-action="analytics-input">' +
                    '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
                    'Analytics' +
                '</button>' +
            '</div>' +
            '<div class="overview-grid">' +
                '<div class="overview-section" style="grid-column:1/-1">' +
                    '<h3>Platform Breakdown (30d)</h3>' +
                    '<div id="dashBreakdown" class="breakdown-list" style="max-width:600px">Loading...</div>' +
                '</div>' +
            '</div>';

        $$('.quick-action-btn', el).forEach(function(btn) {
            btn.addEventListener('click', function() { navigate(btn.dataset.action); });
        });

        var rawSummary = await api('/analytics/summary');

        if (rawSummary && rawSummary.current) {
            var totals = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            var prev   = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            rawSummary.current.forEach(function(r) { if (totals[r.metric] !== undefined) totals[r.metric] += r.total; });
            (rawSummary.previous || []).forEach(function(r) { if (prev[r.metric] !== undefined) prev[r.metric] += r.total; });
            var pct = function(c, p) { return p ? (((c - p) / p) * 100) : 0; };

            var engRate = totals.reach > 0 ? ((totals.engagement / totals.reach) * 100).toFixed(2) : '0.00';

            $('#adminStats').innerHTML =
                '<div class="admin-stat"><div class="stat-value">' + fmtNum(totals.impressions) + '</div><div class="stat-label">Total Views</div>' +
                '<div class="stat-trend ' + (pct(totals.impressions, prev.impressions) >= 0 ? 'up' : 'down') + '">' + (pct(totals.impressions, prev.impressions) >= 0 ? '+' : '') + pct(totals.impressions, prev.impressions).toFixed(1) + '%</div></div>' +
                '<div class="admin-stat"><div class="stat-value">' + fmtNum(totals.reach) + '</div><div class="stat-label">Reach</div>' +
                '<div class="stat-trend ' + (pct(totals.reach, prev.reach) >= 0 ? 'up' : 'down') + '">' + (pct(totals.reach, prev.reach) >= 0 ? '+' : '') + pct(totals.reach, prev.reach).toFixed(1) + '%</div></div>' +
                '<div class="admin-stat accent"><div class="stat-value">' + engRate + '%</div><div class="stat-label">Eng. Rate</div></div>' +
                '<div class="admin-stat"><div class="stat-value">' + fmtNum(totals.followers) + '</div><div class="stat-label">Followers</div>' +
                '<div class="stat-trend ' + (pct(totals.followers, prev.followers) >= 0 ? 'up' : 'down') + '">' + (pct(totals.followers, prev.followers) >= 0 ? '+' : '') + pct(totals.followers, prev.followers).toFixed(1) + '%</div></div>';

            var platTotals = {};
            rawSummary.current.forEach(function(r) {
                if (r.metric !== 'impressions') return;
                platTotals[r.platform] = (platTotals[r.platform] || 0) + r.total;
            });
            var maxPlat = Math.max.apply(null, Object.values(platTotals).concat([1]));
            var bd = $('#dashBreakdown');
            if (bd) {
                bd.innerHTML = Object.entries(platTotals).map(function(entry) {
                    var p = entry[0], v = entry[1];
                    return '<div class="breakdown-row">' +
                        '<div class="breakdown-label">' + (PLATFORM_ICONS[p] || '') + ' <span class="capitalize">' + p + '</span></div>' +
                        '<div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:' + (v / maxPlat * 100).toFixed(1) + '%"></div></div>' +
                        '<div class="breakdown-value">' + fmtNum(v) + '</div>' +
                    '</div>';
                }).join('');
            }
        }
    }

    /* ────────────────────────────────────────────
       VIEW: Manage Assets
       ──────────────────────────────────────────── */
    async function renderManageAssets(el) {
        var sizeHint = r2Available ? 'Images, videos, PDFs — no size limit (R2)' : 'Images, videos, PDFs — up to 100MB each';
        el.innerHTML =
            '<div class="view-header">' +
                '<h2>Manage Assets</h2>' +
                '<button class="btn-primary" id="adminUploadBtn">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                    ' Upload Files' +
                '</button>' +
            '</div>' +
            '<div class="dropzone" id="adminDropzone">' +
                '<svg viewBox="0 0 24 24" width="40" height="40"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>' +
                '<p>Drop files here to upload</p>' +
                '<span class="dropzone-hint">' + sizeHint + '</span>' +
            '</div>' +
            '<div id="uploadProgress"></div>' +
            '<div class="asset-grid" id="adminAssetGrid">Loading...</div>';

        var fileInput = $('#fileInput');
        $('#adminUploadBtn').addEventListener('click', function() { fileInput.click(); });
        fileInput.onchange = async function() {
            if (fileInput.files.length === 0) return;
            await uploadFiles(Array.from(fileInput.files));
            fileInput.value = '';
        };

        var dz = $('#adminDropzone');
        dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
        dz.addEventListener('drop', async function(e) {
            e.preventDefault();
            dz.classList.remove('dragover');
            await uploadFiles(Array.from(e.dataTransfer.files));
        });

        await loadAdminAssets();
    }

    /**
     * Upload files — uses R2 presigned URLs when available, falls back to local.
     * Shows per-file progress.
     */
    async function uploadFiles(files) {
        var progressEl = $('#uploadProgress');
        if (!progressEl) return;

        progressEl.innerHTML = files.map(function(f, i) {
            return '<div class="upload-item" id="upload-' + i + '">' +
                '<span class="upload-name">' + esc(f.name) + '</span>' +
                '<span class="upload-size">' + formatBytes(f.size) + '</span>' +
                '<div class="upload-bar-wrap"><div class="upload-bar" id="bar-' + i + '"></div></div>' +
                '<span class="upload-status" id="status-' + i + '">Waiting...</span>' +
            '</div>';
        }).join('');

        for (var i = 0; i < files.length; i++) {
            var statusEl = $('#status-' + i);
            var barEl = $('#bar-' + i);
            try {
                if (r2Available) {
                    await uploadToR2(files[i], barEl, statusEl);
                } else {
                    await uploadLocal(files[i], barEl, statusEl);
                }
            } catch (err) {
                if (statusEl) statusEl.textContent = 'Failed';
                if (statusEl) statusEl.style.color = '#e74c3c';
                console.error('Upload error:', err);
            }
        }

        await loadAdminAssets();

        // Clear progress after a moment
        setTimeout(function() {
            if (progressEl) progressEl.innerHTML = '';
        }, 3000);
    }

    async function uploadToR2(file, barEl, statusEl) {
        // 1. Get presigned URL
        if (statusEl) statusEl.textContent = 'Requesting URL...';
        var presign = await api('/uploads/presign', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', folder: 'uploads' })
        });
        if (!presign || !presign.uploadUrl) throw new Error('Failed to get presigned URL');

        // 2. Upload directly to R2 with progress
        if (statusEl) statusEl.textContent = 'Uploading...';
        await new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', presign.uploadUrl, true);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable && barEl) {
                    var pct = (e.loaded / e.total * 100).toFixed(1);
                    barEl.style.width = pct + '%';
                    if (statusEl) statusEl.textContent = pct + '%';
                }
            };

            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error('R2 upload failed: ' + xhr.status));
            };
            xhr.onerror = function() { reject(new Error('Network error during R2 upload')); };
            xhr.send(file);
        });

        // 3. Register asset in our DB
        if (statusEl) statusEl.textContent = 'Finishing...';
        await api('/assets/r2', {
            method: 'POST',
            body: JSON.stringify({
                key: presign.key,
                original_name: file.name,
                file_type: file.type || 'application/octet-stream',
                file_size: file.size,
                public_url: presign.publicUrl
            })
        });

        if (barEl) barEl.style.width = '100%';
        if (statusEl) { statusEl.textContent = 'Done'; statusEl.style.color = '#5cb87a'; }
    }

    async function uploadLocal(file, barEl, statusEl) {
        if (statusEl) statusEl.textContent = 'Uploading...';
        var form = new FormData();
        form.append('file', file);

        await new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', API + '/assets', true);

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable && barEl) {
                    var pct = (e.loaded / e.total * 100).toFixed(1);
                    barEl.style.width = pct + '%';
                    if (statusEl) statusEl.textContent = pct + '%';
                }
            };

            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error('Upload failed: ' + xhr.status));
            };
            xhr.onerror = function() { reject(new Error('Network error')); };
            xhr.send(form);
        });

        if (barEl) barEl.style.width = '100%';
        if (statusEl) { statusEl.textContent = 'Done'; statusEl.style.color = '#5cb87a'; }
    }

    async function loadAdminAssets() {
        var assets = await api('/assets') || [];
        var grid = $('#adminAssetGrid');
        if (!grid) return;

        if (assets.length === 0) {
            grid.innerHTML = '<p class="empty-state">No assets uploaded yet</p>';
            return;
        }

        grid.innerHTML = assets.map(function(a) {
            var isImage = a.file_type && a.file_type.startsWith('image');
            var isVideo = a.file_type && a.file_type.startsWith('video');
            var src = a.url || ('/uploads/' + a.filename);
            var preview;
            if (isImage) {
                preview = '<img src="' + esc(src) + '" alt="' + esc(a.original_name) + '" loading="lazy">';
            } else if (isVideo) {
                preview = '<video src="' + esc(src) + '" muted></video>';
            } else {
                preview = '<div class="file-icon"><svg class="plat-svg" viewBox="0 0 24 24" style="width:28px;height:28px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
            }
            return '<div class="asset-card" data-id="' + a.id + '">' +
                '<div class="asset-preview">' + preview + '</div>' +
                '<div class="asset-info">' +
                    '<span class="asset-name" title="' + esc(a.original_name) + '">' + esc(truncate(a.original_name, 24)) + '</span>' +
                    '<span class="asset-size">' + formatBytes(a.file_size) + (a.storage === 'r2' ? ' · R2' : '') + '</span>' +
                '</div>' +
                '<button class="asset-delete" data-id="' + a.id + '" title="Delete">' +
                    '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                '</button>' +
            '</div>';
        }).join('');

        $$('.asset-delete', grid).forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                if (!confirm('Delete this asset?')) return;
                await fetch(API + '/assets/' + btn.dataset.id, { method: 'DELETE' });
                await loadAdminAssets();
            });
        });
    }

    /* ────────────────────────────────────────────
       VIEW: Analytics Input / Overview
       ──────────────────────────────────────────── */
    async function renderAnalyticsInput(el) {
        if (!window.Chart) {
            await new Promise(function(resolve, reject) {
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        el.innerHTML =
            '<div class="view-header">' +
                '<h2>Analytics Overview</h2>' +
                '<p class="view-subtitle">Performance data for the journals. account</p>' +
            '</div>' +
            '<div class="stat-cards" id="aStats">' +
                '<div class="stat-card skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="stat-card skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="stat-card skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
                '<div class="stat-card skeleton"><div class="stat-value">--</div><div class="stat-label">Loading...</div></div>' +
            '</div>' +
            '<div class="analytics-charts">' +
                '<div class="chart-card"><h3>30-Day Performance</h3><canvas id="adminChart" height="300"></canvas></div>' +
            '</div>' +
            '<div style="margin-top:2rem">' +
                '<div class="overview-section">' +
                    '<h3>Platform Breakdown</h3>' +
                    '<div id="adminBreakdown" class="breakdown-list" style="max-width:500px">Loading...</div>' +
                '</div>' +
            '</div>';

        var results = await Promise.all([api('/analytics/summary'), api('/analytics')]);
        var rawSummary = results[0];
        var rawData = results[1];

        if (rawSummary && rawSummary.current) {
            var totals = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            var prev   = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            rawSummary.current.forEach(function(r) { if (totals[r.metric] !== undefined) totals[r.metric] += r.total; });
            (rawSummary.previous || []).forEach(function(r) { if (prev[r.metric] !== undefined) prev[r.metric] += r.total; });
            var pct = function(c, p) { return p ? (((c - p) / p) * 100) : 0; };

            $('#aStats').innerHTML =
                '<div class="stat-card"><div class="stat-value">' + fmtNum(totals.impressions) + '</div><div class="stat-label">Total Views</div>' +
                '<div class="stat-trend ' + (pct(totals.impressions, prev.impressions) >= 0 ? 'up' : 'down') + '">' + (pct(totals.impressions, prev.impressions) >= 0 ? '+' : '') + pct(totals.impressions, prev.impressions).toFixed(1) + '%</div></div>' +
                '<div class="stat-card"><div class="stat-value">' + fmtNum(totals.reach) + '</div><div class="stat-label">Reach</div>' +
                '<div class="stat-trend ' + (pct(totals.reach, prev.reach) >= 0 ? 'up' : 'down') + '">' + (pct(totals.reach, prev.reach) >= 0 ? '+' : '') + pct(totals.reach, prev.reach).toFixed(1) + '%</div></div>' +
                '<div class="stat-card"><div class="stat-value">' + fmtNum(totals.engagement) + '</div><div class="stat-label">Engagements</div>' +
                '<div class="stat-trend ' + (pct(totals.engagement, prev.engagement) >= 0 ? 'up' : 'down') + '">' + (pct(totals.engagement, prev.engagement) >= 0 ? '+' : '') + pct(totals.engagement, prev.engagement).toFixed(1) + '%</div></div>' +
                '<div class="stat-card"><div class="stat-value">' + fmtNum(totals.followers) + '</div><div class="stat-label">Followers</div>' +
                '<div class="stat-trend ' + (pct(totals.followers, prev.followers) >= 0 ? 'up' : 'down') + '">' + (pct(totals.followers, prev.followers) >= 0 ? '+' : '') + pct(totals.followers, prev.followers).toFixed(1) + '%</div></div>';
        }

        if (rawData && rawData.length > 0) {
            var byDate = {};
            rawData.forEach(function(r) {
                if (!byDate[r.date]) byDate[r.date] = { impressions: 0, reach: 0, engagement: 0 };
                if (r.metric === 'impressions') byDate[r.date].impressions += r.value;
                if (r.metric === 'reach') byDate[r.date].reach += r.value;
                if (r.metric === 'engagement') byDate[r.date].engagement += r.value;
            });
            var dates = Object.keys(byDate).sort();
            var labels = dates.map(function(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });

            new Chart($('#adminChart'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Views', data: dates.map(function(d) { return byDate[d].impressions; }), borderColor: '#B7491E', backgroundColor: 'rgba(183,73,30,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Reach', data: dates.map(function(d) { return byDate[d].reach; }), borderColor: '#A67B5B', backgroundColor: 'rgba(166,123,91,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Engagements', data: dates.map(function(d) { return byDate[d].engagement; }), borderColor: '#6B5B4E', backgroundColor: 'rgba(107,91,78,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { font: { family: "'DM Sans'" }, usePointStyle: true, padding: 20 } } },
                    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: function(v) { return fmtNum(v); } } } }
                }
            });

            var platTotals = {};
            rawData.forEach(function(r) {
                if (r.metric !== 'impressions') return;
                platTotals[r.platform] = (platTotals[r.platform] || 0) + r.value;
            });
            var maxPlat = Math.max.apply(null, Object.values(platTotals).concat([1]));
            $('#adminBreakdown').innerHTML = Object.entries(platTotals).map(function(entry) {
                var p = entry[0], v = entry[1];
                return '<div class="breakdown-row">' +
                    '<div class="breakdown-label">' + (PLATFORM_ICONS[p] || '') + ' <span class="capitalize">' + p + '</span></div>' +
                    '<div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:' + (v / maxPlat * 100).toFixed(1) + '%"></div></div>' +
                    '<div class="breakdown-value">' + fmtNum(v) + '</div>' +
                '</div>';
            }).join('');
        }
    }

})();
