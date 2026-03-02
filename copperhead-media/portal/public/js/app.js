/* ──────────────────────────────────────────────────────
   copperhead. client portal — app.js
   Analytics-focused dashboard + asset library
   ────────────────────────────────────────────────────── */

(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const API = '/api';
    const PLATFORM_ICONS = {
        instagram: '<svg class="plat-svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
        tiktok: '<svg class="plat-svg" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>'
    };

    let overviewChart = null;
    let mainChart = null;
    let doughnutChart = null;

    /* ── Init ────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        initAssets();
        $('#logoutBtn').addEventListener('click', async () => {
            await fetch(API + '/logout', { method: 'POST' });
            window.location.href = '/login';
        });
        loadOverview();
        initAnalyticsFilters();
        loadAnalytics();
        loadAssets();
        initReveal();
    });

    /* ── Navigation ──────────────────────────── */
    function initNav() {
        $$('#topNav a').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                $$('#topNav a').forEach(x => x.classList.remove('active'));
                a.classList.add('active');
                const target = document.querySelector(a.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    /* ── Scroll Reveal ───────────────────────── */
    function initReveal() {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
        }, { threshold: 0.1 });
        $$('.reveal').forEach(el => obs.observe(el));
    }

    /* ── Helpers ──────────────────────────────── */
    async function api(path) {
        const res = await fetch(API + path);
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (!res.ok) return null;
        return res.json();
    }

    function fmtNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    function animateCounter(el, target, suffix) {
        suffix = suffix || '';
        const duration = 1200;
        const start = performance.now();
        const isFloat = String(target).includes('.');
        function tick(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 4);
            const val = target * ease;
            el.textContent = (isFloat ? val.toFixed(2) : fmtNum(Math.round(val))) + suffix;
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function flattenSummary(raw) {
        if (!raw || !raw.current) return null;
        const totals = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
        const prev   = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
        raw.current.forEach(r => { if (totals[r.metric] !== undefined) totals[r.metric] += r.total; });
        (raw.previous || []).forEach(r => { if (prev[r.metric] !== undefined) prev[r.metric] += r.total; });
        const pct = (c, p) => p ? (((c - p) / p) * 100) : 0;
        totals.engRate = totals.reach > 0 ? ((totals.engagement / totals.reach) * 100) : 0;
        totals.avgDailyViews = Math.round(totals.impressions / 30);
        return { totals, prev, pct };
    }

    /* ────────────────────────────────────────────
       OVERVIEW — 6 KPI hero cards + trend chart
       ──────────────────────────────────────────── */
    async function loadOverview() {
        const raw = await api('/analytics/summary');
        const data = flattenSummary(raw);
        if (!data) return;
        const { totals, prev, pct } = data;

        const kpis = [
            { label: 'Total Views',     value: totals.impressions, prev: prev.impressions },
            { label: 'Total Reach',     value: totals.reach,       prev: prev.reach },
            { label: 'Engagements',     value: totals.engagement,  prev: prev.engagement },
            { label: 'Engagement Rate', value: totals.engRate,     suffix: '%', isFloat: true },
            { label: 'Followers',       value: totals.followers,   prev: prev.followers },
            { label: 'Avg Daily Views', value: totals.avgDailyViews }
        ];

        const container = $('#kpiCards');
        container.innerHTML = kpis.map((k, i) => {
            const change = k.prev ? pct(k.value, k.prev) : null;
            const trendClass = change !== null ? (change >= 0 ? 'up' : 'down') : '';
            const trendText  = change !== null ? ((change >= 0 ? '+' : '') + change.toFixed(1) + '%') : '';
            return '<div class="kpi-card glass" style="animation-delay:' + (i * 60) + 'ms">' +
                '<div class="kpi-value" data-target="' + k.value + '" data-suffix="' + (k.suffix || '') + '" data-float="' + (!!k.isFloat) + '">0</div>' +
                '<div class="kpi-label">' + k.label + '</div>' +
                (trendText ? '<div class="kpi-trend ' + trendClass + '">' + trendText + '</div>' : '') +
            '</div>';
        }).join('');

        $$('.kpi-value[data-target]', container).forEach(el => {
            const target = parseFloat(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            animateCounter(el, target, suffix);
        });

        const rawData = await api('/analytics?days=30');
        if (rawData && rawData.length > 0) {
            const byDate = {};
            rawData.forEach(r => {
                if (!byDate[r.date]) byDate[r.date] = 0;
                if (r.metric === 'impressions') byDate[r.date] += r.value;
            });
            const dates = Object.keys(byDate).sort();
            const labels = dates.map(d => {
                const dt = new Date(d);
                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });

            if (overviewChart) overviewChart.destroy();
            overviewChart = new Chart($('#overviewChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Views',
                        data: dates.map(d => byDate[d]),
                        borderColor: '#B7491E',
                        backgroundColor: 'rgba(183,73,30,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { family: "'DM Sans'", size: 11 } } },
                        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => fmtNum(v), font: { family: "'DM Sans'", size: 11 } } }
                    }
                }
            });
        }
    }

    /* ────────────────────────────────────────────
       ANALYTICS — full breakdown
       ──────────────────────────────────────────── */
    function initAnalyticsFilters() {
        const reload = () => loadAnalytics();
        const pSel = $('#analyticsPlatform');
        const dSel = $('#analyticsPeriod');
        if (pSel) pSel.addEventListener('change', reload);
        if (dSel) dSel.addEventListener('change', reload);
    }

    async function loadAnalytics() {
        const platform = ($('#analyticsPlatform') || {}).value || '';
        const days = ($('#analyticsPeriod') || {}).value || '30';
        let query = '?days=' + days;
        if (platform) query += '&platform=' + platform;

        const [rawData, rawSummary] = await Promise.all([
            api('/analytics' + query),
            api('/analytics/summary' + query)
        ]);

        const statsRow = $('#analyticsStats');
        if (rawSummary && rawSummary.current) {
            const totals = { impressions: 0, reach: 0, engagement: 0, followers: 0 };
            rawSummary.current.forEach(r => { if (totals[r.metric] !== undefined) totals[r.metric] += r.total; });
            const engRate = totals.reach > 0 ? ((totals.engagement / totals.reach) * 100).toFixed(2) : '0.00';
            statsRow.innerHTML =
                '<div class="stat-card glass"><div class="stat-value">' + fmtNum(totals.impressions) + '</div><div class="stat-label">Views</div></div>' +
                '<div class="stat-card glass"><div class="stat-value">' + fmtNum(totals.reach) + '</div><div class="stat-label">Reach</div></div>' +
                '<div class="stat-card glass"><div class="stat-value">' + fmtNum(totals.engagement) + '</div><div class="stat-label">Engagements</div></div>' +
                '<div class="stat-card glass"><div class="stat-value">' + engRate + '%</div><div class="stat-label">Eng. Rate</div></div>';
        }

        if (!rawData || rawData.length === 0) return;

        const byDate = {};
        rawData.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = { impressions: 0, reach: 0, engagement: 0 };
            if (byDate[r.date][r.metric] !== undefined) byDate[r.date][r.metric] += r.value;
        });
        const dates = Object.keys(byDate).sort();
        const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        if (mainChart) mainChart.destroy();
        mainChart = new Chart($('#mainChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Views', data: dates.map(d => byDate[d].impressions), borderColor: '#B7491E', backgroundColor: 'rgba(183,73,30,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                    { label: 'Reach', data: dates.map(d => byDate[d].reach), borderColor: '#A67B5B', backgroundColor: 'rgba(166,123,91,0.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                    { label: 'Engagements', data: dates.map(d => byDate[d].engagement), borderColor: '#6B5B4E', backgroundColor: 'rgba(107,91,78,0.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { family: "'DM Sans'" }, usePointStyle: true, padding: 16 } } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { family: "'DM Sans'", size: 11 } } },
                    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => fmtNum(v), font: { family: "'DM Sans'", size: 11 } } }
                }
            }
        });

        buildBreakdown(rawData);
        buildContentPerf(rawData);
    }

    function buildBreakdown(data) {
        const platTotals = {};
        const metricTotals = {};
        data.forEach(r => {
            platTotals[r.platform] = (platTotals[r.platform] || 0) + (r.metric === 'impressions' ? r.value : 0);
            metricTotals[r.metric] = (metricTotals[r.metric] || 0) + r.value;
        });

        const platEntries = Object.entries(platTotals).filter(([, v]) => v > 0);
        const colors = ['#B7491E', '#A67B5B', '#6B5B4E', '#C4B5A0'];

        if (doughnutChart) doughnutChart.destroy();
        const dCanvas = $('#platformDoughnut');
        if (dCanvas) {
            doughnutChart = new Chart(dCanvas, {
                type: 'doughnut',
                data: {
                    labels: platEntries.map(([p]) => p.charAt(0).toUpperCase() + p.slice(1)),
                    datasets: [{ data: platEntries.map(([, v]) => v), backgroundColor: colors.slice(0, platEntries.length), borderWidth: 0 }]
                },
                options: { cutout: '68%', plugins: { legend: { display: false } } }
            });
        }

        const bd = $('#platformBreakdown');
        if (bd) {
            const maxP = Math.max(...platEntries.map(([, v]) => v), 1);
            bd.innerHTML = platEntries.map(([p, v], i) =>
                '<div class="breakdown-row">' +
                    '<div class="breakdown-label">' + (PLATFORM_ICONS[p] || '') + ' <span class="capitalize">' + p + '</span></div>' +
                    '<div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:' + (v / maxP * 100).toFixed(1) + '%;background:' + colors[i] + '"></div></div>' +
                    '<div class="breakdown-value">' + fmtNum(v) + '</div>' +
                '</div>'
            ).join('');
        }

        const tm = $('#topMetrics');
        if (tm) {
            const metricEntries = Object.entries(metricTotals).sort((a, b) => b[1] - a[1]);
            const maxM = Math.max(...metricEntries.map(([, v]) => v), 1);
            const metricLabels = { impressions: 'Views', reach: 'Reach', engagement: 'Engagements', followers: 'Followers' };
            tm.innerHTML = metricEntries.map(([m, v]) =>
                '<div class="breakdown-row">' +
                    '<div class="breakdown-label">' + (metricLabels[m] || m) + '</div>' +
                    '<div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:' + (v / maxM * 100).toFixed(1) + '%"></div></div>' +
                    '<div class="breakdown-value">' + fmtNum(v) + '</div>' +
                '</div>'
            ).join('');
        }
    }

    function buildContentPerf(data) {
        const body = $('#perfBody');
        if (!body) return;

        const byDate = {};
        data.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = { impressions: 0, reach: 0, engagement: 0 };
            if (byDate[r.date][r.metric] !== undefined) byDate[r.date][r.metric] += r.value;
        });

        const rows = Object.entries(byDate)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 14);

        body.innerHTML = rows.map(([date, d]) => {
            const engRate = d.reach > 0 ? ((d.engagement / d.reach) * 100).toFixed(2) : '0.00';
            const isGood = parseFloat(engRate) >= 3;
            return '<div class="perf-row">' +
                '<div class="perf-col perf-col-date">' + new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</div>' +
                '<div class="perf-col perf-val">' + fmtNum(d.impressions) + '</div>' +
                '<div class="perf-col perf-val">' + fmtNum(d.reach) + '</div>' +
                '<div class="perf-col perf-val">' + fmtNum(d.engagement) + '</div>' +
                '<div class="perf-col perf-val' + (isGood ? ' perf-good' : '') + '">' + engRate + '%</div>' +
            '</div>';
        }).join('');
    }

    /* ────────────────────────────────────────────
       ASSETS
       ──────────────────────────────────────────── */
    function initAssets() {
        const fileInput = $('#fileInput');
        const uploadBtn = $('#uploadBtn');
        const dz = $('#dropzone');

        if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length === 0) return;
            for (const file of fileInput.files) {
                const form = new FormData();
                form.append('file', file);
                await fetch(API + '/assets', { method: 'POST', body: form });
            }
            fileInput.value = '';
            await loadAssets();
        });

        if (dz) {
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
                await loadAssets();
            });
        }
    }

    async function loadAssets() {
        const assets = await api('/assets') || [];
        const grid = $('#assetGrid');
        if (!grid) return;

        if (assets.length === 0) {
            grid.innerHTML = '<div class="empty-mini">No assets uploaded yet</div>';
            return;
        }

        grid.innerHTML = assets.map(a => {
            const isImage = a.file_type && a.file_type.startsWith('image');
            const isVideo = a.file_type && a.file_type.startsWith('video');
            var preview;
            if (isImage) {
                preview = '<img src="/uploads/' + a.filename + '" alt="' + a.original_name + '" loading="lazy">';
            } else if (isVideo) {
                preview = '<video src="/uploads/' + a.filename + '" muted preload="metadata"></video>';
            } else {
                preview = '<div class="file-icon"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
            }
            var name = a.original_name.length > 20 ? a.original_name.slice(0, 20) + '...' : a.original_name;
            return '<div class="asset-card glass">' +
                '<div class="asset-preview">' + preview + '</div>' +
                '<div class="asset-info"><span class="asset-name" title="' + a.original_name + '">' + name + '</span></div>' +
                '<button class="asset-delete" data-id="' + a.id + '" title="Delete">' +
                    '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                '</button>' +
            '</div>';
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

})();
