/* ──────────────────────────────────────────────────────
   copperhead. client portal — app.js
   Single-page: loads all sections at once + scroll reveal
   ────────────────────────────────────────────────────── */

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
    const STATUS_LABELS = {
        draft: 'Draft', pending: 'Pending Review', approved: 'Approved',
        revision: 'Needs Revision', scheduled: 'Scheduled', published: 'Published'
    };
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    let calYear, calMonth;
    let analyticsChart = null;
    let doughnutChart = null;

    /* ── Animated Counter ─────────────────── */
    function animateCounter(el, target, duration = 1200) {
        const formatted = el.dataset.raw || '';
        let start = 0;
        const startTime = performance.now();
        const easeOut = t => 1 - Math.pow(1 - t, 3);
        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.round(easeOut(progress) * target);
            el.textContent = fmtNum(current);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /* ── Init ──────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();

        initRevealObserver();
        initStickyNav();
        initCalendarControls();
        initPostFilters();
        initAnalyticsFilters();
        initAssets();
        initModal();
        $('#logoutBtn').addEventListener('click', logout);

        // Load all sections
        loadOverview();
        loadCalendar();
        loadPosts();
        loadAnalytics();
        loadAssets();
    });

    /* ── Intersection Observer — Scroll Reveal ────── */
    function initRevealObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        $$('.reveal').forEach(el => observer.observe(el));
    }

    /* ── Sticky Top Nav Active State ────── */
    function initStickyNav() {
        const navLinks = $$('#topNav a');
        const sections = $$('.section[id]');

        // Scroll spy
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navLinks.forEach(a => a.classList.remove('active'));
                    const link = $(`#topNav a[href="#${entry.target.id}"]`);
                    if (link) link.classList.add('active');
                }
            });
        }, { threshold: 0.15, rootMargin: '-80px 0px -50% 0px' });

        sections.forEach(s => observer.observe(s));

        // Smooth scroll on click
        navLinks.forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = $(a.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    /* ── API Helper ───────────────────────── */
    async function api(path, opts = {}) {
        const headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
        try {
            const res = await fetch(API + path, { headers: { ...headers, ...opts.headers }, ...opts });
            if (res.status === 401) { window.location.href = '/login'; return null; }
            if (!res.ok) return null;
            return res.json();
        } catch { return null; }
    }

    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function fmtNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
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
        const k = 1024;
        const sizes = ['B','KB','MB','GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function flattenSummary(raw) {
        if (!raw || !raw.current) return null;
        const t = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
        const p = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
        raw.current.forEach(r => { if (t[r.metric] !== undefined) t[r.metric] += r.total; });
        (raw.previous || []).forEach(r => { if (p[r.metric] !== undefined) p[r.metric] += r.total; });
        const pct = (c, pr) => pr ? (((c - pr) / pr) * 100) : 0;
        return {
            impressions: t.impressions, impressions_change: pct(t.impressions, p.impressions),
            reach: t.reach, reach_change: pct(t.reach, p.reach),
            engagement: t.engagement, engagement_change: pct(t.engagement, p.engagement),
            followers: t.followers, followers_change: pct(t.followers, p.followers)
        };
    }

    async function logout() {
        await fetch(API + '/logout', { method: 'POST' });
        window.location.href = '/login';
    }

    /* ═══════════════════════════════════════════
       OVERVIEW
       ═══════════════════════════════════════════ */
    async function loadOverview() {
        // Stats
        const raw = await api('/analytics/summary');
        const s = flattenSummary(raw);
        if (s) {
            const card = (val, label, change, i) => `
                <div class="stat-card glass" style="--delay:${i * 0.08}s">
                    <div class="stat-value counter" data-target="${val}">0</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-trend ${change >= 0 ? 'up' : 'down'}">
                        <span class="trend-arrow">${change >= 0 ? '↑' : '↓'}</span> ${Math.abs(change).toFixed(1)}%
                    </div>
                </div>`;
            $('#statCards').innerHTML =
                card(s.impressions, 'Impressions (30d)', s.impressions_change, 0) +
                card(s.reach, 'Reach (30d)', s.reach_change, 1) +
                card(s.engagement, 'Engagements (30d)', s.engagement_change, 2) +
                card(s.followers, 'Followers', s.followers_change, 3);
            // Animate counters
            $$('.counter', $('#statCards')).forEach(el => {
                animateCounter(el, parseInt(el.dataset.target));
            });
        }

        // Pending
        const pending = await api('/posts?status=pending');
        if (pending && pending.length > 0) {
            const badge = $('#pendingCount');
            badge.textContent = pending.length;
            badge.classList.add('show');
            $('#pendingList').innerHTML = pending.map(p => miniPost(p)).join('');
            bindMiniPosts($('#pendingList'));
        } else {
            $('#pendingList').innerHTML = '<div class="empty-mini">No posts pending approval</div>';
        }

        // Upcoming
        const sched = await api('/posts?status=scheduled') || [];
        const appr = await api('/posts?status=approved') || [];
        const upcoming = [...sched, ...appr].sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).slice(0, 5);
        if (upcoming.length > 0) {
            $('#upcomingList').innerHTML = upcoming.map(p => miniPost(p)).join('');
            bindMiniPosts($('#upcomingList'));
        } else {
            $('#upcomingList').innerHTML = '<div class="empty-mini">No upcoming posts</div>';
        }
    }

    function miniPost(p) {
        return `<div class="post-mini" data-id="${p.id}">
            <span class="platform-icon">${PLATFORM_ICONS[p.platform]}</span>
            <div class="post-mini-info">
                <strong>${esc(p.title)}</strong>
                <span class="post-mini-date">${fmtDate(p.scheduled_date)}</span>
            </div>
            <span class="status-badge status-${p.status}">${STATUS_LABELS[p.status]}</span>
        </div>`;
    }

    function bindMiniPosts(container) {
        $$('.post-mini', container).forEach(el => {
            el.addEventListener('click', () => openPostModal(el.dataset.id));
        });
    }

    /* ═══════════════════════════════════════════
       CALENDAR
       ═══════════════════════════════════════════ */
    function initCalendarControls() {
        $('#calPrev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } loadCalendar(); });
        $('#calNext').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } loadCalendar(); });
    }

    async function loadCalendar() {
        $('#calMonthLabel').textContent = `${MONTHS[calMonth]} ${calYear}`;
        const grid = $('#calGrid');

        // Headers
        let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
            .map(d => `<div class="cal-header">${d}</div>`).join('');

        const first = new Date(calYear, calMonth, 1).getDay();
        const days = new Date(calYear, calMonth + 1, 0).getDate();
        const today = new Date();

        const posts = await api(`/posts?month=${calMonth + 1}&year=${calYear}`) || [];
        const byDay = {};
        posts.forEach(p => {
            if (!p.scheduled_date) return;
            const d = new Date(p.scheduled_date).getDate();
            (byDay[d] = byDay[d] || []).push(p);
        });

        for (let i = 0; i < first; i++) html += '<div class="cal-day empty"></div>';

        for (let d = 1; d <= days; d++) {
            const is2day = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
            html += `<div class="cal-day${is2day ? ' today' : ''}">`;
            html += `<div class="day-num">${d}</div>`;
            if (byDay[d]) {
                byDay[d].forEach(p => {
                    html += `<div class="cal-pill status-${p.status}" data-id="${p.id}" title="${esc(p.title)}">
                        <span class="pill-icon">${PLATFORM_ICONS[p.platform]}</span>
                        ${esc(truncate(p.title, 14))}
                    </div>`;
                });
            }
            html += '</div>';
        }

        grid.innerHTML = html;

        $$('.cal-pill', grid).forEach(pill => {
            pill.addEventListener('click', (e) => { e.stopPropagation(); openPostModal(pill.dataset.id); });
        });
    }

    /* ═══════════════════════════════════════════
       POSTS
       ═══════════════════════════════════════════ */
    function initPostFilters() {
        $('#filterStatus').addEventListener('change', loadPosts);
        $('#filterPlatform').addEventListener('change', loadPosts);
    }

    async function loadPosts() {
        const status = $('#filterStatus').value;
        const platform = $('#filterPlatform').value;
        let url = '/posts?';
        if (status) url += `status=${status}&`;
        if (platform) url += `platform=${platform}&`;

        const posts = await api(url) || [];
        const tbody = $('#postsBody');
        if (posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No posts found</td></tr>';
            return;
        }
        tbody.innerHTML = posts.map(p => `
            <tr class="post-row" data-id="${p.id}">
                <td><span class="platform-icon">${PLATFORM_ICONS[p.platform]}</span></td>
                <td class="post-title-cell"><strong>${esc(p.title)}</strong></td>
                <td class="capitalize">${p.platform}</td>
                <td><span class="status-badge status-${p.status}">${STATUS_LABELS[p.status]}</span></td>
                <td>${fmtDate(p.scheduled_date)}</td>
            </tr>`).join('');

        $$('.post-row', tbody).forEach(row => {
            row.addEventListener('click', () => openPostModal(row.dataset.id));
        });
    }

    /* ═══════════════════════════════════════════
       ANALYTICS
       ═══════════════════════════════════════════ */
    function initAnalyticsFilters() {
        $('#analyticsPlatform').addEventListener('change', loadAnalytics);
        $('#analyticsPeriod').addEventListener('change', loadAnalytics);
    }

    async function loadAnalytics() {
        const platform = $('#analyticsPlatform').value;
        const days = $('#analyticsPeriod').value;
        let summaryUrl = `/analytics/summary?days=${days}`;
        let dataUrl = `/analytics?days=${days}`;
        if (platform) { summaryUrl += `&platform=${platform}`; dataUrl += `&platform=${platform}`; }

        const [rawSummary, rawData] = await Promise.all([api(summaryUrl), api(dataUrl)]);
        const s = flattenSummary(rawSummary);

        if (s) {
            const card = (val, label, change, i) => `
                <div class="stat-card glass" style="--delay:${i * 0.08}s">
                    <div class="stat-value counter" data-target="${val}">0</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-trend ${change >= 0 ? 'up' : 'down'}">
                        <span class="trend-arrow">${change >= 0 ? '↑' : '↓'}</span> ${Math.abs(change).toFixed(1)}%
                    </div>
                </div>`;
            $('#analyticsStats').innerHTML =
                card(s.impressions, 'Impressions', s.impressions_change, 0) +
                card(s.reach, 'Reach', s.reach_change, 1) +
                card(s.engagement, 'Engagements', s.engagement_change, 2) +
                card(s.followers, 'Followers', s.followers_change, 3);
            // Animate counters
            $$('.counter', $('#analyticsStats')).forEach(el => {
                animateCounter(el, parseInt(el.dataset.target));
            });
        }

        if (rawData && rawData.length > 0) {
            buildChart(rawData);
            buildBreakdown(rawData);
        }
    }

    function buildChart(data) {
        const canvas = $('#mainChart');
        if (!canvas || !window.Chart) return;
        if (analyticsChart) { analyticsChart.destroy(); analyticsChart = null; }

        const ctx = canvas.getContext('2d');

        // Create premium gradients
        const makeGradient = (color1, color2) => {
            const g = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
            g.addColorStop(0, color1);
            g.addColorStop(1, color2);
            return g;
        };

        const byDate = {};
        data.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = { impressions: 0, reach: 0, engagement: 0 };
            if (byDate[r.date][r.metric] !== undefined) byDate[r.date][r.metric] += r.value;
        });

        const dates = Object.keys(byDate).sort();
        const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        const dataset = (label, key, borderColor, gradientStart, gradientEnd) => ({
            label,
            data: dates.map(d => byDate[d][key]),
            borderColor: borderColor,
            backgroundColor: makeGradient(gradientStart, gradientEnd),
            fill: true,
            tension: 0.45,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: borderColor,
            pointHoverBorderColor: '#FAF8F4',
            pointHoverBorderWidth: 2,
            pointHitRadius: 20
        });

        analyticsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    dataset('Impressions', 'impressions', '#B7491E', 'rgba(183,73,30,0.18)', 'rgba(183,73,30,0.0)'),
                    dataset('Reach', 'reach', '#A67B5B', 'rgba(166,123,91,0.14)', 'rgba(166,123,91,0.0)'),
                    dataset('Engagements', 'engagement', '#5cb87a', 'rgba(92,184,122,0.14)', 'rgba(92,184,122,0.0)')
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            font: { family: "'DM Sans', sans-serif", size: 11, weight: 500 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            color: '#C4B5A0'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(28, 25, 22, 0.95)',
                        titleFont: { family: "'DM Sans', sans-serif", size: 12, weight: 600 },
                        bodyFont: { family: "'DM Sans', sans-serif", size: 11 },
                        padding: 14,
                        cornerRadius: 10,
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { font: { family: "'DM Sans', sans-serif", size: 10 }, color: '#6B5B4E', maxTicksLimit: 8, padding: 8 }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.025)', drawBorder: false },
                        border: { display: false },
                        ticks: {
                            font: { family: "'DM Sans', sans-serif", size: 10 },
                            color: '#6B5B4E',
                            callback: v => fmtNum(v),
                            padding: 10,
                            maxTicksLimit: 6
                        }
                    }
                }
            }
        });
    }

    function buildBreakdown(data) {
        const PLAT_COLORS = {
            instagram: '#D4633A',
            tiktok: '#A67B5B',
            facebook: '#5cb87a'
        };

        const platTotals = {};
        data.forEach(r => {
            if (r.metric !== 'impressions') return;
            platTotals[r.platform] = (platTotals[r.platform] || 0) + r.value;
        });

        // Doughnut chart
        const doughnutCanvas = $('#platformDoughnut');
        if (doughnutCanvas && window.Chart) {
            if (doughnutChart) { doughnutChart.destroy(); doughnutChart = null; }
            const platforms = Object.keys(platTotals);
            const values = platforms.map(p => platTotals[p]);
            const colors = platforms.map(p => PLAT_COLORS[p] || '#C4B5A0');

            doughnutChart = new Chart(doughnutCanvas, {
                type: 'doughnut',
                data: {
                    labels: platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderColor: '#231f1b',
                        borderWidth: 3,
                        hoverBorderColor: '#FAF8F4',
                        hoverBorderWidth: 2,
                        spacing: 2,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '72%',
                    animation: {
                        animateRotate: true,
                        duration: 1400,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(28, 25, 22, 0.95)',
                            titleFont: { family: "'DM Sans', sans-serif", size: 12, weight: 600 },
                            bodyFont: { family: "'DM Sans', sans-serif", size: 11 },
                            padding: 12,
                            cornerRadius: 10,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            callbacks: {
                                label: ctx => ` ${ctx.label}: ${fmtNum(ctx.parsed)}`
                            }
                        }
                    }
                }
            });
        }

        // Platform breakdown bars
        const maxPlat = Math.max(...Object.values(platTotals), 1);
        const platEl = $('#platformBreakdown');
        if (platEl) {
            platEl.innerHTML = Object.entries(platTotals).map(([p, v]) => `
                <div class="breakdown-row">
                    <div class="breakdown-label">
                        <span class="breakdown-dot" style="background:${PLAT_COLORS[p] || '#C4B5A0'}"></span>
                        ${PLATFORM_ICONS[p]} <span class="capitalize">${p}</span>
                    </div>
                    <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${(v/maxPlat*100).toFixed(1)}%;background:${PLAT_COLORS[p]}"></div></div>
                    <div class="breakdown-value">${fmtNum(v)}</div>
                </div>`).join('');
        }

        // Top metrics with colored bars
        const MET_COLORS = {
            impressions: '#B7491E',
            reach: '#A67B5B',
            engagement: '#5cb87a',
            followers: '#d4a732'
        };

        const metTotals = {};
        data.forEach(r => { metTotals[r.metric] = (metTotals[r.metric] || 0) + r.value; });
        const maxMet = Math.max(...Object.values(metTotals), 1);
        const metEl = $('#topMetrics');
        if (metEl) {
            metEl.innerHTML = Object.entries(metTotals).sort((a, b) => b[1] - a[1]).map(([m, v]) => `
                <div class="breakdown-row">
                    <div class="breakdown-label">
                        <span class="breakdown-dot" style="background:${MET_COLORS[m] || '#C4B5A0'}"></span>
                        <span class="capitalize">${m}</span>
                    </div>
                    <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${(v/maxMet*100).toFixed(1)}%;background:linear-gradient(90deg, ${MET_COLORS[m] || '#C4B5A0'}, ${MET_COLORS[m] || '#C4B5A0'}88)"></div></div>
                    <div class="breakdown-value">${fmtNum(v)}</div>
                </div>`).join('');
        }
    }

    /* ═══════════════════════════════════════════
       ASSETS
       ═══════════════════════════════════════════ */
    function initAssets() {
        const fileInput = $('#fileInput');
        $('#uploadBtn').addEventListener('click', () => fileInput.click());
        fileInput.onchange = async () => {
            if (fileInput.files.length === 0) return;
            await uploadFiles(fileInput.files);
            fileInput.value = '';
            await loadAssets();
        };

        const dz = $('#dropzone');
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', async e => {
            e.preventDefault();
            dz.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                await uploadFiles(e.dataTransfer.files);
                await loadAssets();
            }
        });
    }

    async function uploadFiles(files) {
        for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            await fetch(API + '/assets', { method: 'POST', body: form });
        }
    }

    async function loadAssets() {
        const assets = await api('/assets') || [];
        const grid = $('#assetGrid');
        if (assets.length === 0) {
            grid.innerHTML = '<div class="empty-mini">No assets uploaded yet</div>';
            return;
        }
        grid.innerHTML = assets.map(a => {
            const isImg = a.file_type && a.file_type.startsWith('image');
            const isVid = a.file_type && a.file_type.startsWith('video');
            let preview;
            if (isImg) preview = `<img src="/uploads/${a.filename}" alt="${esc(a.original_name)}" loading="lazy">`;
            else if (isVid) preview = `<video src="/uploads/${a.filename}" muted></video>`;
            else preview = '<div style="font-size:2rem;color:var(--earth)">📄</div>';
            return `<div class="asset-card" data-id="${a.id}">
                <div class="asset-preview">${preview}</div>
                <div class="asset-info">
                    <span class="asset-name" title="${esc(a.original_name)}">${esc(truncate(a.original_name, 22))}</span>
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
                await loadAssets();
            });
        });
    }

    /* ═══════════════════════════════════════════
       POST DETAIL MODAL
       ═══════════════════════════════════════════ */
    function initModal() {
        $('#postModalBackdrop').addEventListener('click', closeModal);
        $('#postModalClose').addEventListener('click', closeModal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    function closeModal() {
        $('#postModal').classList.remove('open');
        document.body.style.overflow = '';
    }

    async function openPostModal(id) {
        const post = await api('/posts/' + id);
        if (!post) return;
        const comments = await api(`/posts/${id}/comments`) || [];

        document.body.style.overflow = 'hidden';

        $('#modalHeader').innerHTML = `
            <div class="modal-post-header">
                <span class="platform-icon">${PLATFORM_ICONS[post.platform]}</span>
                <div>
                    <h3>${esc(post.title)}</h3>
                    <div class="meta-line">
                        <span class="capitalize">${post.platform}</span>
                        <span>·</span>
                        <span class="status-badge status-${post.status}">${STATUS_LABELS[post.status]}</span>
                    </div>
                </div>
            </div>`;

        let mediaHtml = '';
        if (post.media_url) {
            mediaHtml = post.media_type === 'video'
                ? `<video src="${esc(post.media_url)}" controls class="modal-media"></video>`
                : `<img src="${esc(post.media_url)}" alt="" class="modal-media">`;
        }

        $('#modalBody').innerHTML = `
            ${mediaHtml}
            <div class="modal-section">
                <label>Caption</label>
                <div class="modal-caption">${esc(post.caption || '—')}</div>
            </div>
            <div class="modal-meta-row">
                <div><strong>Scheduled</strong> ${fmtDate(post.scheduled_date)}</div>
                <div><strong>Created</strong> ${fmtDate(post.created_at)}</div>
            </div>
            ${post.status === 'pending' ? `
            <div class="modal-actions">
                <button class="btn-approve" data-id="${post.id}">✓ Approve</button>
                <button class="btn-revision" data-id="${post.id}">↩ Request Revision</button>
            </div>` : ''}
            <div class="modal-section">
                <label>Comments & Feedback</label>
                <div class="comments-list" id="commentsList">
                    ${comments.length === 0 ? '<div class="empty-mini">No comments yet</div>' :
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
                <form class="comment-form" id="commentForm">
                    <textarea id="commentInput" placeholder="Leave feedback…" rows="2"></textarea>
                    <div class="comment-form-actions">
                        <label class="checkbox-label">
                            <input type="checkbox" id="commentInternal"> Internal note
                        </label>
                        <button type="submit" class="btn-primary btn-sm">Post Comment</button>
                    </div>
                </form>
            </div>`;

        // Bind actions
        const approveBtn = $('#modalBody .btn-approve');
        const revisionBtn = $('#modalBody .btn-revision');
        if (approveBtn) {
            approveBtn.addEventListener('click', async () => {
                await api(`/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
                openPostModal(post.id);
                loadOverview();
                loadPosts();
                loadCalendar();
            });
        }
        if (revisionBtn) {
            revisionBtn.addEventListener('click', async () => {
                await api(`/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'revision' }) });
                openPostModal(post.id);
                loadOverview();
                loadPosts();
                loadCalendar();
            });
        }

        $('#commentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = $('#commentInput').value.trim();
            if (!content) return;
            await api(`/posts/${post.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ author: 'Client', content, is_internal: $('#commentInternal').checked })
            });
            openPostModal(post.id);
        });

        $('#postModal').classList.add('open');
    }

})();
