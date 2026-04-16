document.addEventListener('DOMContentLoaded', () => {
    fetchAnalyticsData();
    setupLogout();
});

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/logout', { method: 'POST' });
                if (res.ok) {
                    window.location.href = '/login.html';
                }
            } catch (err) {
                console.error('Logout failed:', err);
            }
        });
    }
}

async function fetchAnalyticsData() {
    const grid = document.getElementById('stats-grid');
    
    try {
        const response = await fetch('/api/analytics');
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || result.details || 'Failed to fetch data');
        }

        if (result.success && result.data) {
            if (result.data.timeseries && result.data.timeseries.length > 0) {
                renderChart(result.data.timeseries);
            }
            renderData(result.data.summary || result.data, grid);
        } else {
            throw new Error('Invalid data format received');
        }

    } catch (error) {
        console.error('Frontend Error:', error);
        grid.innerHTML = `
            <div class="error-state">
                <h3>Connection Interrupted</h3>
                <p>${error.message}</p>
                <p style="margin-top: 1rem; font-size: 0.9em; opacity: 0.8;">Make sure your server is running, the Google service account key is available, and the GA_PROPERTY_ID is set in .env.</p>
            </div>
        `;
    }
}

function renderData(data, container) {
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="error-state" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-muted);">
                <h3>No Data Found</h3>
                <p>Google Analytics returned 0 rows. It might take 24-48 hours for new traffic to show up in the Data API.</p>
            </div>
        `;
        return;
    }

    // Grouping logic to combine routes that belong to the same game
    const gamesMap = new Map();
    
    // Pre-populate all known games so they appear even with 0 traffic
    const knownGames = [
        'The Last Human', 'WaspBuster', 'FloodWeb', 'WhiteLabelFlood', 
        'FileDefender', 'Platris', 'Scratch That!', 'SmartSpin', 
        'DaleyGames Portal', 'Santa Express'
    ];
    
    knownGames.forEach(game => {
        gamesMap.set(game, { 
            views: 0, users: 0, sessions: 0, newUsers: 0, 
            totalEngagedSessions: 0, totalDuration: 0, 
            paths: new Set(['Awaiting API sync...']) 
        });
    });
    
    data.forEach(row => {
        let gameName = "Other";
        
        if (row.pagePath === '/' || row.pagePath.includes('index.html')) {
            const parts = row.pagePath.split('/');
            if (parts.length > 1 && parts[1] !== '' && parts[1] !== 'public' && !parts[1].includes('index.html')) {
                gameName = parts[1];
            } else if (row.hostName) {
                gameName = row.hostName; // Fallback to hostname for dedicated domains
            }
        } else {
            const parts = row.pagePath.split('/');
            if (parts.length > 1 && parts[1] !== '') {
                gameName = parts[1];
            }
        }
        
        // Refine names based on path or hostname matching
        const p = (row.pagePath || '').toLowerCase();
        const h = (row.hostName || '').toLowerCase();
        
        if (p.includes('thelasthuman') || h.includes('thelasthuman')) gameName = 'The Last Human';
        else if (p.includes('waspbuster') || h.includes('waspbuster')) gameName = 'WaspBuster';
        else if (p.includes('floodweb') || h.includes('floodcube')) gameName = 'FloodWeb';
        else if (p.includes('whitelabelflood') || h.includes('whitelabelflood')) gameName = 'WhiteLabelFlood';
        else if (p.includes('filedefender') || h.includes('filedefender')) gameName = 'FileDefender';
        else if (p.includes('platris') || h.includes('platris')) gameName = 'Platris';
        else if (p.includes('scratchthat') || p.includes('scratcher') || h.includes('scratch')) gameName = 'Scratch That!';
        else if (p.includes('smartspin') || h.includes('smart-spin') || h.includes('smartspin')) gameName = 'SmartSpin';
        else if (p.includes('daleygames') || h.includes('daleygames')) gameName = 'DaleyGames Portal';
        else if (p.includes('santa') || h.includes('santa')) gameName = 'Santa Express';

        if (!gamesMap.has(gameName)) {
            gamesMap.set(gameName, { views: 0, users: 0, sessions: 0, newUsers: 0, totalEngagedSessions: 0, totalDuration: 0, paths: new Set() });
        }
        
        const gameStats = gamesMap.get(gameName);
        gameStats.views += row.views || 0;
        gameStats.users += row.users || 0;
        gameStats.sessions += row.sessions || 0;
        gameStats.newUsers += row.newUsers || 0;
        gameStats.totalEngagedSessions += (row.engagementRate || 0) * (row.sessions || 0);
        gameStats.totalDuration += (row.avgDuration || 0) * (row.sessions || 0);
        gameStats.paths.add(row.hostName + row.pagePath);
    });

    let delay = 0;
    
    // Sort games by views descending
    const sortedGames = Array.from(gamesMap.entries()).sort((a, b) => b[1].views - a[1].views);

    sortedGames.forEach(([name, stats]) => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.style.animationDelay = `${delay}s`;
        
        const pathSample = Array.from(stats.paths).sort()[0] || 'Multiple paths';
        const displayPath = pathSample.length > 30 ? pathSample.substring(0, 27) + '...' : pathSample;

        const engagementPct = stats.sessions > 0 ? ((stats.totalEngagedSessions / stats.sessions) * 100).toFixed(1) : 0;
        const avgSecs = stats.sessions > 0 ? Math.round(stats.totalDuration / stats.sessions) : 0;
        const minutes = Math.floor(avgSecs / 60);
        const seconds = avgSecs % 60;
        const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        card.innerHTML = `
            <div class="game-name">${name}</div>
            <div class="game-path" title="${Array.from(stats.paths).join(', ')}">${displayPath}</div>
            <div class="metrics">
                <div class="metric">
                    <span class="metric-value"><span class="counter" data-target="${stats.views}">0</span></span>
                    <span class="metric-label">Views</span>
                </div>
                <div class="metric">
                    <span class="metric-value"><span class="counter" data-target="${stats.users}">0</span></span>
                    <span class="metric-label">Users</span>
                </div>
                <div class="metric">
                    <span class="metric-value"><span class="counter" data-target="${stats.sessions}">0</span></span>
                    <span class="metric-label">Sessions</span>
                </div>
                <div class="metric">
                    <span class="metric-value"><span class="counter" data-target="${stats.newUsers}">0</span></span>
                    <span class="metric-label">New Users</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${engagementPct}%</span>
                    <span class="metric-label">Engagement</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${durationStr}</span>
                    <span class="metric-label">Avg Time</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
        delay += 0.1;
    });

    // Animate counters
    setTimeout(animateCounters, 100);
}

function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    const speed = 200; // lower is faster

    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const updateCount = () => {
            const count = +counter.innerText.replace(/,/g, '');
            const inc = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + inc);
                setTimeout(updateCount, 15);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };
        updateCount();
    });
}

let trafficChartInstance = null;

function renderChart(timeseries) {
    const chartSection = document.getElementById('chart-section');
    const ctx = document.getElementById('trafficChart');
    if (!chartSection || !ctx) return;
    
    chartSection.classList.remove('hidden-element');

    if (trafficChartInstance) {
        trafficChartInstance.destroy();
    }

    const labels = timeseries.map(t => {
        const year = t.date.substring(0, 4);
        const month = t.date.substring(4, 6);
        const day = t.date.substring(6, 8);
        return `${month}/${day}`;
    });
    const usersData = timeseries.map(t => t.users);
    const viewsData = timeseries.map(t => t.views);

    trafficChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Page Views',
                    data: viewsData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Active Users',
                    data: usersData,
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                    bodyFont: { family: 'Outfit', size: 13 },
                    padding: 12,
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += context.parsed.y;
                            
                            // Add explainable context
                            if (context.dataset.label === 'Active Users') {
                                label += ' (Unique Individual Devices)';
                            } else if (context.dataset.label === 'Page Views') {
                                label += ' (Total Site Loads/Refreshes)';
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit', size: 13 }, usePointStyle: true },
                    onHover: function(e) { e.native.target.style.cursor = 'pointer'; },
                    onLeave: function(e) { e.native.target.style.cursor = 'default'; }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                    beginAtZero: true
                }
            }
        }
    });
}
