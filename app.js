// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZv-a33YAuaD1VDWH2HbUXvVxCxIgN9k",
    authDomain: "akl-gaming-hub-v2.firebaseapp.com",
    projectId: "akl-gaming-hub-v2",
    storageBucket: "akl-gaming-hub-v2.appspot.com",
    messagingSenderId: "346718543772",
    appId: "1:346718543772:web:9ee8b5d8f48a3b3d487259"
};

// Import Firebase SDK (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allItems = []; // Games နဲ့ Apps အားလုံးကို သိမ်းမည့် Array
let currentContentType = 'game'; // 'game' သို့မဟုတ် 'app'
let currentPage = 1;
const itemsPerPage = 45; // တစ်မျက်နှာကို ၄၅ ခု

// ============================================
// Dark & Light Mode Toggle Function
// ============================================
window.toggleTheme = function() {
    const body = document.body;
    const btn = document.getElementById('themeToggleBtn');
    body.classList.toggle('light-theme');
    
    if (body.classList.contains('light-theme')) {
        btn.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        btn.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
};

// ============================================
// Firebase Firestore ကနေ ဒေတာတွေ Load လုပ်မယ် (Caching ဖြင့် Reads ကာကွယ်ခြင်း)
// ============================================
async function loadGamesFromFirebase() {
    const CACHE_KEY = "akl_cached_games";
    const CACHE_TIME_KEY = "akl_cache_time";
    const CACHE_DURATION = 30 * 60 * 1000; // မိနစ် ၃၀ လျှင် တစ်ကြိမ်သာ Firebase ကို ဆွဲမည်

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = new Date().getTime();

    // Cache သက်တမ်းအတွင်းရှိနေရင် Firebase ကို မခေါ်တော့ဘဲ LocalStorage ကနေပဲ ဆွဲသုံးမယ် (Reads 0 ကုန်မည်)
    if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
        try {
            allItems = JSON.parse(cachedData);
            console.log(`⚡ Loaded ${allItems.length} items from Local Cache (Reads saved!)`);
            renderFeaturedGames();
            filterAndRenderCurrentView();
            renderCategories();
            return;
        } catch (e) {
            console.error("Cache parse error:", e);
        }
    }

    // Cache မရှိတော့လျှင် သို့မဟုတ် သက်တမ်းကုန်မှသာ Firebase ကို အသစ်လှမ်းခေါ်မည်
    try {
        const q = query(collection(db, "games"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allItems = [];
        querySnapshot.forEach((doc) => {
            allItems.push({ id: doc.id, ...doc.data() });
        });

        // LocalStorage ထဲ ခေတ္တသိမ်းထားမည်
        localStorage.setItem(CACHE_KEY, JSON.stringify(allItems));
        localStorage.setItem(CACHE_TIME_KEY, now);

        console.log(`✅ Loaded ${allItems.length} items from Firebase Firestore & Cached`);
        
        renderFeaturedGames();
        filterAndRenderCurrentView();
        renderCategories();
    } catch (error) {
        console.error("❌ Load error:", error);
        // Firebase error တက်ရင်တောင် Cache ထဲမှာ ဟောင်းတာရှိရင် ဆွဲထုတ်ပြပေးမယ်
        if (cachedData) {
            allItems = JSON.parse(cachedData);
            renderFeaturedGames();
            filterAndRenderCurrentView();
            renderCategories();
        } else {
            showError();
        }
    }
}

// ============================================
// Content Type Switcher (Games / Apps Tabs)
// ============================================
window.switchContentType = function(type) {
    currentContentType = type;
    currentPage = 1; // Tab ပြောင်းရင် Page 1 ကို ပြန်သွားမယ်

    const gameBtn = document.getElementById('tabGameBtn');
    const appBtn = document.getElementById('tabAppBtn');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = ''; // Tab ပြောင်းရင် Search box ကို ရှင်းမယ်

    if (type === 'game') {
        gameBtn.classList.add('active');
        appBtn.classList.remove('active');
    } else {
        appBtn.classList.add('active');
        gameBtn.classList.remove('active');
    }

    filterAndRenderCurrentView();
};

// လက်ရှိ Tab နဲ့ Search/Filter အပေါ်မူတည်ပြီး ဒေတာခွဲထုတ်မယ်
function filterAndRenderCurrentView(customList = null) {
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const featuredWrapper = document.getElementById('featuredSectionWrapper');
    const categoriesSection = document.querySelector('.categories-section');
    const listTitle = document.getElementById('listSectionTitle');

    const isSearching = searchQuery.length > 0;

    if (currentContentType === 'app') {
        if (featuredWrapper) featuredWrapper.style.display = 'none';
        if (categoriesSection) categoriesSection.style.display = 'none';
        if (listTitle) listTitle.textContent = isSearching ? '📱 Search Results in Apps' : '📱 Latest Apps';
    } else {
        if (isSearching) {
            if (featuredWrapper) featuredWrapper.style.display = 'none';
            if (categoriesSection) categoriesSection.style.display = 'none';
            if (listTitle) listTitle.textContent = '🕹️ Search Results in Games';
        } else {
            if (featuredWrapper) featuredWrapper.style.display = 'block';
            if (categoriesSection) categoriesSection.style.display = 'block';
            if (listTitle) listTitle.textContent = '🕹️ Latest Games';
        }
    }

    let list = customList;

    if (!list) {
        // ၁။ ပထမဦးဆုံး လက်ရှိ Tab အလိုက် စစ်ထုတ်မည်
        list = allItems.filter(item => {
            const platform = String(item.platform || "").toLowerCase();
            const category = String(item.category || item.type || item.features || "").toLowerCase();
            const isApp = platform === 'app' || category.includes('app') || category.includes('utility') || category.includes('tool');

            return currentContentType === 'app' ? isApp : !isApp;
        });

        // ၂။ Search Query ရှိနေရင် နာမည်နဲ့ Keywords တွေပါတာကို သေချာစစ်ထုတ်မည်
        if (isSearching) {
            list = list.filter(item => {
                const name = String(item.name || "").toLowerCase();
                const platform = String(item.platform || "").toLowerCase();
                const type = String(item.type || "").toLowerCase();
                const features = String(item.features || "").toLowerCase();
                const category = String(item.category || "").toLowerCase();

                return name.includes(searchQuery) || 
                       platform.includes(searchQuery) || 
                       type.includes(searchQuery) || 
                       features.includes(searchQuery) || 
                       category.includes(searchQuery);
            });
        }
    }

    renderPaginatedList(list);
}

// ============================================
// Pagination စနစ် (တစ်မျက်နှာ ၄၅ ခု)
// ============================================
function renderPaginatedList(list) {
    const container = document.getElementById("gamesList");
    const paginationContainer = document.getElementById("paginationContainer");
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="no-games" style="text-align:center; padding:20px; color:#888;">📂 No items available.</div>`;
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    const totalPages = Math.ceil(list.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = list.slice(start, end);

    container.innerHTML = pageItems.map(item => createGameCard(item, false)).join("");
    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById("paginationContainer");
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = '';
    
    // Previous Button
    html += `<button type="button" class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">◀</button>`;

    // Page Numbers with Ellipsis (...) Logic
    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentPage <= 4) {
            pages = [1, 2, 3, 4, 5, '...', totalPages];
        } else if (currentPage >= totalPages - 3) {
            pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
    }

    pages.forEach(p => {
        if (p === '...') {
            html += `<span style="padding: 0 5px; color: #888; font-weight: bold;">...</span>`;
        } else {
            html += `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
        }
    });

    // Next Button
    html += `<button type="button" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">▶</button>`;

    container.innerHTML = html;
}

window.changePage = function(page) {
    currentPage = page;
    filterAndRenderCurrentView();
    window.scrollTo({ top: 400, behavior: 'smooth' });
};

// ============================================
// Featured ဂိမ်းတွေကို ပြမယ်
// ============================================
function renderFeaturedGames() {
    const container = document.getElementById("featuredGames");
    if (!container) return;

    const featured = allItems.filter(item => {
        const platform = String(item.platform || "").toLowerCase();
        const isGame = platform !== 'app';
        const isFeatured = item.featured === true || item.featured === "true";
        return isGame && isFeatured;
    });

    if (featured.length === 0) {
        container.innerHTML = `<div class="empty-featured" style="color:#888; font-size:13px; padding:10px;">No featured games yet.</div>`;
        return;
    }

    container.innerHTML = featured.map(item => createGameCard(item, true)).join("");
}

// ============================================
// ဂိမ်း/အက်ပ် Card ဖန်တီးမယ်
// ============================================
function createGameCard(game, featured = false) {
    const icon = game.icon || game.image || "🎮";
    let imageHTML;

    if (isImageURL(icon)) {
        imageHTML = `<img src="${escapeHTML(icon)}" alt="${escapeHTML(game.name || "Item")}" class="game-card-image" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='🎮';">`;
    } else {
        imageHTML = `<div class="game-card-image" style="display:flex; align-items:center; justify-content:center; background:var(--search-bg); color:var(--text-color); font-size:24px;">${escapeHTML(icon)}</div>`;
    }

    const gameType = String(game.type || "Original").trim();
    const gameId = String(game.id || "").trim();

    if (featured) {
        return `
            <div class="game-card featured-card" data-game-id="${escapeHTML(gameId)}" onclick="openGameFromCard(this)" role="button" tabindex="0">
                ${imageHTML}
                <h3 class="game-card-name">${escapeHTML(game.name || "Unknown")}</h3>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(gameType)} • ${escapeHTML(game.size || "")}</div>
            </div>
        `;
    } else {
        return `
            <div class="game-card" data-game-id="${escapeHTML(gameId)}" onclick="openGameFromCard(this)" role="button" tabindex="0">
                ${imageHTML}
                <div class="game-info-container">
                    <h3 class="game-card-name">${escapeHTML(game.name || "Unknown")}</h3>
                    <div class="game-card-version">${escapeHTML(gameType)} • ${escapeHTML(game.size || "Free")}</div>
                </div>
            </div>
        `;
    }
}

// ============================================
// Navigation & Detail Page Functions (Global)
// ============================================
window.openGameFromCard = function(card) {
    if (!card) return;
    const gameId = card.getAttribute("data-game-id");
    if (!gameId || gameId === "undefined" || gameId === "null") {
        console.error("❌ Invalid Game ID");
        return;
    }
    openGame(gameId);
};

function openGame(id) {
    if (!id || String(id).trim() === "") return;
    window.location.assign("./detail.html?id=" + encodeURIComponent(String(id).trim()));
}

// ============================================
// Categories ထဲမှာ Small Games, Multiplayer နဲ့ Platform တွေ ထည့်သွင်းခြင်း
// ============================================
function renderCategories() {
    const container = document.getElementById("categoriesList");
    if (!container) return;

    const platforms = [...new Set(allItems
        .filter(item => String(item.platform || "").toLowerCase() !== 'app')
        .map(item => item.platform)
        .filter(Boolean)
    )];
    
    let html = `<button type="button" class="category-btn" onclick="filterSmallGames(this)">🕹️ SMALL GAMES</button>`;
    html += `<button type="button" class="category-btn" onclick="filterMultiplayerGames(this)">🌐 MULTIPLAYER</button>`;
    
    html += platforms.map(platform => {
        const safePlatform = encodeURIComponent(String(platform));
        return `<button type="button" class="category-btn" onclick="filterPlatform('${safePlatform}', this)">🎮 ${escapeHTML(String(platform).toUpperCase())}</button>`;
    }).join("");

    container.innerHTML = html;
}

function setActiveButton(btn) {
    if (!btn) return;
    const buttons = document.querySelectorAll("#categoriesList .category-btn");
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

window.filterPlatform = function(platform, btn) {
    setActiveButton(btn);
    const decoded = decodeURIComponent(platform);
    const filtered = allItems.filter(item => String(item.platform || "").toLowerCase() === String(decoded).toLowerCase());
    currentPage = 1;
    renderPaginatedList(filtered);
};

window.filterSmallGames = function(btn) {
    setActiveButton(btn);
    const filtered = allItems.filter(item => item.isSmallGame === true || item.isSmallGame === "true");
    currentPage = 1;
    renderPaginatedList(filtered);
};

window.filterMultiplayerGames = function(btn) {
    setActiveButton(btn);
    const filtered = allItems.filter(item => {
        const platform = String(item.platform || "").toLowerCase();
        const type = String(item.type || "").toLowerCase();
        const name = String(item.name || "").toLowerCase();
        const category = String(item.category || "").toLowerCase();
        const description = String(item.description || "").toLowerCase();
        
        return category.includes("multiplayer") || platform.includes("multiplayer") || name.includes("online") || description.includes("online");
    });
    currentPage = 1;
    renderPaginatedList(filtered);
};

function setupSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    input.addEventListener("input", () => {
        currentPage = 1;
        filterAndRenderCurrentView();
    });
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function isImageURL(value) {
    if (typeof value !== "string") return false;
    return /^https?:\/\//i.test(value);
}

function showError() {
    const container = document.getElementById("gamesList");
    if (!container) return;
    container.innerHTML = `<div class="firebase-error" style="text-align:center; padding:20px; color:#ff5252;">❌<br><br>ဒေတာများ Load လုပ်၍မရပါ။</div>`;
}

function setupNavigation() {
    const buttons = document.querySelectorAll(".nav-item");
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            buttons.forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            if (button.dataset.page === "home") window.location.href = "index.html";
            else if (button.dataset.page === "categories") document.querySelector(".categories-section")?.scrollIntoView({ behavior: "smooth" });
        });
    });
}

// ============================================
// Initialization
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('themeToggleBtn');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (btn) btn.textContent = '☀️';
    }

    setTimeout(() => {
        const splash = document.getElementById("splashScreen");
        const main = document.getElementById("mainApp");
        if (splash) splash.style.display = "none";
        if (main) main.style.display = "block";
    }, 1000);

    setupSearch();
    setupNavigation();
    loadGamesFromFirebase();
});
