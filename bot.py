import logging
import os
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg2
from psycopg2.extras import RealDictCursor
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, filters

# Firebase Admin SDK (Website Firebase အတွက်)
import firebase_admin
from firebase_admin import credentials, firestore

# Render Free Web Service အတွက် Fake Server
class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"AKL Gaming Hub Bot is running live with Supabase & Firebase Dual-Sync!")

def run_dummy_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
    server.serve_forever()

# Logging သတ်မှတ်ခြင်း
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ---------------- CONFIGURATION ----------------
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8840218731:AAExjF4reevpsWZ7yKPcL5QKYRxfApQW980")
ADSTERRA_DIRECT_LINK = "https://asiafilm.org/4/c5943dad7af79670ea07ba03b2199713"
ADMIN_ID = 7122952141

# Supabase Database URL (Transaction Pooler - IPv4 Compatible)
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.ncjrzuhpdiwrjveogpmt:aungkhainglin12@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres")

WELCOME_IMAGE = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCrFvWn7BeKrQtNho2cu_CqR-X0f8BuptBTTIt4fzBbAc-rGTu_dQ1pQLUkMGmsRboaG49JqB4jqQXzUJ-W2obNGmN-EwGVcwFMLQnpSO_ZvLNGhTinvQkc1SWOmFmD-ZgelySMmNMqx0qE3UeYIG6OSt06Xd1gu7Hbpc2lPnXm3jw5_9a0E4W_VNYnj0/s736/45709.jpg"

# ---------------- FIREBASE INITIALIZATION ----------------
firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
if firebase_creds_json:
    creds_dict = json.loads(firebase_creds_json)
    cred = credentials.Certificate(creds_dict)
    firebase_admin.initialize_app(cred)
else:
    # Local မှာ စမ်းသပ်ပါက serviceAccountKey.json ဖိုင်ဖြင့် ချိတ်ဆက်ရန်
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)

db_firestore = firestore.client() if firebase_admin._apps else None

# Conversation States (Step-by-Step အဆင့်များ)
(
    GET_KEY_NAME,
    GET_PLATFORM,
    GET_TYPE,
    GET_VERSION_SIZE,
    GET_DESCRIPTION,
    GET_FEATURES,
    GET_ICON,
    GET_ORIGINAL_LINK,
    GET_MOD_LINK,
    GET_OBB_LINK,
    GET_SCREENSHOTS,
    GET_BADGES,
    GET_FILE
) = range(13)

# Database Connection Helper Function
def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# Supabase မှ ဂိမ်းအချက်အလက်များ အားလုံး ဖတ်ယူရန်
def load_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM games;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        db = {}
        for row in rows:
            db[row['key']] = {
                "name": row['name'],
                "link": row['link'],
                "image": row['image']
            }
        return db
    except Exception as e:
        print(f"Database Load Error: {e}")
        return {}

# ---------------- HANDLERS ----------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    args = context.args
    db = load_db()
    
    if not args:
        welcome_text = (
            f"🔥 **မင်္ဂလာပါ {user.first_name}!** 🔥\n\n"
            "🎮 **AKL Gaming Hub File Bot မှ နွေးထွေးစွာ ကြိုဆိုပါတယ် သားရီး!**\n\n"
            "🔍 **ဂိမ်းများ ရှာဖွေလိုပါက အောက်ပါအတိုင်း ရိုက်ရှာနိုင်ပါတယ် -**\n"
            "👉 `/search ဂိမ်းနာမည်`"
        )
        try:
            await update.message.reply_photo(photo=WELCOME_IMAGE, caption=welcome_text, parse_mode="Markdown")
        except Exception:
            await update.message.reply_text(text=welcome_text, parse_mode="Markdown")
        return

    game_key = args[0]
    if game_key not in db:
        await update.message.reply_text("⚠️ ဒီဂိမ်း မရှိသေးပါ သားရီး။ မကြာမီ တင်ပေးပါမည်။")
        return
        
    game_info = db[game_key]
    game_name = game_info["name"]
    game_image = game_info["image"]
    
    context.user_data['unlocked'] = False
    context.user_data['game_key'] = game_key
    
    game_text = (
        f"🔥 **Hey {user.first_name}!** 🔥\n\n"
        f"🎮 **ဂိမ်းအမည်:** {game_name}\n\n"
        "⚡ **ဂိမ်းဖိုင် ရယူရန် အဆင့်များ:**\n"
        "၁။ အောက်ပါ **'🔓 Unlock Download Link (Ad)'** ကို တစ်ချက်နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ။\n"
        "၂။ ပြီးလျှင် အဲ့ထဲ ပြန်ထွက်လာပြီး **'📥 Game File ရယူရန်'** ကို နှိပ်ပါ သားရီး!"
    )
    
    keyboard = [
        [InlineKeyboardButton("🔓 Unlock Download Link (Ad)", url=ADSTERRA_DIRECT_LINK)],
        [InlineKeyboardButton("📥 Game File ရယူရန်", callback_data=f"get_file_{game_key}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        if game_image:
            await update.message.reply_photo(photo=game_image, caption=game_text, reply_markup=reply_markup, parse_mode="Markdown")
        else:
            raise Exception()
    except Exception:
        await update.message.reply_text(text=game_text, reply_markup=reply_markup, parse_mode="Markdown")

async def search_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("⚠️ ရှာချင်တဲ့ ဂိမ်းနာမည် ရိုက်ထည့်ပေးပါ သားရီး။ ဥပမာ- `/search simulator`", parse_mode="Markdown")
        return

    query = " ".join(context.args).lower()
    db = load_db()
    results = []

    for key, data in db.items():
        if query in data["name"].lower() or query in key.lower():
            results.append((key, data["name"]))

    if not results:
        await update.message.reply_text(f"⚠️ `{query}` နာမည်နဲ့ ပတ်သက်တဲ့ ဂိမ်း ရှာမတွေ့ပါဘူး သားရီး။", parse_mode="Markdown")
        return

    msg = "🔎 **ရှာဖွေတွေ့ရှိသော ဂိမ်းများ:**\n\n"
    keyboard = []
    bot_username = (await context.bot.get_me()).username
    for key, name in results:
        msg += f"🎮 **{name}**\n"
        game_url = f"https://t.me/{bot_username}?start={key}"
        keyboard.append([InlineKeyboardButton(f"📥 {name} ရယူရန်", url=game_url)])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(msg, reply_markup=reply_markup, parse_mode="Markdown")

# --- CONVERSATION HANDLER FOR ADD GAME (STEP-BY-STEP) ---

async def add_game_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ် သားရီး။")
        return ConversationHandler.END
        
    await update.message.reply_text(
        "➕ **ဂိမ်းအသစ် ထည့်သွင်းခြင်း စတင်ပါပြီ**\n\n"
        "ကျေးဇူးပြု၍ **Game Key** နှင့် **Name** ကို `key | Name` ပုံစံအတိုင်း ရိုက်ထည့်ပါ သားရီး။\n"
        "ဥပမာ- `dave_the_diver | Dave the Diver`",
        parse_mode="Markdown"
    )
    return GET_KEY_NAME

async def receive_key_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if "|" not in text:
        await update.message.reply_text("❌ ပုံစံ မှားယွင်းနေပါသည်။ `key | Name` ပုံစံအတိုင်း ပြန်ထည့်ပေးပါ သားရီး။")
        return GET_KEY_NAME
    
    parts = text.split("|", 1)
    context.user_data["game_key"] = parts[0].strip().lower().replace(" ", "_")
    context.user_data["game_name"] = parts[1].strip()

    await update.message.reply_text(
        "🎮 **Platform / Category** ကို ရွေးချယ်ပေးပါ သားရီး -\n\n"
        "၁။ `android` (Android Game)\n"
        "၂။ `psp` (PSP)\n"
        "၃။ `ps2` (PS2)\n"
        "၄။ `wii` (Wii)\n"
        "၅။ `app` (App / Utility / Tool)\n\n"
        "စာသားအတိုင်း (ဥပမာ `android` သို့မဟုတ် `psp`) ရိုက်ထည့်ပေးပါ။"
    )
    return GET_PLATFORM

async def receive_platform(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    platform = update.message.text.strip().lower()
    valid_platforms = ["android", "psp", "ps2", "wii", "app"]
    if platform not in valid_platforms:
        await update.message.reply_text(f"❌ Platform မှားနေပါသည်။ အောက်ပါတို့မှ ရွေးပေးပါ သားရီး -\n{', '.join(valid_platforms)}")
        return GET_PLATFORM

    context.user_data["platform"] = platform

    await update.message.reply_text(
        "🏷️ **Game Type** ကို ရွေးချယ်ပေးပါ သားရီး -\n\n"
        "စာသားအတိုင်း `Original` ၊ `MOD` သို့မဟုတ် `Full` တစ်ခုခု ရိုက်ထည့်ပေးပါ။"
    )
    return GET_TYPE

async def receive_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    game_type = update.message.text.strip()
    if game_type not in ["Original", "MOD", "Full"]:
        game_type = "Original"
    
    context.user_data["type"] = game_type

    await update.message.reply_text(
        "📦 **Version နှင့် Game Size** ကို `Version | Size` ပုံစံအတိုင်း ရိုက်ထည့်ပေးပါ သားရီး။\n"
        "ဥပမာ- `1.0.0 | 45 MB`"
    )
    return GET_VERSION_SIZE

async def receive_version_size(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if "|" in text:
        v, s = text.split("|", 1)
        context.user_data["version"] = v.strip()
        context.user_data["size"] = s.strip()
    else:
        context.user_data["version"] = "1.0.0"
        context.user_data["size"] = text

    await update.message.reply_text("📝 **Description (ဂိမ်းအကြောင်း စာသား)** ကို ရိုက်ထည့်ပေးပါ သားရီး။")
    return GET_DESCRIPTION

async def receive_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["description"] = update.message.text.strip()

    await update.message.reply_text(
        "✨ **Features** များကို ကော်မာ (,) ခံ၍ ရိုက်ထည့်ပေးပါ သားရီး။\n"
        "ဥပမာ- `Open World, Offline, Action` (မရှိပါက `skip` ဟု ရိုက်ပါ)"
    )
    return GET_FEATURES

async def receive_features(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if text.lower() == "skip":
        context.user_data["features"] = []
    else:
        context.user_data["features"] = [f.strip() for f in text.split(",") if f.strip()]

    await update.message.reply_text("🖼️ **Cover / Icon Image URL** ကို ထည့်ပေးပါ သားရီး (ဥပမာ `https://.../image.jpg`)။")
    return GET_ICON

async def receive_icon(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["icon"] = update.message.text.strip()

    await update.message.reply_text("📥 **Original Download URL** (Website အတွက်) ထည့်ပေးပါ။ မရှိပါက `skip` ဟု ရိုက်ထည့်ပါ။")
    return GET_ORIGINAL_LINK

async def receive_original_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    context.user_data["originalLink"] = "" if text.lower() == "skip" else text

    await update.message.reply_text("⚡ **MOD Download URL** (Website အတွက်) ထည့်ပေးပါ။ မရှိပါက `skip` ဟု ရိုက်ထည့်ပါ။")
    return GET_MOD_LINK

async def receive_mod_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    context.user_data["modLink"] = "" if text.lower() == "skip" else text

    await update.message.reply_text("📦 **OBB File URL** (ရှိပါက) ထည့်ပေးပါ။ မရှိပါက `skip` ဟု ရိုက်ထည့်ပါ။")
    return GET_OBB_LINK

async def receive_obb_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    context.user_data["obb_link"] = "" if text.lower() == "skip" else text

    await update.message.reply_text(
        "📸 **Screenshots URLs** များကို ကော်မာ (,) ခံ၍ ထည့်ပေးပါ သားရီး။\n"
        "ဥပမာ- `https://site.com/1.jpg, https://site.com/2.jpg` (မရှိပါက `skip` ဟု ရိုက်ပါ)"
    )
    return GET_SCREENSHOTS

async def receive_screenshots(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if text.lower() == "skip":
        context.user_data["screenshots"] = []
    else:
        context.user_data["screenshots"] = [s.strip() for s in text.split(",") if s.strip()]

    await update.message.reply_text(
        "🏷️ **Game Badges/Status** များ သတ်မှတ်ရန် အောက်ပါအတိုင်း `1,2` ပုံစံ ရိုက်ပါ (မလိုပါက `skip` ဟု ရိုက်ပါ) -\n\n"
        "1 - 🔥 HOT\n"
        "2 - 🆕 NEW\n"
        "3 - 🆙 UPDATE\n"
        "4 - 🕹️ SMALL GAME\n"
        "5 - ⭐ FEATURED"
    )
    return GET_BADGES

async def receive_badges(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().lower()
    
    context.user_data["isHot"] = "1" in text
    context.user_data["isNew"] = "2" in text
    context.user_data["isUpdate"] = "3" in text
    context.user_data["isSmallGame"] = "4" in text
    context.user_data["featured"] = "5" in text

    await update.message.reply_text("📁 နောက်ဆုံးအဆင့်အနေဖြင့် Telegram Bot အတွက် **APK / Document File** ကို ပို့ပေးပါ သားရီး။")
    return GET_FILE

async def receive_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    document = update.message.document or update.message.video or update.message.audio
    if not document:
        await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ ဂိမ်းဖိုင် (Document/APK) ကိုသာ ပို့ပေးပါ သားရီး။")
        return GET_FILE
        
    file_id = document.file_id
    game_key = context.user_data.get('game_key')
    game_name = context.user_data.get('game_name')
    game_image = context.user_data.get('icon')
    
    orig_link = context.user_data.get('originalLink', '')
    mod_link = context.user_data.get('modLink', '')
    download_url = orig_link if orig_link else mod_link

    # 1. Supabase Database သို့ သိမ်းဆည်းခြင်း (Bot အတွက်)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO games (key, name, link, image) VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, link = EXCLUDED.link, image = EXCLUDED.image;",
            (game_key, game_name, file_id, game_image)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        await update.message.reply_text(f"⚠️ Supabase သိမ်းရာတွင် Error ဖြစ်သည်: {e}")
        return ConversationHandler.END

    # 2. Firebase Firestore သို့ တစ်ပြိုင်နက်တည်း သိမ်းဆည်းခြင်း (Website အတွက်)
    if db_firestore:
        try:
            firestore_data = {
                "name": game_name,
                "platform": context.user_data.get("platform", "android"),
                "type": context.user_data.get("type", "Original"),
                "version": context.user_data.get("version", "1.0.0"),
                "size": context.user_data.get("size", "Unknown"),
                "icon": game_image,
                "description": context.user_data.get("description", ""),
                "features": context.user_data.get("features", []),
                "originalLink": orig_link,
                "modLink": mod_link,
                "downloadUrl": download_url,
                "obb_link": context.user_data.get("obb_link", ""),
                "playStoreUrl": "",
                "screenshots": context.user_data.get("screenshots", []),
                "featured": context.user_data.get("featured", False),
                "isSmallGame": context.user_data.get("isSmallGame", False),
                "isHot": context.user_data.get("isHot", False),
                "isNew": context.user_data.get("isNew", False),
                "isUpdate": context.user_data.get("isUpdate", False),
                "status": "published",
                "scheduledTime": "",
                "rating": 5.0,
                "total_ratings": 0,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP
            }
            db_firestore.collection("games").document(game_key).set(firestore_data)
        except Exception as e:
            print(f"Firebase Sync Error: {e}")

    bot_username = (await context.bot.get_me()).username
    await update.message.reply_text(
        f"🎉 **အောင်မြင်ပါသည်။**\n\n"
        f"🎮 **{game_name}** အား Supabase ရော Website (Firebase) ထဲသို့ပါ အချက်အလက်အစုံနှင့် အောင်မြင်စွာ တန်းတင်ပြီးပါပြီကွ!\n\n"
        f"🔗 **Share Link:** `https://t.me/{bot_username}?start={game_key}`",
        parse_mode="Markdown"
    )
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ ဂိမ်းထည့်သွင်းမှုကို ဖျက်သိမ်းလိုက်ပါပြီ သားရီး။")
    return ConversationHandler.END

async def del_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ် သားရီး။")
        return
        
    if not context.args:
        await update.message.reply_text("⚠️ ဖျက်ချင်တဲ့ ဂိမ်းရဲ့ Key ကို ထည့်ပေးပါ သားရီး။\n\n`/del_game dave_the_diver`", parse_mode="Markdown")
        return
        
    game_key = context.args[0].strip()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM games WHERE key = %s;", (game_key,))
        deleted_rows = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        
        # Firebase Firestore ဘက်မှလည်း လိုက်ဖျက်ရန်
        if db_firestore:
            try:
                db_firestore.collection("games").document(game_key).delete()
            except Exception:
                pass
        
        if deleted_rows > 0:
            await update.message.reply_text(f"🗑️ **ဂိမ်း ({game_key}) ကို Supabase နှင့် Firebase မှ အောင်မြင်စွာ ဖျက်လိုက်ပါပြီကွ!**", parse_mode="Markdown")
        else:
            await update.message.reply_text(f"⚠️ `{game_key}` ဆိုတဲ့ နာမည်နဲ့ ဂိမ်း Database ထဲမှာ မရှိပါဘူး သားရီး။", parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Error: {e}")

async def button_click(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    
    if query.data.startswith("get_file_"):
        game_key = query.data.replace("get_file_", "")
        db = load_db()
        game_info = db.get(game_key, {})
        target_file_id = game_info.get("link", "")
        game_name = game_info.get("name", "Game")
        
        if not context.user_data.get('unlocked', False):
            context.user_data['unlocked'] = True
            await query.answer(
                text="⚠️ အရင်ဆုံး အပေါ်က '🔓 Unlock Download Link (Ad)' ကို နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ သားရီး!",
                show_alert=True
            )
        else:
            await query.answer()
            try:
                await context.bot.send_document(
                    chat_id=query.message.chat_id,
                    document=target_file_id,
                    caption=f"✅ **Unlock အောင်မြင်ပါပြီ သားရီး!**\n🚀 **{game_name}** ဖိုင်ကို အောင်မြင်စွာ ရယူလိုက်ပါပြီခင်ဗျာ။"
                )
            except Exception as e:
                await query.message.reply_text(f"⚠️ ဖိုင်ပို့ရာတွင် Error ဖြစ်သွားသည်: {e}")

def main():
    threading.Thread(target=run_dummy_server, daemon=True).start()

    application = Application.builder().token(BOT_TOKEN).build()
    
    # Step-by-Step Add Game Conversation Handler
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("add_game", add_game_start)],
        states={
            GET_KEY_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_key_name)],
            GET_PLATFORM: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_platform)],
            GET_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_type)],
            GET_VERSION_SIZE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_version_size)],
            GET_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_description)],
            GET_FEATURES: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_features)],
            GET_ICON: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_icon)],
            GET_ORIGINAL_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_original_link)],
            GET_MOD_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_mod_link)],
            GET_OBB_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_obb_link)],
            GET_SCREENSHOTS: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_screenshots)],
            GET_BADGES: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_badges)],
            GET_FILE: [MessageHandler(filters.Document.ALL | filters.VIDEO | filters.AUDIO, receive_file)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    application.add_handler(conv_handler)
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("search", search_game))
    application.add_handler(CommandHandler("del_game", del_game))
    application.add_handler(CallbackQueryHandler(button_click))

    print("Bot starting successfully with Dual-Sync (Supabase + Firebase)...")
    application.run_polling()

if __name__ == '__main__':
    main()
