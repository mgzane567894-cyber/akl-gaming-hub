let editingGameId = null;
let allGames = []; 

const ADMIN_SECRET_KEY = "Aungmyosat12";

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
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function verifyAdminPassword() {
    const inputPass = document.getElementById("adminPasswordInput").value;
    const errorMsg = document.getElementById("loginErrorMsg");

    if (inputPass === ADMIN_SECRET_KEY) {
        sessionStorage.setItem("isAdminLoggedIn", "true");
        document.getElementById("adminLoginModal").style.display = "none";
        document.getElementById("adminApp").style.display = "block";
        loadStatsAndGames();
    } else {
        errorMsg.style.display = "block";
    }
}

function adminLogout() {
    sessionStorage.removeItem("isAdminLoggedIn");
    location.reload();
}

document.addEventListener("DOMContentLoaded", function() {
    const isLoggedIn = sessionStorage.getItem("isAdminLoggedIn");
    const loginModal = document.getElementById("adminLoginModal");
    const adminApp = document.getElementById("adminApp");

    if (isLoggedIn === "true") {
        if (loginModal) loginModal.style.display = "none";
        if (adminApp) adminApp.style.display = "block";
        loadStatsAndGames();
    } else {
        if (loginModal) loginModal.style.display = "flex";
        if (adminApp) adminApp.style.display = "none";
    }

    const searchInput = document.getElementById("gameSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", function(e) {
            const keyword = e.target.value.toLowerCase().trim();
            const filtered = allGames.filter(game => 
                (game.name || "").toLowerCase().includes(keyword)
            );
            renderGamesList(filtered);
        });
    }
});

async function fetchFirebaseGames() {
    try {
        const querySnapshot = await getDocs(collection(db, "games"));
        const games = [];
        querySnapshot.forEach((document) => {
            games.push({ id: document.id, ...document.data() });
        });
        return games;
    } catch (e) {
        console.error("Error fetching games:", e);
        return [];
    }
}

async function loadStatsAndGames() {
    await loadStats();
    await loadGames();
}

async function loadStats() {
    try {
        const games = await fetchFirebaseGames();
        const featured = games.filter(game => game.featured === true || game.featured === "true");
        document.getElementById("totalGames").textContent = games.length;
        document.getElementById("featuredGames").textContent = featured.length;
    } catch (error) {
        console.error("Stats Error:", error);
    }
}

async function loadGames() {
    try {
        allGames = await fetchFirebaseGames();
        renderGamesList(allGames);
        await loadStats();
    } catch (error) {
        console.error("Error loading games:", error);
    }
}

function renderGamesList(gamesArray) {
    const container = document.getElementById("adminGamesList");
    if (!container) return;

    if (gamesArray.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#666;">📂 No items found.</div>`;
        return;
    }

    container.innerHTML = gamesArray.map(game => {
        const icon = game.icon || game.image || "🎮";
        const iconHTML = isImageURL(icon) 
            ? `<img src="${escapeHTML(icon)}" class="admin-game-icon-image" alt="${escapeHTML(game.name)}">` 
            : `<div class="admin-game-icon">${escapeHTML(icon)}</div>`;
        
        const rating = game.rating !== undefined && game.rating !== null ? Number(game.rating).toFixed(1) : "5.0";
        const hasObb = game.obb_link ? `<span style="font-size: 11px; background: #e0f7fa; color: #00838f; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">📦 OBB</span>` : "";
        const hasWifi = game.wifiDownloadUrl ? `<span style="font-size: 11px; background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">🛜 WiFi</span>` : "";
        const isSmall = game.isSmallGame === true || game.isSmallGame === "true";
        const smallBadge = isSmall ? `<span style="font-size: 11px; background: #00bcd4; color: #000; padding: 2px 6px; border-radius: 4px; margin-left: 4px; font-weight: bold;">🕹️ SMALL</span>` : "";

        return `
            <div class="admin-game-item">
                <div class="admin-game-info">
                    ${iconHTML}
                    <div class="admin-game-details">
                        <div class="admin-game-name" title="${escapeHTML(game.name || "Unnamed")}">${escapeHTML(game.name || "Unnamed")} ${hasWifi} ${hasObb} ${smallBadge}</div>
                        <div style="font-size: 12px; color: #888; margin-top: 4px;">★ ${rating} • ${escapeHTML(String(game.platform || "").toUpperCase())} • ${escapeHTML(game.type || "Original")}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                    <button type="button" class="action-btn secondary" style="padding: 6px 10px; font-size: 12px; flex: 1;" onclick="editGame('${escapeHTML(String(game.id))}')">✏️ Edit</button>
                    <button type="button" class="action-btn danger" style="padding: 6px 10px; font-size: 12px; flex: 1;" onclick="deleteGame('${escapeHTML(String(game.id))}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join("");
}

function showAddForm() {
    const form = document.getElementById("gameForm");
    form.style.display = "block";
    document.getElementById("formTitle").textContent = "➕ Add New Item";
    document.getElementById("gameFormInputs").reset();
    document.getElementById("editId").value = "";
    document.getElementById("gamePlatform").value = "";
    document.getElementById("gameType").value = "Original";
    document.getElementById("gameIsSmall").checked = false;
    editingGameId = null;
    form.scrollIntoView({ behavior: "smooth" });
}

async function editGame(id) {
    try {
        const game = allGames.find(g => String(g.id) === String(id));
        if (!game) return alert("❌ Item not found!");

        editingGameId = game.id;
        document.getElementById("gameForm").style.display = "block";
        document.getElementById("formTitle").textContent = "✏️ Edit Item";
        document.getElementById("editId").value = game.id;

        document.getElementById("gameName").value = game.name || "";
        document.getElementById("gamePlatform").value = (game.platform || "").toLowerCase();
        document.getElementById("gameType").value = game.type || "Original";
        document.getElementById("gameVersion").value = game.version || "";
        document.getElementById("gameSize").value = game.size || "";
        document.getElementById("gameIcon").value = game.icon || game.image || "";
        document.getElementById("gameDescription").value = game.description || "";
        document.getElementById("gameFeatures").value = Array.isArray(game.features) ? game.features.join(", ") : (game.features || "");
        
        // Data & WiFi Links ထည့်သွင်းခြင်း
        document.getElementById("gameDataDownloadUrl").value = game.dataDownloadUrl || game.downloadUrl || "";
        document.getElementById("gameWifiDownloadUrl").value = game.wifiDownloadUrl || "";
        document.getElementById("gameObbUrl").value = game.obb_link || "";
        document.getElementById("gamePlayStoreUrl").value = game.playStoreUrl || "";
        
        const screenshots = Array.isArray(game.screenshots) ? game.screenshots : [];
        document.getElementById("screenshot1").value = screenshots[0] || "";
        document.getElementById("screenshot2").value = screenshots[1] || "";
        document.getElementById("screenshot3").value = screenshots[2] || "";
        document.getElementById("screenshot4").value = screenshots[3] || "";
        document.getElementById("gameFeatured").checked = game.featured === true || game.featured === "true";
        document.getElementById("gameIsSmall").checked = game.isSmallGame === true || game.isSmallGame === "true";

        document.getElementById("gameForm").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        console.error("Edit Error:", error);
    }
}

function cancelForm() {
    document.getElementById("gameForm").style.display = "none";
    document.getElementById("gameFormInputs").reset();
    editingGameId = null;
}

async function saveGame(event) {
    event.preventDefault();

    const id = document.getElementById("editId").value.trim();
    const name = document.getElementById("gameName").value.trim();
    const platform = document.getElementById("gamePlatform").value.toLowerCase();
    const type = document.getElementById("gameType").value;
    const version = document.getElementById("gameVersion").value.trim() || "1.0.0";
    const size = document.getElementById("gameSize").value.trim() || "Unknown";
    const icon = document.getElementById("gameIcon").value.trim() || "🎮";
    const description = document.getElementById("gameDescription").value.trim() || "No description available.";
    
    const featuresInput = document.getElementById("gameFeatures").value;
    const features = featuresInput ? featuresInput.split(",").map(i => i.trim()).filter(Boolean) : [];
    
    // Data & WiFi Links
    const dataDownloadUrl = document.getElementById("gameDataDownloadUrl").value.trim();
    const wifiDownloadUrl = document.getElementById("gameWifiDownloadUrl").value.trim();
    const obb_link = document.getElementById("gameObbUrl").value.trim();
    const playStoreUrl = document.getElementById("gamePlayStoreUrl").value.trim();
    
    const screenshots = [
        document.getElementById("screenshot1")?.value.trim(),
        document.getElementById("screenshot2")?.value.trim(),
        document.getElementById("screenshot3")?.value.trim(),
        document.getElementById("screenshot4")?.value.trim()
    ].filter(Boolean);

    const featured = document.getElementById("gameFeatured")?.checked || false;
    const isSmallGame = document.getElementById("gameIsSmall")?.checked || false;

    if (!name || !platform || !dataDownloadUrl) {
        alert("❌ Please fill in required fields (Name, Platform/Type, Data Download URL).");
        return;
    }

    const gameData = {
        name,
        platform,
        type,
        version,
        size,
        icon,
        description,
        features,
        dataDownloadUrl,
        wifiDownloadUrl,
        downloadUrl: dataDownloadUrl, // Backward compatibility အတွက်ပါ ထည့်ပေးထားသည်
        obb_link,
        playStoreUrl,
        screenshots,
        featured,
        isSmallGame,
        updatedAt: Date.now()
    };

    if (!id) {
        gameData.rating = 5.0;
        gameData.total_ratings = 0;
    }

    try {
        if (id) {
            const gameDocRef = doc(db, "games", id);
            await updateDoc(gameDocRef, gameData);
            alert("✅ Updated successfully!");
        } else {
            await addDoc(collection(db, "games"), gameData);
            alert("✅ Added successfully!");
        }

        cancelForm();
        await loadGames();
    } catch (error) {
        console.error("Save Error:", error);
        alert("❌ Error saving: " + (error.message || JSON.stringify(error)));
    }
}

async function deleteGame(id) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
        await deleteDoc(doc(db, "games", id));
        alert("🗑️ Deleted successfully!");
        await loadGames();
    } catch (error) {
        console.error("Delete Error:", error);
        alert("❌ Could not delete item.");
    }
}

async function uploadJSONBatch() {
    const fileInput = document.getElementById("jsonBatchFile");
    if (!fileInput || !fileInput.files.length) {
        alert("❌ ကျေးဇူးပြု၍ JSON ဖိုင်ကို အရင်ရွေးချယ်ပါ။");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const gamesArray = JSON.parse(e.target.result);
            if (!Array.isArray(gamesArray)) {
                alert("❌ ဖတ်ရှုရသော JSON ဖိုင်သည် Array ပုံစံ မဟုတ်ပါ။");
                return;
            }

            const batch = writeBatch(db);

            gamesArray.forEach((game, index) => {
                const cleanName = game.name ? game.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : `item_${index}`;
                const gameId = `item_${Date.now()}_${index}_${cleanName}`;
                const gameRef = doc(db, "games", gameId);

                let features = game.features;
                if (typeof features === "string") {
                    features = features.split(",").map(i => i.trim()).filter(Boolean);
                } else if (!Array.isArray(features)) {
                    features = [];
                }

                const dUrl = game.dataDownloadUrl || game.downloadUrl || "";

                batch.set(gameRef, {
                    name: game.name || "Unnamed",
                    platform: (game.platform || "android").toLowerCase(),
                    type: game.type || "Original",
                    version: game.version || "1.0.0",
                    size: game.size || "Unknown",
                    icon: game.icon || game.image || "",
                    description: game.description || "No description available.",
                    features: features,
                    dataDownloadUrl: dUrl,
                    wifiDownloadUrl: game.wifiDownloadUrl || "",
                    downloadUrl: dUrl,
                    obb_link: game.obb_link || game.obbLink || "",
                    playStoreUrl: game.playStoreUrl || "",
                    screenshots: Array.isArray(game.screenshots) ? game.screenshots : [],
                    featured: game.featured === true || game.featured === "true",
                    isSmallGame: game.isSmallGame === true || game.isSmallGame === "true",
                    rating: 5.0,
                    total_ratings: 0,
                    updatedAt: Date.now()
                });
            });

            await batch.commit();
            alert(`🎉 ဒေတာ ${gamesArray.length} ခုလုံး Firebase သို့ အောင်မြင်စွာ ဝင်ရောက်သွားပါပြီ သားရီး!`);
            fileInput.value = "";
            await loadGames();
        } catch (error) {
            console.error("JSON Batch Upload Error:", error);
            alert("❌ Error ဖြစ်သွားပါသည်: " + error.message);
        }
    };

    reader.readAsText(file);
}

function isImageURL(value) {
    return typeof value === "string" && /^https?:\/\//i.test(value);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.verifyAdminPassword = verifyAdminPassword;
window.adminLogout = adminLogout;
window.showAddForm = showAddForm;
window.editGame = editGame;
window.cancelForm = cancelForm;
window.saveGame = saveGame;
window.deleteGame = deleteGame;
window.uploadJSONBatch = uploadJSONBatch;
window.loadGames = loadGames;
