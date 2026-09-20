let allItems = []; 
let currentContentType = 'game'; 
let currentPage = 1;
const itemsPerPage = 45; 

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

// Local games.json ဖိုင်မှ ဒေတာများကို တိုက်ရိုက်ဖတ်မည်
async function loadGamesFromLocal() {
    try {
        const response = await fetch('games.json?' + new Date().getTime()); // Cache ပြဿနာကင်းစေရန် timestamp ထည့်ထားသည်
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        allItems = await response.json();
        
        renderHeroBannerData();
        filterAndRenderCurrentView();
        renderCategories();
    } catch (error) {
        console.error("❌ Load error:", error);
        showError();
    }
}

window.switchContentType = function(type) {
    currentContentType = type;
    currentPage = 1; 

    const gameBtn = document.getElementById('tabGameBtn');
    const appBtn = document.getElementById('tabAppBtn');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = ''; 

    if (type === 'game') {
        gameBtn.classList.add('active');
        appBtn.classList.remove('active');
    } else {
        appBtn.classList.add('active');
        gameBtn.classList.remove('active');
    }

    const categoryButtons = document.querySelectorAll("#categoriesList .category-btn");
    categoryButtons.forEach(b => b.classList.remove("active"));

    filterAndRenderCurrentView();
};

window.showAllGames = function(event) {
    if (event) event.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const categoryButtons = document.querySelectorAll("#categoriesList .category-btn");
    categoryButtons.forEach(b => b.classList.remove("active"));

    currentPage = 1;
    filterAndRenderCurrentView();
};

function filterAndRenderCurrentView(customList = null) {
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const heroBannerSection = document.getElementById('heroBannerSection');
    const categoriesSection = document.querySelector('.categories-section');
    const listTitle = document.getElementById('listSectionTitle');

    const isSearching = searchQuery.length > 0;

    if (currentContentType === 'app') {
        if (heroBannerSection) heroBannerSection.style.display = 'none';
        if (categoriesSection) categoriesSection.style.display = 'none';
        if (listTitle) listTitle.textContent = isSearching ? '📱 Search Results in Apps' : '📱 Latest Apps';
    } else {
        if (isSearching) {
            if (heroBannerSection) heroBannerSection.style.display = 'none';
            if (categoriesSection) categoriesSection.style.display = 'none';
            if (listTitle) listTitle.textContent = '🕹️ Search Results in Games';
        } else {
            if (heroBannerSection) heroBannerSection.style.display = 'block';
            if (categoriesSection) categoriesSection.style.display = 'block';
            if (listTitle) listTitle.textContent = '🔥 အထူးလူကြိုက်များသော (Hot Games)';
        }
    }

    let list = customList;

    if (!list) {
        list = allItems.filter(item => {
            const platform = String(item.platform || "").toLowerCase();
            const category = String(item.category || item.type || item.features || "").toLowerCase();
            const isApp = platform === 'app' || category.includes('app') || category.includes('utility') || category.includes('tool');

            return currentContentType === 'app' ? isApp : !isApp;
        });

        if (isSearching) {
            list = list.filter(item => {
                const name = String(item.name || "").toLowerCase();
                const platform = String(item.platform || "").toLowerCase();
                const type = String(item.type || "").toLowerCase();
                const features = Array.isArray(item.features) ? item.features.join(" ").toLowerCase() : String(item.features || "").toLowerCase();
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

function renderPaginatedList(list) {
    const container = document.getElementById("gamesList");
    const paginationContainer = document.getElementById("paginationContainer");
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="no-games" style="grid-column: 1/-1; text-align:center; padding:20px; color:#888;">📂 No items available.</div>`;
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    const totalPages = Math.ceil(list.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = list.slice(start, end);

    container.innerHTML = pageItems.map((item, index) => createMiniGameCard(item, index, start)).join("");
    renderPaginationControls(totalPages);
}

function createMiniGameCard(game, index, startOffset) {
    const image = game.icon || game.image || "";
    const gameId = String(game.id || "").trim();

    let tagHtml = '';
    const isHot = game.isHot === true || game.isHot === "true" || game.isHot === 1;
    const isNew = game.isNew === true || game.isNew === "true" || game.isNew === 1;
    const isUpdate = game.isUpdate === true || game.isUpdate === "true" || game.isUpdate === 1;

    if (isHot) {
        tagHtml += `<span class="badge-tag">HOT</span>`;
    }
    if (isNew) {
        tagHtml += `<span class="badge-tag new">NEW</span>`;
    }
    if (isUpdate) {
        tagHtml += `<span class="badge-tag update" style="background:#ff9800; color:#fff;">UPDATE</span>`;
    }

    return `
        <div class="mini-game-card" data-game-id="${escapeHTML(gameId)}" onclick="openGameFromCard(this)" style="cursor: pointer; position: relative;">
            ${tagHtml}
            <img src="${escapeHTML(image)}" alt="${escapeHTML(game.name || "Game")}" class="mini-game-img" onerror="this.src='default.png'">
            <div class="mini-game-footer">
                <span class="mini-game-name">${escapeHTML(game.name || "Unknown")}</span>
                <button class="play-small-btn" type="button">ကြည့်မယ်</button>
            </div>
        </div>
    `;
}

function renderHeroBannerData() {
    const container = document.getElementById("heroBannerCard");
    if (!container) return;

    const customBannerImg = "https://i.ibb.co/jpyPF1J/Chat-GPT-Image-Sep-19-2026-03-20-56-PM.png";
    container.innerHTML = `
        <img src="${escapeHTML(customBannerImg)}" alt="AKL Gaming HUB Banner" class="hero-banner-img" style="width: 100%; border-radius: 12px; display: block;">
    `;
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById("paginationContainer");
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = '';
    html += `<button type="button" class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">◀</button>`;

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

    html += `<button type="button" class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">▶</button>`;

    container.innerHTML = html;
}

window.changePage = function(page) {
    currentPage = page;
    filterAndRenderCurrentView();
    window.scrollTo({ top: 400, behavior: 'smooth' });
};

window.openGameFromCard = function(card) {
    if (!card) return;
    const gameId = card.getAttribute("data-game-id");
    if (!gameId || gameId === "undefined" || gameId === "null") return;
    openGame(gameId);
};

function openGame(id) {
    if (!id || String(id).trim() === "") return;
    // details.html သို့ အချက်အလက်မှန်ကန်စွာ ပို့ပေးရန်
    window.location.assign("./details.html?id=" + encodeURIComponent(String(id).trim()));
}

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

function showError() {
    const container = document.getElementById("gamesList");
    if (!container) return;
    container.innerHTML = `<div class="firebase-error" style="grid-column: 1/-1; text-align:center; padding:20px; color:#ff5252;">❌<br><br>ဒေတာများ Load လုပ်၍မရပါ။</div>`;
}

window.goHomePage = function() {
    window.location.href = "index.html";
};

window.goCategoriesPage = function() {
    document.querySelector(".categories-section")?.scrollIntoView({ behavior: "smooth" });
};

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
    loadGamesFromLocal();
});
