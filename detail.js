document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    loadGameDetails();
});

// Theme Management Functions
function initTheme() {
    const savedTheme = localStorage.getItem("akl_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("akl_theme", newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
        btn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function goBack() {
    window.history.back();
}

async function loadGameDetails() {
    const gameId = getQueryParam('id') || getQueryParam('game');
    const container = document.getElementById("detailContent");
    
    if (!container) return;

    if (!gameId) {
        container.innerHTML = `<div class="detail-loading" style="color:red;">❌ Game ID not found in URL!</div>`;
        return;
    }

    try {
        const response = await fetch('games.json?' + new Date().getTime());
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const allItems = await response.json();
        
        const game = allItems.find(item => String(item.id).trim() === String(gameId).trim());

        if (!game) {
            container.innerHTML = `<div class="detail-loading" style="color:red;">❌ Game not found in database!</div>`;
            return;
        }

        renderGameDetails(game, gameId);
        loadPopularGames(allItems, gameId);

    } catch (error) {
        console.error("Detail Load Error:", error);
        container.innerHTML = `<div class="detail-loading" style="color:red;">❌ Error loading game data.</div>`;
    }
}

function renderGameDetails(game, gameId) {
    const container = document.getElementById("detailContent");
    if (!container) return;

    document.title = `${game.name} - AKL Gaming HUB`;

    const coverImage = game.icon || game.image || game.cover || "";
    const coverHTML = isImageURL(coverImage) 
        ? `<div class="detail-cover"><img src="${escapeHTML(coverImage)}" alt="${escapeHTML(game.name)}" class="detail-cover-image"></div>` 
        : `<div class="detail-cover"><div class="detail-cover-icon">${escapeHTML(coverImage || '🎮')}</div></div>`;

    let totalRating = game.totalRating || Number(game.rating || 5.0);
    let ratingCount = game.ratingCount || 1;
    let currentAvg = (totalRating / ratingCount).toFixed(1);

    let formattedDate = game.date || "Recent";

    let featuresList = game.features;
    if (typeof featuresList === 'string') {
        try {
            featuresList = JSON.parse(featuresList);
        } catch (e) {
            featuresList = featuresList.split(',').map(f => f.trim());
        }
    }

    let featuresHTML = "";
    if (Array.isArray(featuresList) && featuresList.length > 0) {
        featuresHTML = `
            <div class="detail-section">
                <h3 class="detail-section-title">✨ Key Features</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${featuresList.map(f => `<span style="display:inline-block; padding:6px 12px; background:rgba(59,130,246,0.12); color:#3b82f6; font-size:12px; font-weight:600; border-radius:20px; border:1px solid rgba(59,130,246,0.3);">${escapeHTML(f)}</span>`).join("")}
                </div>
            </div>
        `;
    }

    let screenshotsList = game.screenshots;
    if (typeof screenshotsList === 'string') {
        try {
            screenshotsList = JSON.parse(screenshotsList);
        } catch (e) {
            screenshotsList = [];
        }
    }

    const screenshotsHTML = Array.isArray(screenshotsList) && screenshotsList.length > 0 ? `
        <div class="detail-section">
            <div class="screenshots-heading">
                <h3 class="detail-section-title" style="margin:0;">📸 Screenshots</h3>
                <span class="screenshot-count">${screenshotsList.length} Photos</span>
            </div>
            <div class="screenshots-scroll" style="margin-top: 10px;">
                ${screenshotsList.map((s, idx) => `
                    <div class="screenshot-card">
                        <img src="${escapeHTML(String(s).trim())}" alt="Screenshot ${idx + 1}" loading="lazy">
                        <div class="screenshot-number">${idx + 1}</div>
                    </div>
                `).join("")}
            </div>
        </div>
    ` : "";

    let dataUrl = game.dataDownloadUrl || game.downloadUrl || "";
    let wifiUrl = game.wifiDownloadUrl || "";

    const hasAnyLink = dataUrl || wifiUrl || game.obb_link;

    const downloadSectionHTML = hasAnyLink ? `
        <div class="download-section">
            <div class="download-section-header">
                <h2>Download Links</h2>
                <span>Get the latest version securely</span>
            </div>
            <div class="download-section-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                ${dataUrl && wifiUrl ? `
                    <a href="download.html?id=${escapeHTML(gameId)}&type=data" style="text-decoration:none;">
                        <button type="button" class="download-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 100%; cursor:pointer; border:none; padding:12px; border-radius:10px; color:#fff; font-weight:bold;">📥 Download APK (Data User)</button>
                    </a>
                    <a href="download.html?id=${escapeHTML(gameId)}&type=wifi" style="text-decoration:none;">
                        <button type="button" class="download-btn" style="background: linear-gradient(135deg, #10b981, #059669); width: 100%; cursor:pointer; border:none; padding:12px; border-radius:10px; color:#fff; font-weight:bold;">📥 Download APK (WiFi User)</button>
                    </a>
                ` : `
                    <a href="download.html?id=${escapeHTML(gameId)}" style="text-decoration:none;">
                        <button type="button" class="download-btn" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); width: 100%; cursor:pointer; border:none; padding:12px; border-radius:10px; color:#fff; font-weight:bold;">📥 Download APK</button>
                    </a>
                `}

                ${game.obb_link ? `
                    <a href="download.html?id=${escapeHTML(gameId)}&type=obb" style="text-decoration:none;">
                        <button type="button" class="download-btn" style="background: linear-gradient(135deg, #00838f, #00acc1); width: 100%; cursor:pointer; border:none; padding:12px; border-radius:10px; color:#fff; font-weight:bold;">📦 Download OBB Data</button>
                    </a>
                ` : ""}
            </div>
            <p class="download-note">By downloading, you agree to our terms and privacy policy.</p>
        </div>
    ` : `
        <div class="download-section">
            <div style="color: #f59e0b; text-align: center; font-weight: 600;">⚠️ No download link available for this game yet.</div>
        </div>
    `;

    container.innerHTML = `
        <div class="game-detail-page">
            <div class="detail-hero">
                ${coverHTML}
                <div class="detail-title-area">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span class="detail-platform">🕹️ ${escapeHTML(String(game.platform || "ANDROID").toUpperCase())}</span>
                        <span style="font-size: 12px; color: var(--meta-text); background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 6px;">📅 ${formattedDate}</span>
                    </div>
                    <h1 class="detail-game-name">${escapeHTML(game.name)}</h1>
                    
                    <div class="detail-info-grid">
                        <div class="info-box">
                            <span class="info-label">Version</span>
                            <strong>${escapeHTML(game.version || "1.0")}</strong>
                        </div>
                        <div class="info-box">
                            <span class="info-label">File Size</span>
                            <strong>${escapeHTML(game.size || "Unknown")}</strong>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Category / Type</span>
                            <strong>${escapeHTML(game.type || "Original")}</strong>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Rating</span>
                            <strong style="color: #fbbf24;">★ <span id="avgRatingText">${currentAvg}</span> (${ratingCount})</strong>
                        </div>
                    </div>

                    <div style="padding-top: 10px; border-top: 1px solid var(--card-border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 13px;">Rate this game:</span>
                        <div id="starContainer" style="display: flex; gap: 6px; cursor: pointer;">
                            <span class="star" data-value="1" style="font-size: 22px; color: #555;">★</span>
                            <span class="star" data-value="2" style="font-size: 22px; color: #555;">★</span>
                            <span class="star" data-value="3" style="font-size: 22px; color: #555;">★</span>
                            <span class="star" data-value="4" style="font-size: 22px; color: #555;">★</span>
                            <span class="star" data-value="5" style="font-size: 22px; color: #555;">★</span>
                        </div>
                        <span id="ratingMsg" style="font-size: 12px; color: #10b981; font-weight: bold;"></span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3 class="detail-section-title">About Game</h3>
                <div class="description-box">
                    <p style="margin: 0; white-space: pre-line;">${escapeHTML(game.description || "No description available.")}</p>
                </div>
            </div>

            ${featuresHTML}
            ${screenshotsHTML}

            <div class="download-area">
                ${downloadSectionHTML}
            </div>
        </div>
    `;

    setupRatingSystemLocally(gameId, totalRating, ratingCount);
}

function loadPopularGames(allItems, currentId) {
    const popularContainer = document.getElementById("popularGamesContainer");
    if (!popularContainer) return;

    const popularList = allItems.filter(item => String(item.id).trim() !== String(currentId).trim()).slice(0, 12);

    if (popularList.length === 0) return;

    let html = `
        <div style="margin-top: 30px;">
            <h3 style="margin-bottom: 12px; font-size: 18px; font-weight: 800;">🔥 Popular Games</h3>
            <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none;">
    `;

    popularList.forEach((game) => {
        const gameImg = game.icon || game.image || "🎮";

        html += `
            <a href="detail.html?id=${escapeHTML(game.id)}" style="text-decoration:none; background:var(--card-bg); padding:10px; border-radius:12px; flex: 0 0 130px; width: 130px; border: 1px solid var(--card-border); display: block;">
                <img src="${escapeHTML(gameImg)}" style="width:100%; height:110px; object-fit:cover; border-radius:8px;" alt="${escapeHTML(game.name)}">
                <h4 style="color:var(--text-color); font-size:12px; margin:8px 0 2px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(game.name)}</h4>
                <p style="color:var(--meta-text); font-size:10px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(game.type || 'Android')}</p>
            </a>
        `;
    });
    
    html += `</div></div>`;
    popularContainer.innerHTML = html;
}

function setupRatingSystemLocally(gameId, currentTotal, currentCount) {
    const stars = document.querySelectorAll('.star');
    const msg = document.getElementById('ratingMsg');
    const avgText = document.getElementById('avgRatingText');

    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const val = this.getAttribute('data-value');
            stars.forEach(s => {
                if (s.getAttribute('data-value') <= val) {
                    s.style.color = '#fbbf24';
                } else {
                    s.style.color = '#555';
                }
            });
        });

        star.addEventListener('mouseout', function() {
            stars.forEach(s => s.style.color = '#555');
        });

        star.addEventListener('click', function() {
            const selectedVal = parseInt(this.getAttribute('data-value'));
            stars.forEach(s => s.style.pointerEvents = 'none');
            
            const newTotal = currentTotal + selectedVal;
            const newCount = currentCount + 1;
            const newAvg = (newTotal / newCount).toFixed(1);

            avgText.textContent = newAvg;
            msg.textContent = "Thank you! ⭐";
            stars.forEach(s => {
                if (s.getAttribute('data-value') <= selectedVal) {
                    s.style.color = '#fbbf24';
                }
            });
        });
    });
}

function isImageURL(value) { 
    return typeof value === "string" && /^https?:\/\//i.test(value); 
}

function escapeHTML(value) { 
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}

window.goBack = goBack;
window.toggleTheme = toggleTheme;
