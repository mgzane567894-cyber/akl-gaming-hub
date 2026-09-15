import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDZv-a33YAuaD1VDWH2HbUXvVxCxIgN9k",
    authDomain: "akl-gaming-hub-v2.firebaseapp.com",
    projectId: "akl-gaming-hub-v2",
    storageBucket: "akl-gaming-hub-v2.appspot.com",
    messagingSenderId: "346718543772",
    appId: "1:346718543772:web:9ee8b5d8f48a3b3d487259"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateGames() {
    try {
        const response = await fetch('games.json');
        const data = await response.json();
        
        let games = [];
        if (Array.isArray(data)) {
            games = data;
        } else if (data.games && Array.isArray(data.games)) {
            games = data.games;
        }

        console.log(`စုစုပေါင်း ဂိမ်းရေ: ${games.length}`);

        // Firebase Firestore batch limit က အများဆုံး ဂိမ်း ၅၀၀ မို့လို့ ၁၁၇ ခုက အေးဆေး ရပါတယ်။
        const batch = writeBatch(db);

        games.forEach((game, index) => {
            const cleanName = game.name ? game.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : `game_${index}`;
            const gameId = `game_${index + 1}_${cleanName}`;
            const gameRef = doc(db, "games", gameId);
            
            batch.set(gameRef, {
                name: game.name || "",
                platform: game.platform || "android",
                type: game.type || "Original",
                version: game.version || "1.0",
                size: game.size || "Unknown",
                icon: game.icon || game.image || "",
                description: game.description || "",
                downloadUrl: game.downloadUrl || game.downloadurl || "",
                obb_link: game.obb_link || game.obbLink || "",
                playStoreUrl: game.playStoreUrl || game.playstoreurl || "",
                features: game.features || [],
                screenshots: game.screenshots || [],
                featured: game.featured || false,
                updatedAt: Date.now()
            });
        });

        await batch.commit();
        alert(`🎉 ဂိမ်း ${games.length} ခု လုံး အမှန်အတိုင်း အပြည့်အစုံ ဝင်သွားပါပြီ သားရီး!`);
        location.reload();
    } catch (error) {
        console.error("Migration Error:", error);
        alert("❌ Error ဖြစ်သွားပါသည်: " + error.message);
    }
}

window.migrateGames = migrateGames;
