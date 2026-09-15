// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZv-a33YAuaD1VDWH2HbUXvVxCxIgN9k",
    authDomain: "akl-gaming-hub-v2.firebaseapp.com",
    projectId: "akl-gaming-hub-v2",
    storageBucket: "akl-gaming-hub-v2.appspot.com",
    messagingSenderId: "346718543772",
    appId: "1:346718543772:web:9ee8b5d8f48a3b3d487259"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    limit,
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

    // 1. LocalStorage Cache စစ်ဆေးခြင်း (Reads များကို ကာကွယ်ရန်)
    const cacheKey = `akl_game_detail_${gameId}`;
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(`${cacheKey}_time`);
    const CACHE_DURATION = 30 * 60 * 1000; // မိနစ် ၃၀

    let game = null;

    if (cachedData && cachedTime && (Date.now() - cachedTime < CACHE_DURATION)) {
        game = JSON.parse(cachedData);
        console.log("Loaded game details from Cache (No Firebase Read)");
    } else {
        try {
            const docRef = doc(db, "games", gameId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                container.innerHTML = `<div class="detail-loading" style="color:red;">❌ Game not found in database!</div>`;
                return;
            }

            game = docSnap.data();
            // Cache ထဲသို့ သိမ်းဆည်းရန်
            localStorage.setItem(cacheKey, JSON.stringify(game));
            localStorage.setItem(`${cacheKey}_time`, Date.now());
        } catch (error) {
            console.error("Detail Load Error:", error);
            container.innerHTML = `<div class="detail-loading" style="color:red;">❌ Error loading game data.</div>`;
            return;
        }
    }

    // ကျန်ရှိသော UI တည်ဆောက်ခြင်း လုပ်ငန်းစဉ်များ
    document.title = `${game.name} - AKL Gaming HUB`;

    const coverImage = game.image || game.cover || game.icon || "";
    const coverHTML = isImageURL(coverImage) 
        ? `<div class="detail-cover"><img src="${escapeHTML(coverImage)}" alt="${escapeHTML(game.name)}" class="detail-cover-image"></div>` 
        : `<div class="detail-cover"><div class="detail-cover-icon">${escapeHTML(coverImage || '🎮')}</div></div>`;

    let totalRating = game.totalRating || Number(game.rating || 5.0);
    let ratingCount = game.ratingCount || 1;
    let currentAvg = (totalRating / ratingCount).toFixed(1);

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
                        <img src="${escapeHTML(s.trim())}" alt="Screenshot ${idx + 1}" loading="lazy">
                        <div class="screenshot-number">${idx + 1}</div>
                    </div>
                `).join("")}
            </div>
        </div>
    ` : "";

    // Data link နှင့် Wifi link များကို စစ်ဆေးခြင်း
    let dataUrl = game.dataDownloadUrl || game.downloadUrl || "";
    let wifiUrl = game.wifiDownloadUrl || "";

    if (dataUrl.endsWith(".bin")) {
        dataUrl = dataUrl.slice(0, -4) + ".apk";
    }
    if (wifiUrl.endsWith(".bin")) {
        wifiUrl = wifiUrl.slice(0, -4) + ".apk";
    }

    const hasAnyLink = dataUrl || wifiUrl || game.obb_link;

    const downloadSectionHTML = hasAnyLink ? `
        <div class="download-section">
            <div class="download-section-header">
                <h2>Download Links</h2>
                <span>Get the latest version securely</span>
            </div>
            <div class="download-section-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                ${dataUrl && wifiUrl ? `
                    <a href="${escapeHTML(dataUrl)}" download="${escapeHTML(game.name)}_Data.apk" target="_blank" style="text-decoration:none;">
                        <button class="download-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 100%;">📶 Download (Data User) - ${escapeHTML(game.size || "Standard")}</button>
                    </a>
                    <a href="${escapeHTML(wifiUrl)}" download="${escapeHTML(game.name)}_WiFi.apk" target="_blank" style="text-decoration:none;">
                        <button class="download-btn" style="background: linear-gradient(135deg, #10b981, #059669); width: 100%;">🛜 Download (WiFi User) - ${escapeHTML(game.wifiSize || game.size || "High Quality")}</button>
                    </a>
                ` : `
                    <a href="${escapeHTML(dataUrl || wifiUrl)}" download="${escapeHTML(game.name)}.apk" target="_blank" style="text-decoration:none;">
                        <button class="download-btn" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); width: 100%;">📥 Download APK - ${escapeHTML(game.size || "Standard")}</button>
                    </a>
                `}
                ${game.obb_link ? `
                    <a href="${escapeHTML(game.obb_link)}" target="_blank" style="text-decoration:none;">
                        <button class="download-btn" style="background: linear-gradient(135deg, #00838f, #00acc1); width: 100%;">📦 Download OBB Data</button>
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
                    <span class="detail-platform">🕹️ ${escapeHTML(String(game.platform || "ANDROID").toUpperCase())}</span>
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

    const docRef = doc(db, "games", gameId);
    setupRatingSystem(docRef, totalRating, ratingCount);
    loadPopularGames(gameId);
}

async function loadPopularGames(currentId) {
    const popularContainer = document.getElementById("popularGamesContainer");
    if (!popularContainer) return;

    try {
        const gamesRef = collection(db, "games");
        const q = query(gamesRef, limit(12));
        const querySnapshot = await getDocs(q);

        let html = `
            <div style="margin-top: 30px;">
                <h3 style="margin-bottom: 12px; font-size: 18px; font-weight: 800;">🔥 Popular Games</h3>
                <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none;">
        `;

        querySnapshot.forEach((docSnap) => {
            if (docSnap.id === currentId) return;
            const game = docSnap.data();
            const gameImg = game.image || game.icon || "🎮";

            html += `
                <a href="detail.html?id=${docSnap.id}" style="text-decoration:none; background:var(--card-bg); padding:10px; border-radius:12px; flex: 0 0 130px; width: 130px; border: 1px solid var(--card-border); display: block;">
                    <img src="${escapeHTML(gameImg)}" style="width:100%; height:110px; object-fit:cover; border-radius:8px;">
                    <h4 style="color:var(--text-color); font-size:12px; margin:8px 0 2px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(game.name)}</h4>
                    <p style="color:var(--meta-text); font-size:10px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(game.type || 'Android')}</p>
                </a>
            `;
        });
        
        html += `</div></div>`;
        popularContainer.innerHTML = html;
    } catch (e) {
        console.error("Popular games load error:", e);
    }
}

function setupRatingSystem(docRef, currentTotal, currentCount) {
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

        star.addEventListener('click', async function() {
            const selectedVal = parseInt(this.getAttribute('data-value'));
            stars.forEach(s => s.style.pointerEvents = 'none');
            
            try {
                const newTotal = currentTotal + selectedVal;
                const newCount = currentCount + 1;
                const newAvg = (newTotal / newCount).toFixed(1);

                await updateDoc(docRef, {
                    totalRating: newTotal,
                    ratingCount: newCount,
                    rating: parseFloat(newAvg)
                });

                avgText.textContent = newAvg;
                msg.textContent = "Thank you! ⭐";
                stars.forEach(s => {
                    if (s.getAttribute('data-value') <= selectedVal) {
                        s.style.color = '#fbbf24';
                    }
                });
            } catch (err) {
                console.error("Rating update error:", err);
                msg.style.color = "#f87171";
                msg.textContent = "Failed!";
            }
        });
    });
}

function isImageURL(value) { 
    return typeof value === "string" && /^https?:\/\//i.test(value); 
}

function escapeHTML(value) { 
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
}

window.goBack = goBack;
window.toggleTheme = toggleTheme;
